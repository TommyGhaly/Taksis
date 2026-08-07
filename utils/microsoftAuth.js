import auth from "@react-native-firebase/auth";
import * as Crypto from "expo-crypto";

/**
 * In-app Microsoft sign-in.
 *
 * Firebase's own signInWithRedirect() hands the flow to SFSafariViewController /
 * a Custom Tab, which leaves the app's UI. Instead we drive Azure's authorize
 * endpoint ourselves inside a WebView (see components/MicrosoftSignInModal.js),
 * take the resulting id_token, and hand that to Firebase as a credential.
 *
 * This needs two things that plain signInWithRedirect did not:
 *
 *   1. An Azure "Mobile and desktop applications" platform on the same app
 *      registration, with REDIRECT_URI below registered on it. That platform is
 *      a public client, so the code exchange needs no client secret — which is
 *      what makes it safe to do from the device.
 *   2. patches/@react-native-firebase+auth+21.14.0.patch, which teaches the
 *      native modules to build a microsoft.com credential. Without it
 *      signInWithCredential silently produces a null credential.
 */

// Same app registration Firebase is configured with, so the id_token's `aud`
// matches what Firebase validates against.
export const CLIENT_ID = "149615d2-4f88-4222-b69c-f3b82f2b8901";

// The SPSM directory. Using the tenant-specific authority rather than "common"
// means Microsoft never offers personal accounts in the first place — but see
// the tid check below: the authority is UX, not enforcement.
export const TENANT_ID = "9e08a9a2-5bad-4835-800f-9071d98e47cf";
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`;

export const WRONG_TENANT_MESSAGE =
  "Ⲧⲁⲝⲓⲥ only accepts St. Philopater & St. Mina accounts. Please sign in with your SPSM Microsoft account.";
export const REDIRECT_URI = "taksis://msauth";
const SCOPES = "openid profile email User.Read";

// RFC 7636 unreserved characters.
const VERIFIER_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

const base64UrlEscape = (b64) =>
  b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// React Native's URLSearchParams polyfill doesn't reliably build from an object,
// so encode by hand rather than depending on it.
const toQuery = (params) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

/** Pulls the query params out of a redirect like `taksis://msauth?code=...`. */
export const parseRedirectParams = (url) => {
  const q = url.split("?")[1];
  if (!q) return {};
  return q.split("&").reduce((acc, pair) => {
    const [k, v = ""] = pair.split("=");
    if (k) acc[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    return acc;
  }, {});
};

/** Builds the authorize URL plus the verifier needed later to redeem the code. */
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

/** Redeems the authorization code. Public client, so no client_secret. */
export const exchangeCodeForTokens = async (code, codeVerifier) => {
  const res = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: toQuery({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
      scope: SCOPES,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.id_token) {
    throw new Error(
      json.error_description || json.error || "Microsoft token exchange failed.",
    );
  }
  return { idToken: json.id_token, accessToken: json.access_token };
};

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** RN has no dependable atob, so unpack base64url by hand. */
const decodeBase64Url = (input) => {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const ch of b64) {
    if (ch === "=") break;
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  // The bytes are UTF-8; round-trip through percent-encoding so accented names survive.
  try {
    return decodeURIComponent(
      out
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    return out;
  }
};

/**
 * Reads the id_token payload. Unverified on purpose — Firebase checks the
 * signature. This is only for deciding whether to bother calling Firebase.
 */
export const readIdTokenClaims = (idToken) => {
  const parts = String(idToken || "").split(".");
  if (parts.length < 2) return {};
  try {
    return JSON.parse(decodeBase64Url(parts[1]));
  } catch {
    return {};
  }
};

/**
 * Hands Microsoft's id_token to Firebase. The plain-object shape is what
 * RNFB's signInWithCredential reads (providerId / token / secret) — there is no
 * MicrosoftAuthProvider helper to build it for us.
 *
 * The tid check turns an outside account into a clear message instead of a
 * confusing Firebase error. It is NOT the security boundary: a modified client
 * could skip it, and Firebase itself does not inspect tid. The actual gate is
 * the Azure app registration being single-tenant, which stops Microsoft issuing
 * a token for this client_id to anyone outside SPSM at all.
 */
export const signInWithMicrosoftTokens = ({ idToken, accessToken }) => {
  const { tid } = readIdTokenClaims(idToken);
  if (tid !== TENANT_ID) {
    const err = new Error(WRONG_TENANT_MESSAGE);
    err.code = "auth/wrong-tenant";
    throw err;
  }
  return auth().signInWithCredential({
    providerId: "microsoft.com",
    token: idToken,
    secret: accessToken,
  });
};

const PROVIDER_LABELS = {
  "google.com": "Google",
  "apple.com": "Apple",
  "microsoft.com": "Microsoft",
  password: "an email and password",
};

/**
 * Firebase allows one account per email address, so signing in with Microsoft
 * using an address that already went through Google or Apple throws
 * auth/account-exists-with-different-credential instead of linking the two.
 * Names the provider they actually used, when Firebase is willing to tell us.
 */
export const describeAccountCollision = async (error) => {
  const email = error?.email || error?.userInfo?.email;
  if (!email) {
    return "That email is already registered with a different sign-in method.";
  }

  let methods = [];
  try {
    methods = await auth().fetchSignInMethodsForEmail(email);
  } catch {
    // Email enumeration protection blocks this lookup; fall through to generic copy.
  }

  const existing = methods
    .filter((m) => m !== "microsoft.com")
    .map((m) => PROVIDER_LABELS[m] || m);

  return existing.length
    ? `${email} is already registered with ${existing.join(" or ")}. Please sign in that way instead.`
    : `${email} is already registered with a different sign-in method.`;
};
