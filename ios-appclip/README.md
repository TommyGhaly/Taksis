# Taksis iOS App Clip

A native SwiftUI App Clip. The first snippet is the vehicle registration form,
so someone can scan a code in the parking lot and register their car without
installing anything or creating an account.

## One target, many snippets

**iOS allows an app exactly one App Clip target.** You cannot ship several. The
way to offer several unrelated mini-experiences is:

- **One** App Clip binary — this target.
- **Many** App Clip Experiences, each registered in App Store Connect against a
  different URL, all launching that binary.
- The clip reads the URL it was invoked with and routes to the matching screen.

So `ClipDestination` is the list of snippets, keyed by the path segment after
`/c/`, and `RootView` maps each to a view. Adding one means: a case in
`ClipDestination`, a branch in `RootView`, a page under `apex/c/` with a rewrite
in `firebase.json`, and an Experience in App Store Connect. The four steps are
listed in the doc comment on `ClipDestination`.

The AASA needs no edit per snippet: it claims `/c/*` once, and its `appclips`
key takes App IDs only, never paths. Every snippet also needs a route in
`utils/deepLinks.js`, or the installed app will swallow the link that the clip
handles fine.

The catch worth planning around: every snippet ships in the same binary against
a single **15 MB** budget. A dozen SwiftUI forms is fine; anything pulling in a
large dependency is not.

## Why this is Swift and not React Native

App Clips have a hard **15 MB uncompressed** size budget (iOS 16+; 10 MB on
iOS 14–15). The React Native runtime plus Hermes plus the Firebase SDK does not
fit, so the clip cannot reuse `screens/Settings/RegisterVehicle.js`.

Instead this is a small SwiftUI target that links **no pods at all** and writes
to Firestore over the REST API. The built clip is ~3.4 MB in Debug. This is the
same approach `backend/vehicleRegistrationForm.html` already takes for the web
version of the form.

The tradeoff is that the form exists in three places now — the RN screen, the
web page, and this clip. `Theme.swift` and `RegistrationModel.swift` carry
comments pointing at the JS they mirror; **`VehicleColorOption.all` must stay in
sync with `COLOR_OPTIONS` in `components/TrafficVehicleComponents.js`** or the
admin UI will not recognize a submitted color.

## How it is wired up

`ios/` is generated output — anything added by hand in Xcode is destroyed by the
next `expo prebuild --clean`. So the target is created by a config plugin:

- **`ios-appclip/TaksisClip/`** — the checked-in source of truth.
- **`plugins/withVehicleAppClip.js`** — on every prebuild, copies those sources
  to `ios/TaksisClip/`, creates the App Clip target, adds the "Embed App Clips"
  phase to the main app, and adds the associated domain to the app's
  entitlements. Registered in `app.json` under `plugins`.

Bundle identifier: `com.tghaly.taksis.Clip` (must be the app's ID plus exactly one
suffix). Named for the target, not a snippet: one binary serves all of them.

## What it writes

One document in `pending_registrations`, matching the shape the RN screen and
web form produce, so `screens/AdminScreens/TrafficManager.js` picks it up with no
changes:

```
church, license, drivers[{name, phone, has_taksis}], present:false,
status:"pending", created_at, make?, model?, color?
```

`source: "ios_app_clip"` is added so submissions can be attributed. The REST API
has no server-timestamp sentinel, so `created_at` is the client clock —
acceptable because `TrafficManager` does not order on it.

Only driver 1 is required, and unlike the in-app screen nothing is prefilled:
a clip has no signed-in user.

## The church is hardcoded

`ClipConfig.church` is a constant, matching how `CHURCH_ID` works in
`backend/vehicleRegistrationForm.html`. There is no logged-in user to read a
church from, and only one church currently runs the parking program. If a second
one joins, this and the web form both need a way to vary it — probably a path or
query parameter on the invocation URL, but there is no reason to build that yet.

## Testing in the simulator

The clip needs no pods, no Metro, and no signing, so it builds and runs on its
own. From the repo root:

```bash
npx expo prebuild -p ios --no-install
```

