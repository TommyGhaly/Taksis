# Drop-in for the church website (`spsm-database`)

These four files belong in the **church website's** Firebase Hosting deploy —
the `spsm-database` project serving `spsmwayland.org` — not in the Taksis
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

## Attach both hostnames to this site

`spsmwayland.org` **and** `www.spsmwayland.org` should both point at this site,
with no redirect between them.

Firebase Hosting cannot match redirects on hostname, so a single site cannot
send the apex to `www`. Doing that would need a second site — and it would put a
301 in front of the AASA, which is exactly what has to be avoided. Serving both
is simpler and costs only a `rel="canonical"` tag for SEO.

The App Clip's invocation URL is on the bare domain:
`https://spsmwayland.org/c/register-vehicle`.

## Before deploying: fill in the Android fingerprints

`assetlinks.json` ships with deliberately invalid placeholders. Android App
Links will not verify until both are real SHA-256 values. `google-services.json`
carries only SHA-1, which is not usable here.

- **Play App Signing** — Play Console → Setup → App integrity → App signing.
- **Upload key** — `keytool -list -v -keystore <keystore> -alias <alias> | grep SHA256`

Include both, or App Links verify from the Play Store but not from a locally
built APK.

## Verifying after deploy

```bash
curl -sS -D- -o/dev/null https://spsmwayland.org/.well-known/apple-app-site-association
```

Wants `200`, `content-type: application/json`, and **no `location` header**.
Apple and Android both refuse to follow a redirect here, and both fail silently
when they hit one. Same check for `assetlinks.json`.

```bash
curl -sS -o/dev/null -w '%{http_code}\n' https://spsmwayland.org/c/register-vehicle
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
