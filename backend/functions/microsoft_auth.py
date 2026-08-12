"""
microsoft_auth.py - SPSM Microsoft sign-in, server side

Why this exists
---------------
Firebase Auth cannot accept a Microsoft id_token directly. Its
accounts:signInWithIdp endpoint rejects providerId=microsoft.com with
INVALID_CREDENTIAL_OR_PROVIDER_ID regardless of how valid the token is —
Microsoft is a generic OAuth provider that Firebase only supports through its
own hosted handler, where Firebase performs the code exchange itself.

So the app can't mint a Microsoft credential on-device. Instead:

  app WebView  -> Microsoft login -> ?code=...
  app          -> this function   { code, code_verifier }
  this function-> Azure token endpoint (client_secret lives here, not on device)
               -> verifies the id_token signature against Microsoft's JWKS
               -> enforces the SPSM tenant and the church email domain
               -> returns a Firebase custom token
  app          -> auth().signInWithCustomToken(token)

Consequence worth knowing: users created this way do NOT carry "microsoft.com"
in providerData, because Firebase never sees the Microsoft credential. Account
linking and fetchSignInMethodsForEmail will not report Microsoft. The email
collision check below compensates for that.

Setup
-----
The client secret is the one from the app registration Firebase uses
(149615d2-4f88-4222-b69c-f3b82f2b8901). Store it in Secret Manager:

    firebase functions:secrets:set MS_AUTH_CLIENT_SECRET
"""
import json
import time

import jwt
import requests
from firebase_admin import auth
from firebase_functions import https_fn
from firebase_functions.params import SecretParam

# The SPSM directory. Tokens from any other tenant are refused outright.
TENANT_ID = "9e08a9a2-5bad-4835-800f-9071d98e47cf"
# The tenant check alone is not the same as a domain check: B2B guests invited
# into the directory get tokens carrying our `tid` but keep their own address,
# and the tenant's default *.onmicrosoft.com domain would pass too. Members are
# the ones with a church mailbox, so the address is checked as well.
ALLOWED_EMAIL_DOMAIN = "waylandcopticchurch.org"
# Same app registration Firebase's Microsoft provider is configured with.
CLIENT_ID = "149615d2-4f88-4222-b69c-f3b82f2b8901"
# Already registered on that app registration as a Web platform URI. The app
# never loads it; the WebView intercepts the navigation and reads the code.
REDIRECT_URI = "https://taksis-a8ba7.firebaseapp.com/__/auth/handler"

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
TOKEN_ENDPOINT = f"{AUTHORITY}/oauth2/v2.0/token"
JWKS_URI = f"{AUTHORITY}/discovery/v2.0/keys"
ISSUER = f"{AUTHORITY}/v2.0"

MS_AUTH_CLIENT_SECRET = SecretParam("MS_AUTH_CLIENT_SECRET")

# Reused across warm invocations; PyJWKClient caches the signing keys itself.
_jwks_client = None


def _jwks():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(JWKS_URI, cache_keys=True)
    return _jwks_client


def _json_error(message: str, status: int, code: str = "error"):
    return https_fn.Response(
        json.dumps({"error": code, "message": message}),
        status=status,
        headers={"Content-Type": "application/json"},
    )


