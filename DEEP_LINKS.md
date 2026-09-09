# Deep links: App Clip + Android App Links

One URL, tapped from an NFC tag in the parking lot:

```
https://www.spsmwayland.org/c/register-vehicle
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

Namespacing them under one prefix means a single Android `pathPrefix` filter and
a single AASA component covering all nine. It also keeps the app from claiming
any URL on the church's domain other than its own.

Adding a snippet touches three places: `ClipDestination` and `RootView` in
`ios-appclip/`, `SNIPPET_ROUTES` in `utils/deepLinks.js`, and a page under
`church-site/c/` with a rewrite in the church site's `firebase.json`.

Neither the AASA nor App Store Connect is one of them. The AASA claims `/c/*`
once. And the registered Advanced App Clip Experience is the **prefix**
`https://www.spsmwayland.org/c`, which Apple matches against every URL beneath
it — so a new snippet is invocable the moment it ships.

## Registering App Clip Experiences

One experience is registered, for the prefix:

```
https://www.spsmwayland.org/c
```

Apple chooses the experience whose URL is the *most specific matching prefix*, so
this covers all nine planned snippets. The clip receives the full invocation URL
and routes on the segment after `/c`.

**Do not assume the clip is handed a full snippet URL.** It often is not:

- When the launch comes from the *experience itself* rather than a URL someone
  tapped — App Review and TestFlight both do this, as does an App Clip Code
  generated for the experience — the invocation URL is the registered prefix
  `https://www.spsmwayland.org/c` verbatim, with no snippet segment.
- The **default App Clip Experience** in App Store Connect carries its own URL,
  which need not be under `/c` at all.
- Sometimes no URL arrives.

So the clip treats "named no snippet" as a generic entry point and opens
`ClipDestination.genericDefault`, not a dead end. The only invocation that dead
ends is one naming a snippet the installed binary does not have — an old clip
meeting a tag from a later release. The first submission got this wrong and
showed the reviewer "Nothing to show" while working perfectly from an NFC tag.

Register a more specific URL — `/c/check-in`, say — only when a snippet needs its
own **card** (image, title, subtitle, action). That is the only thing a per-snippet
registration buys; routing already works. The specific entry wins over `/c`, and
anything unregistered falls back to the generic card rather than failing.

Note that App Store Connect rejected the full `/c/register-vehicle` URL with
"URLs must be included in your app domain list" while accepting the `/c` prefix,
even with the domain showing as Validated. If that recurs on a specific URL, the
prefix is the reliable form. For managing many experiences, Apple's App Store
Connect API can create them in bulk.

## Where the files live

The church website moved to Firebase Hosting, in the **`spsm-database` project** —
a different project from Taksis (`taksis-a8ba7`). A domain attaches to exactly one
hosting site, so the site serving the church's domain is also the site that must
serve the App Clip's files:

```
/.well-known/apple-app-site-association
/.well-known/assetlinks.json
/c/register-vehicle
```

Those live in `church-site/` in this repo as the source of truth, but **Taksis
does not deploy them** — they are copied into the church website project. See
`church-site/README.md`, which is written to be handed over on its own.

Only `www.spsmwayland.org` serves them. The apex is attached to the same site as
a **redirect domain**, so `https://spsmwayland.org/...` answers 301 to `www` —
verified 2026-09-08 for `/c/register-vehicle` and both `/.well-known/` files.

That 301 is a domain-level Firebase setting, not something `firebase.json` can
express; a `redirects` block cannot match on hostname. Which is why the apex is
**not** a usable App Clip or App Link URL: Apple and Android both refuse to
follow a redirect for the AASA and `assetlinks.json`, and fail silently when
they hit one. An apex link opens the browser and nothing else.

So every URL that has to reach the app — NFC tags, the App Clip Experience in
App Store Connect, the Android intent filter, the entitlements — must use `www`.
Making the apex work means serving it directly (console change), claiming it in
both platforms' config, and shipping a new binary.

This is much simpler than the arrangement that came before it. While the apex was
on Wix it answered `/.well-known/*` with a 301 to `www` and then a 400, so the
domain could not be verified at all. That required a second hosting site and an
RE2 redirect with carve-outs for `/c/` and `/.well-known/`. Moving the site to
Firebase removed the entire problem; none of that machinery survives.

## What Taksis still hosts

One site, `taksis-a8ba7.web.app`, which used to serve the registration form
directly. People have that link, so rather than break it, it 301s to the form's
new canonical home at `https://www.spsmwayland.org/c/register-vehicle`.

`/__/*` is a reserved namespace that Firebase resolves ahead of redirects, so the
Firebase Auth handler on `taksis-a8ba7.firebaseapp.com` is unaffected — worth
knowing, because Microsoft sign-in depends on it.

## Deploying

Two deploys, in two different projects.

Taksis — only updates the old-link redirect:

```bash
npx firebase-tools@latest deploy --only hosting
```

The App Clip's files ship with the church website's own deploy. See
`church-site/README.md`, which is written to stand alone.

## DNS

The registrar became Porkbun on 2026-09-06, but nameserver delegation survived
the transfer and was still Wix (`ns10/ns11.wixdns.net`) at the time of writing.

Point both `spsmwayland.org` and `www.spsmwayland.org` at the church website's
Firebase site, using the records the Firebase console shows for it. Read them off
the console rather than copying from documentation; they change.

**Before touching nameservers, read `DNS_MIGRATION.md`.** The domain carries the
church's Microsoft 365 email — MX, SPF, the tenant verification, autodiscover and
two SRV records — and a migration that misses any of them stops mail. Bounced
mail does not come back. That file is the full inventory, captured while the
records were still live.

## Before the first deploy: fill in the Android fingerprints

`church-site/.well-known/assetlinks.json` ships with deliberately invalid placeholders.
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
curl -sS -D- -o/dev/null https://www.spsmwayland.org/.well-known/apple-app-site-association
```

That the church site still works and the clip URL serves a real page:

```bash
curl -sS -o/dev/null -w '%{http_code}\n' https://spsmwayland.org/ https://www.spsmwayland.org/ https://www.spsmwayland.org/c/register-vehicle
```

All three want `200` — the first two are the church site on both hostnames, the
third is the registration form. Then open `https://www.spsmwayland.org/` in a
browser and confirm the site itself looks right. That is the check that matters
if something went wrong.

The clip itself, without needing App Store Connect: install it via Xcode, then on
the device go to **Settings → Developer → Local Experiences** and register URL
prefix `https://www.spsmwayland.org/c/register-vehicle` with bundle ID
`com.tghaly.taksis.Clip`. Local Experiences bypass the associated-domain check, so
this works before DNS has moved. See `ios-appclip/README.md` for simulator runs.

Android:

```bash
adb shell pm verify-app-links --re-verify com.tghaly.taksis && adb shell pm get-app-links com.tghaly.taksis
```

Wants `verified` for `www.spsmwayland.org`.

## NFC tags

An NDEF URI record holding the URL — ~42 bytes, comfortable on an NTAG213 (144
bytes). Capacity is not a constraint, so prefer readable paths over short ones.

`church-site/c/register-vehicle.html` ignores query parameters, so a `?tag=main-gate`
suffix can be added per tag for install attribution without breaking anything.

## A caution about the church

`ClipConfig.church` in the clip, and the same constant in the web form, are
hardcoded to St. Philopater and St. Mina. The associated domain is baked into the
app binary and cannot vary per church either. This is fine while one church runs
the parking program; if a second joins, both the church constant and the domain
need rethinking, and the domain is the expensive one — changing it means an app
update, re-registering every Experience, and reprogramming every tag in the field.
