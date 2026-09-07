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

So `ClipDestination` is the list of snippets, keyed by URL path, and `RootView`
maps each to a view. Adding one means: a case in `ClipDestination`, a branch in
`RootView`, a path in the AASA `components`, and an Experience in App Store
Connect. The four steps are listed in the doc comment on `ClipDestination`.

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

Bundle identifier: `com.tghaly.taksis.register-vehicle` (must be the app's ID plus a suffix).

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
xcrun simctl install booted ios/build/Debug-iphonesimulator/TaksisClip.app && xcrun simctl launch booted com.tghaly.taksis.register-vehicle
```

Or just open `ios/app.xcworkspace`, pick the **TaksisClip** scheme, and hit Run.

The invocation URL always decides which snippet runs; the user is never asked.
A plain simulator run has no URL, so DEBUG builds fall back to
`ClipDestination.debugDefault` — change that constant to work on a different
snippet, or pass the URL explicitly:

```bash
SIMCTL_CHILD__XCAppClipURL="https://taksis-a8ba7.web.app/register_vehicle" xcrun simctl launch booted com.tghaly.taksis.register-vehicle
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
register one with URL prefix `https://taksis-a8ba7.web.app/register_vehicle` and
bundle ID `com.tghaly.taksis.register-vehicle`. A QR code or NFC tag holding that
URL will then bring up the real App Clip card. Local Experiences bypass the
associated-domain check, so this works before the AASA file is deployed.

## Remaining setup for production (cannot be done from this repo)

1. **Deploy the AASA** — `firebase deploy --only hosting`.

   Two hazards here. `firebase.json`'s `ignore` list contained `**/.*`, which
   would have silently excluded `.well-known` from every deploy; that entry is
   removed and an `application/json` content-type header added. And Firebase Auth
   already publishes its own AASA at this domain — the checked-in file preserves
   its `NOT /__/auth/...` rules verbatim, because dropping them would break
   sign-in universal links. Re-check the `appclips` key survives future deploys.

   Note the `appclips` key takes only App IDs, never paths: which URL maps to
   which snippet is decided by the registered Experience, not by this file.

2. **Register an Advanced App Clip Experience** per snippet in App Store Connect
   under the app's version → App Clip, each with its own URL, title, and image.
   Without one, that snippet cannot be launched from a real code.

3. **Consider a real domain.** Everything points at `taksis-a8ba7.web.app`, the
   default Firebase Hosting domain for this project — chosen only because it is
   the one web host this repo has, and it is what users will read on the App Clip
   card. To move, set `ASSOCIATED_DOMAIN` in `plugins/withVehicleAppClip.js` (the
   single source of truth — the clip's entitlements are generated from it), serve
   the AASA from the new host, and use the new URL when registering Experiences.

   The domain must be one you control and can serve
   `/.well-known/apple-app-site-association` from over HTTPS with no redirects.
   The path (`/register_vehicle`) is unconstrained — it just has to match
   `ClipDestination`'s raw value and the registered Experience.

4. **Serve a real page at the invocation URL.** Right now the hosting rewrite
   sends it to the SPA `index.html`. Apple expects the URL to be a working page
   with a Smart App Banner for non-iOS and non-clip visitors;
   `backend/vehicleRegistrationForm.html` is the obvious candidate.