@https_fn.on_request(secrets=[MS_AUTH_CLIENT_SECRET])
def microsoft_exchange(req: https_fn.Request) -> https_fn.Response:
    """
    Redeems a Microsoft authorization code and returns a Firebase custom token.

    Body: { "code": "...", "code_verifier": "..." }
    200:  { "token": "<firebase custom token>", "email": "...", "name": "..." }
    """
    if req.method != "POST":
        return _json_error("POST required", 405)

    try:
        body = req.get_json(silent=True) or {}
    except Exception:
        return _json_error("Invalid JSON body", 400)

    code = body.get("code")
    verifier = body.get("code_verifier")
    if not code or not verifier:
        return _json_error("Missing 'code' or 'code_verifier'", 400)

    # --- redeem the code -----------------------------------------------------
    try:
        resp = requests.post(
            TOKEN_ENDPOINT,
            data={
                "client_id": CLIENT_ID,
                "client_secret": MS_AUTH_CLIENT_SECRET.value,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
                "code_verifier": verifier,
                "scope": "openid profile email",
            },
            timeout=20,
        )
        payload = resp.json()
    except Exception as e:
        return _json_error(f"Could not reach Microsoft: {e}", 502)

    if resp.status_code != 200 or "id_token" not in payload:
        detail = payload.get("error_description") or payload.get("error") or "unknown"
        # Azure's descriptions are multi-line with trace ids; first line is the useful part.
        return _json_error(str(detail).split("\n")[0], 401, "exchange_failed")

    # --- verify the token ----------------------------------------------------
    # Signature checked against Microsoft's published keys, so a forged or
    # replayed token from elsewhere cannot mint a Firebase session.
    try:
        signing_key = _jwks().get_signing_key_from_jwt(payload["id_token"])
        claims = jwt.decode(
            payload["id_token"],
            signing_key.key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=ISSUER,
            options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        )
    except Exception as e:
        return _json_error(f"Token verification failed: {e}", 401, "invalid_token")

    if claims.get("tid") != TENANT_ID:
        return _json_error(
            "Taksis only accepts St. Philopater & St. Mina accounts.",
            403,
            "wrong_tenant",
        )

    # `oid` is stable for a user within a tenant; `sub` is per-application and
    # would change if the app registration were ever replaced.
    oid = claims.get("oid")
    if not oid:
        return _json_error("Token missing 'oid' claim", 401, "invalid_token")

    uid = f"microsoft:{oid}"
    email = claims.get("email") or claims.get("preferred_username") or ""
    name = claims.get("name") or ""

    # A guest's address is their own, and #EXT# accounts have the tenant's
    # onmicrosoft.com domain on the UPN, so neither passes this.
    if email.strip().rsplit("@", 1)[-1].lower() != ALLOWED_EMAIL_DOMAIN:
        return _json_error(
            f"Taksis only accepts @{ALLOWED_EMAIL_DOMAIN} accounts."
            + (f" {email} is not one." if email else ""),
            403,
            "wrong_domain",
        )

    # --- map onto a Firebase user -------------------------------------------
    try:
        auth.get_user(uid)
        if email or name:
            auth.update_user(uid, **{
                k: v for k, v in (("email", email), ("display_name", name)) if v
            })
    except auth.UserNotFoundError:
        # Firebase never sees the Microsoft credential, so it cannot detect that
        # this address already signed up through Google or Apple. Check here.
        if email:
            try:
                existing = auth.get_user_by_email(email)
                if existing.uid != uid:
                    providers = [p.provider_id for p in existing.provider_data] or ["email and password"]
                    return _json_error(
                        f"{email} is already registered with {' or '.join(providers)}. "
                        "Please sign in that way instead.",
                        409,
                        "account_exists",
                    )
            except auth.UserNotFoundError:
                pass
        try:
            auth.create_user(
                uid=uid,
                email=email or None,
                display_name=name or None,
                email_verified=bool(email),
            )
        except Exception as e:
            return _json_error(f"Could not create user: {e}", 500)
    except Exception as e:
        return _json_error(f"User lookup failed: {e}", 500)

    try:
        custom_token = auth.create_custom_token(uid, {"tenant": "spsm", "via": "microsoft"})
    except Exception as e:
        return _json_error(f"Could not mint token: {e}", 500)

    return https_fn.Response(
        json.dumps({
            "token": custom_token.decode() if isinstance(custom_token, bytes) else custom_token,
            "email": email,
            "name": name,
            "issued": int(time.time()),
        }),
        status=200,
        headers={"Content-Type": "application/json"},
    )
