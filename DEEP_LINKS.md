# Deep links: App Clip + Android App Links

One URL, tapped from an NFC tag in the parking lot:

```
https://spsmwayland.org/c/register-vehicle
```

| Who taps it | What happens |
|---|---|
| iOS, app not installed | App Clip card → native form, no install, no account |
| iOS, app installed | App opens on the vehicle registration screen |
| Android, app installed | App Link opens the app on that screen |
| Android / desktop, no app | Web form, with a dismissible install banner |

Every path submits the same `pending_registrations` document, so
`screens/AdminScreens/TrafficManager.js` picks all of them up unchanged.

## Why `/c/`

Nine App Clip Experiences are planned. iOS allows exactly one App Clip *target*
per app, so all nine ship in one binary and are selected by the invocation URL —
`ClipDestination` is that router.

Namespacing them under one prefix means a single Android `pathPrefix` filter, a
single AASA component, and one clean exclusion in the apex redirect. It also
means the app never claims an unrelated URL on the church's domain.

Adding a snippet touches four places: `ClipDestination` and `RootView` in
`ios-appclip/`, `SNIPPET_ROUTES` in `utils/deepLinks.js`, a page under `apex/c/`
with a rewrite in `firebase.json`, and a new Experience in App Store Connect.
The AASA is not one of them.

## Why the apex left Wix

Measured before changing anything:

```
https://spsmwayland.org/                    → 301 → https://www.spsmwayland.org/
https://spsmwayland.org/.well-known/…       → 301 → www → HTTP 400
```

Apple and Android both require these files to return **200 with no redirect**,
and both fail silently when they don't — no error surfaces, the link just quietly
opens a browser. Wix cannot serve them.

The apex was doing nothing but redirecting to `www`, so Firebase took it over and
reproduces that redirect. **The church site is untouched** — it lives at
`www.spsmwayland.org`, a separate DNS record, still on Wix.

## Two hosting sites

Hosting config applies per *site*, and a site serves all of its domains. A single
site would have meant the apex's catch-all redirect also hitting
`taksis-a8ba7.web.app`, which serves the live registration form on a link people
already have. So:

| Target | Domain | Behavior |
|---|---|---|
| `apex` | `spsmwayland.org` | serves `/.well-known/*` and `/c/*`; 301s the rest to `www` |
| `app` | `taksis-a8ba7.web.app` | 301s to the form's canonical URL, so the old link still works |

The apex redirect is an RE2 regex, not a glob, because Firebase evaluates
redirects **before** static content and rewrites — a naive catch-all would
swallow the AASA and the clip URL. RE2 has no lookahead, hence the alternation:

```
^/(?P<rest>(?:[^c./]|[^./][^/]+)(?:/.*)?)$
```

"First path segment is neither exactly `c` nor starts with `.`". So `/contact`
and `/events/christmas` still reach `www`, while `/c/…` and `/.well-known/…` are
served here.

## Deploying

Create the apex site once (the ID is global, so it may need a variation — update
`.firebaserc` to match):

```bash
npx firebase-tools@latest hosting:sites:create spsmwayland
```

```bash
npx firebase-tools@latest deploy --only hosting
```

## DNS cutover

1. Firebase Console → Hosting → the `spsmwayland` site → Add custom domain →
   `spsmwayland.org`.
2. **Write down the current apex A records first** — `185.230.63.107`, `.171`,
   `.186` at the time of writing. Pasting them back is the rollback.
3. In Wix's DNS manager: add the TXT record Firebase gives you, then replace the
   apex A records with Firebase's. Read them off the console rather than copying
   them from documentation; they change.
4. **Leave the `www` CNAME (`cdn3.wixdns.net`) alone.** That is the church site.
5. Wait for cert provisioning before testing anything end to end.

Expect a cosmetic "domain not connected" warning in Wix afterward. `www` is still
connected, which is what matters.

## Before the first deploy: fill in the Android fingerprints

`apex/.well-known/assetlinks.json` ships with deliberately invalid placeholders.
App Links will not verify until both are replaced with real SHA-256 fingerprints.
`google-services.json` carries only SHA-1 values, which are not usable here.

- **Play App Signing** — Play Console → Setup → App integrity → App signing →
  SHA-256 certificate fingerprint.
- **Upload key** — needed so locally-built APKs verify too:

  ```bash
  keytool -list -v -keystore credentials/android/keystore.jks -alias <alias> | grep SHA256
  ```

Include both. Omitting the upload key is the usual reason App Links verify in
production but not on a local build.

## Verifying

The two well-known files — both want `200`, `application/json`, no `location`:

```bash
curl -sS -D- -o/dev/null https://spsmwayland.org/.well-known/apple-app-site-association
```

That the church site still works, and the redirect regex does what it claims:

```bash
curl -sS -o/dev/null -w '%{http_code} %{redirect_url}\n' https://spsmwayland.org/ https://spsmwayland.org/contact https://spsmwayland.org/c/register-vehicle
```

Expect `301 → www…/`, `301 → www…/contact`, `200`. Then open
`https://www.spsmwayland.org/` and confirm the site is unchanged — that is the
check that matters if something went wrong.

The clip itself, without needing App Store Connect: install it via Xcode, then on
the device go to **Settings → Developer → Local Experiences** and register URL
prefix `https://spsmwayland.org/c/register-vehicle` with bundle ID
`com.tghaly.taksis.Clip`. Local Experiences bypass the associated-domain check, so
this works before DNS has moved. See `ios-appclip/README.md` for simulator runs.

Android:

```bash
adb shell pm verify-app-links --re-verify com.tghaly.taksis && adb shell pm get-app-links com.tghaly.taksis
```

Wants `verified` for `spsmwayland.org`.

## NFC tags

An NDEF URI record holding the URL — ~42 bytes, comfortable on an NTAG213 (144
bytes). Capacity is not a constraint, so prefer readable paths over short ones.

`apex/c/register-vehicle.html` ignores query parameters, so a `?tag=main-gate`
suffix can be added per tag for install attribution without breaking anything.

## A caution about the church

`ClipConfig.church` in the clip, and the same constant in the web form, are
hardcoded to St. Philopater and St. Mina. The associated domain is baked into the
app binary and cannot vary per church either. This is fine while one church runs
the parking program; if a second joins, both the church constant and the domain
need rethinking, and the domain is the expensive one — changing it means an app
update, re-registering every Experience, and reprogramming every tag in the field.
