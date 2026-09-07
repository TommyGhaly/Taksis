import SwiftUI

/// Dispatches to the snippet named by the invocation URL.
///
/// The URL always decides — there is never a screen asking the user to pick.
struct RootView: View {
    @StateObject private var router = ClipRouter()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            switch resolved {
            case .registerVehicle:
                RegisterVehicleView()
            case nil:
                UnrecognizedLinkView()
            }
        }
        .preferredColorScheme(.dark)
        // Fires when an already-running clip receives a new invocation.
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            router.resolve(url: activity.webpageURL)
        }
    }

    private var resolved: ClipDestination? {
        #if DEBUG
        // Substitute a default only when no URL arrived at all, which is what a
        // plain simulator run looks like. If a URL *was* supplied and matched
        // nothing, show the real unrecognized state — falling back here instead
        // would make every routing bug look like a success.
        return router.didResolve ? router.destination : ClipDestination.debugDefault
        #else
        return router.destination
        #endif
    }
}

/// Shown when the clip is opened from a URL that maps to no snippet — normally
/// only reachable if an App Clip Experience is registered for a path this binary
/// does not know about.
private struct UnrecognizedLinkView: View {
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "link")
                .font(.system(size: 30))
                .foregroundStyle(Theme.inkMuted)
            Text("Nothing to show")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.ink)
            Text("This link isn't something Taksis can open. Try scanning the code again.")
                .font(.system(size: 15))
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.center)
        }
        .padding(32)
    }
}