```bash
xcodebuild -project ios/app.xcodeproj -target TaksisClip -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO
```

```bash
xcrun simctl install booted ios/build/Debug-iphonesimulator/TaksisClip.app && xcrun simctl launch booted com.tghaly.taksis.Clip
```

Or just open `ios/app.xcworkspace`, pick the **TaksisClip** scheme, and hit Run.

The invocation URL always decides which snippet runs; the user is never asked.
A plain simulator run has no URL, which is one of the several ordinary
no-snippet-named cases, so it lands on `ClipDestination.genericDefault` — change
that constant to work on a different snippet, or pass the URL explicitly:

```bash
SIMCTL_CHILD__XCAppClipURL="https://www.spsmwayland.org/c/register-vehicle" xcrun simctl launch booted com.tghaly.taksis.Clip
```

`ClipRouter.resolveDebugEnvironment()` reads that variable directly, because
`simctl` does **not** turn it into the `NSUserActivity` a real launch delivers —
setting the variable alone routes nowhere without it. In Xcode the equivalent is
the App Clip URL field in the scheme's Run options.

What a simulator *cannot* test is the invocation itself: the App Clip card, QR
codes, and associated-domain validation. That needs a device — see below.

> Submitting writes to the **production** Firestore and puts a real row in the
> church's pending-approval queue. Use an obvious throwaway plate and delete it
> from Traffic Manager afterward.

## Testing the real invocation on a device

You do **not** need App Store Connect for this. On a device with the clip
installed via Xcode, go to **Settings → Developer → Local Experiences** and
register one with URL prefix `https://www.spsmwayland.org/c/register-vehicle` and
bundle ID `com.tghaly.taksis.Clip`. A QR code or NFC tag holding that URL will
then bring up the real App Clip card. Local Experiences bypass the
associated-domain check, so this works before DNS moves or the AASA is deployed.

## Remaining setup for production (cannot be done from this repo)

Items 1-3 of this list were the Wix-era DNS move, placeholder Android
fingerprints, and a per-snippet App Store Connect registration. All three are
resolved and none of them come back per snippet:

- The whole church site is on Firebase Hosting now, in `spsm-database`.
  `www.spsmwayland.org` serves `/c/*` and both association files with a 200.
  The apex 301s to `www`, which is why every URL that must reach the app —
  NFC tags, entitlements, intent filter, the registered experience — uses
  `www`. Wix is out of the picture entirely.
- `assetlinks.json` carries the real SHA-256. Why it equals the local keystore
  is explained in `church-site/README.md`; read that before "fixing" it.
- One Advanced App Clip Experience is registered, for the prefix
  `https://www.spsmwayland.org/c`. Apple matches the most specific prefix, so it
  covers every planned snippet. Register a specific URL only to give a snippet
  its own card.

What is actually still open:

1. **Confirm Android App Link verification on a Play-signed build.** A sideloaded
   APK proves nothing — it carries a different signature. Install from an
   internal testing track and run:

   ```
   adb shell pm get-app-links com.tghaly.taksis
   ```

   You want `www.spsmwayland.org: verified`. `1024` or `legacy_failure` means the
   fingerprint or the JSON content-type is wrong, and the only symptom in the
   field is that the tag quietly opens Chrome instead of the app.

2. **Firestore rules for the unauthenticated writes.** The web fallback posts to
   the Firestore REST API with no auth, so `pending_registrations` depends on a
   rule that exists only in the console — there is no `firestore.rules` in this
   repo. Every future snippet writing a new collection needs the same treatment.
   This is the step that fails closed and silently.

3. **Distribution signing.** The App ID `com.tghaly.taksis.Clip` already exists,
   with App Clips and Associated Domains enabled, and development signing works —
   the clip builds and installs on a device. What is *not* resolved is store
   signing: `eas.json`'s production profile uses `credentialsSource: "local"` but
   the repo has no `credentials.json`, so the clip has no distribution profile.
   Sort this before the first store build rather than after it fails.

   Note the capitalised `Clip`. Bundle identifiers are case-sensitive and this one
   is already registered; a lowercase variant matches no profile.
