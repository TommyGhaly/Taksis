import auth from "@react-native-firebase/auth";
import * as Crypto from "expo-crypto";

/**
 * In-app Microsoft sign-in for SPSM accounts.
 *
 * Firebase Auth cannot take a Microsoft credential on-device: its
 * signInWithIdp endpoint rejects providerId=microsoft.com outright
 * (INVALID_CREDENTIAL_OR_PROVIDER_ID) no matter how valid the id_token is,
 * because Microsoft is a generic OAuth provider Firebase only supports through
 * its own hosted handler. That rules out signInWithCredential entirely.
 *
 * So the device does the user-facing half and a Cloud Function does the rest:
 *
 *   WebView  -> Microsoft login -> ?code=...        (components/MicrosoftSignInModal.js)
 *   here     -> microsoft_exchange { code, verifier }
 *   function -> redeems with the client secret, verifies the signature and
 *               tenant, returns a Firebase custom token
 *   here     -> auth().signInWithCustomToken(...)
 *
 * PKCE is still used even though the exchange is confidential: it binds the
 * code to this specific attempt, so an intercepted code is useless on its own.
 *
 * No Azure changes are needed — REDIRECT_URI below is the Web platform URI
 * Firebase already registered, and the secret lives server-side.
 */

// Same app registration Firebase's Microsoft provider is configured with.
export const CLIENT_ID = "149615d2-4f88-4222-b69c-f3b82f2b8901";

// The SPSM directory. The tenant-scoped authority stops Microsoft from even
// offering personal accounts; the function re-checks `tid` on the verified
// token, which is where the restriction is actually enforced.
export const TENANT_ID = "9e08a9a2-5bad-4835-800f-9071d98e47cf";
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`;

// Already registered as a Web platform redirect URI. Never actually loaded —
// the WebView intercepts the navigation to it and reads the code off the query.
export const REDIRECT_URI =
  "https://taksis-a8ba7.firebaseapp.com/__/auth/handler";

const EXCHANGE_URL =
  "https://us-central1-taksis-a8ba7.cloudfunctions.net/microsoft_exchange";

const SCOPES = "openid profile email";

// RFC 7636 unreserved characters.
const VERIFIER_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

// React Native's URLSearchParams polyfill doesn't reliably build from an object,
// so encode by hand rather than depending on it.
const toQuery = (params) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

/** Pulls the query params out of the redirect. */
export const parseRedirectParams = (url) => {
  const out = {};
  const [head, fragment] = String(url || "").split("#");
  const query = head.split("?")[1];
  for (const chunk of [query, fragment]) {
    if (!chunk) continue;
    for (const pair of chunk.split("&")) {
      const [k, v = ""] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    }
  }
  return out;
};

const base64UrlEscape = (b64) =>
  b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Builds the authorize URL plus the verifier the exchange will need. */
export const createAuthRequest = async () => {
  const bytes = Crypto.getRandomBytes(64);
  const codeVerifier = Array.from(bytes)
    .map((b) => VERIFIER_CHARS[b % VERIFIER_CHARS.length])
    .join("");

  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );

  const query = toQuery({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
    code_challenge: base64UrlEscape(digest),
    code_challenge_method: "S256",
    // Otherwise Microsoft reuses whatever account the WebView last saw.
    prompt: "select_account",
  });

  return { url: `${AUTHORITY}/authorize?${query}`, codeVerifier };
};

/**
 * Hands the code to the Cloud Function and signs in with what comes back.
 * The function owns verification — signature, audience, issuer and tenant —
 * because none of that can be trusted if it happens on the device.
 */
export const signInWithMicrosoftCode = async ({ code, codeVerifier }) => {
  let res;
  try {
    res = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: codeVerifier }),
    });
  } catch (e) {
    const err = new Error("Could not reach the sign-in service. Check your connection.");
    err.code = "auth/network";
    throw err;
  }

  let body = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON response; fall through to the status-based message below.
  }

  if (!res.ok) {
    const err = new Error(body.message || `Sign-in failed (${res.status}).`);
    // Surfaced so the screens can title the alert appropriately.
    err.code =
      body.error === "wrong_tenant"
        ? "auth/wrong-tenant"
        : body.error === "account_exists"
          ? "auth/account-exists-with-different-credential"
          : "auth/exchange-failed";
    throw err;
  }

  if (!body.token) {
    const err = new Error("Sign-in service returned no token.");
    err.code = "auth/exchange-failed";
    throw err;
  }

  return auth().signInWithCustomToken(body.token);
};

/**
 * Firebase collapses backend failures into auth/internal-error with a useless
 * message. The real cause sits on nativeErrorMessage / userInfo, so pull
 * everything out rather than showing "an internal error has occurred".
 */
export const describeAuthError = (e) => {
  const parts = [
    e?.code,
    e?.nativeErrorCode,
    e?.nativeErrorMessage,
    e?.userInfo?.message,
    e?.message,
  ].filter(Boolean);
  return [...new Set(parts)].join("\n\n") || "Unknown error";
};
