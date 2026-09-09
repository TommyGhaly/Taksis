import SwiftUI

/// Dispatches to the snippet named by the invocation URL.
///
/// The URL always decides *which* snippet — there is never a screen asking the
/// user to pick. What it does not get to decide is whether anything shows at
/// all: an invocation that names no snippet opens the generic one rather than a
/// dead end. See `ClipDestination.Invocation`.
struct RootView: View {
    @StateObject private var router = ClipRouter()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            switch router.invocation {
            case .snippet(let destination):
                snippet(destination)
            case .generic:
                snippet(ClipDestination.genericDefault)
            case .unknownSnippet:
                UnrecognizedLinkView()
            }
        }
        .preferredColorScheme(.dark)
        // A real invocation arrives as a browsing-web activity, on both a cold
        // launch and a relaunch of an already-running clip.
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            router.resolve(url: activity.webpageURL)
        }
        // Belt and braces: `onOpenURL` also receives universal links, and which
        // of the two SwiftUI uses has moved between iOS releases. Losing the URL
        // is no longer fatal — it degrades to the generic snippet — but a clip
        // launched from `/c/check-in` should still land on check-in.
        .onOpenURL { url in
            router.resolve(url: url)
        }
    }

    @ViewBuilder
    private func snippet(_ destination: ClipDestination) -> some View {
        switch destination {
        case .registerVehicle:
            RegisterVehicleView()
        }
    }
}

/// Shown when the invocation URL names a snippet this binary does not have —
/// an installed clip meeting a tag from a later release. Every other
/// invocation, including one carrying no URL, opens the generic snippet.
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
        .frame(maxWidth: Theme.contentMaxWidth)
        .padding(32)
    }
}
