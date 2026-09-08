# Drop-in for the church website (`spsm-database`)

These four files belong in the **church website's** Firebase Hosting deploy —
the `spsm-database` project serving `www.spsmwayland.org` — not in the Taksis
project. They live here because Taksis is where their contents are decided
(bundle identifiers, team ID, snippet paths), but Taksis does not deploy them.

They exist so the Taksis **App Clip** can launch from an NFC tag in the parking
lot without installing anything, and so the equivalent Android App Link works.

## What to copy

Copy into the site's public directory, preserving paths exactly:

```
.well-known/apple-app-site-association
.well-known/assetlinks.json
c/register-vehicle.html
c/taksis.png
```

`apple-app-site-association` has **no file extension**. That is correct. Adding
`.json` breaks it.

## What to change in that project's `firebase.json`

Merge these into the existing config — do not replace the file.

**1. Remove `"**/.*"` from `ignore`, if present.**

This is the single most important line here. It is in Firebase's default
scaffold, and it silently excludes every dotfile directory — including
`.well-known` — from every deploy. Nothing errors. The files simply are not
there, and the App Clip fails with no diagnostic.

**2. Add the content-type headers.** Both files must be served as JSON:

```json
"headers": [
  { "source": "/.well-known/apple-app-site-association",
    "headers": [{ "key": "Content-Type", "value": "application/json" }] },
  { "source": "/.well-known/assetlinks.json",
    "headers": [{ "key": "Content-Type", "value": "application/json" }] }
]
```

**3. Add the rewrite, above any catch-all:**

```json
"rewrites": [
  { "source": "/c/register-vehicle", "destination": "/c/register-vehicle.html" }
]
```

If the site is a SPA with a `"source": "**"` rewrite, this one must come first —
Firebase uses the first match.

## These must be served from `www`, not the apex

The App Clip's invocation URL is:

```
https://www.spsmwayland.org/c/register-vehicle
```

`www` is the host named in the app binary's entitlements, so `www` is where these
files have to be reachable with a **200 and no redirect**.

The apex (`spsmwayland.org`) is configured in the Firebase console to 301 to
`www`, which is fine and deliberate — but it means the apex cannot serve these
files. Apple and Android both refuse to follow a redirect for them and fail
silently when they hit one.

If the apex is ever changed to serve content directly instead of redirecting,
that does not break anything here; `www` remains correct either way.

## Before deploying: both Android fingerprints, not one

`assetlinks.json` needs **two** SHA-256 values, and getting only one is the
classic way to ship Android App Links that silently do not work.

- **Upload key** — already filled in. Signs locally built APKs.
  `keytool -list -v -keystore credentials/android/keystore.jks -alias <alias> | grep SHA256`
- **Play App Signing** — still a placeholder. Play Console → Setup → App
  integrity → App signing → SHA-256 certificate fingerprint.

Play re-signs the uploaded bundle with its own key, so **an app installed from
the Play Store presents a different certificate than the one you uploaded**.
With only the upload key listed, verification fails for every real user while
working perfectly on your own build — which is the worst possible way for it to
fail, because local testing looks fine.

`google-services.json` carries only SHA-1 values, which are not usable here.

## Verifying after deploy

```bash
curl -sS -D- -o/dev/null https://www.spsmwayland.org/.well-known/apple-app-site-association
```

Wants `200`, `content-type: application/json`, and **no `location` header**.
Apple and Android both refuse to follow a redirect here, and both fail silently
when they hit one. Same check for `assetlinks.json`.

```bash
curl -sS -o/dev/null -w '%{http_code}\n' https://www.spsmwayland.org/c/register-vehicle
```

Wants `200` and should render the vehicle registration form.

## Do not

- Rename or move these paths. They are compiled into the shipped app binary's
  entitlements and into every printed NFC tag; changing them means an app
  update, re-registering the App Store Connect experiences, and reprogramming
  every tag already in the field.
- Put a redirect in front of `/.well-known/` or `/c/`.
- Add a `.json` extension to `apple-app-site-association`.

## Where these come from

Generated from the Taksis repo, branch `app-clip-vehicle-registration`, under
`church-site/`. If the App Clip's bundle identifier, team ID, or snippet paths
change there, these files must be re-copied. See `DEEP_LINKS.md` in that repo.
