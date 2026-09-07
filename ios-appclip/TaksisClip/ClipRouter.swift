import Foundation

/// Resolves which snippet to show from the clip's invocation URL.
@MainActor
final class ClipRouter: ObservableObject {
    @Published private(set) var destination: ClipDestination?
    @Published private(set) var invocationURL: URL?

    /// True once a URL has been seen, which distinguishes "launched with no URL"
    /// from "launched with a URL that matched no snippet".
    @Published private(set) var didResolve = false

    init() {
        // Resolved in `init` rather than an `onAppear`/`task` so the first render
        // already has the destination; otherwise the view briefly shows the
        // fallback and then swaps.
        resolveDebugEnvironment()
    }

    func resolve(url: URL?) {
        guard let url else { return }
        invocationURL = url
        destination = ClipDestination.from(url: url)
        didResolve = true
    }

    /// Picks up the invocation URL when running from Xcode or `simctl`.
    ///
    /// A simulator has no real App Clip invocation. Xcode passes the URL from the
    /// scheme's `_XCAppClipURL` field, and `simctl launch` can pass it as
    /// `SIMCTL_CHILD__XCAppClipURL`. In neither case does iOS synthesize the
    /// `NSUserActivity` that a real launch delivers, so read the variable
    /// directly — otherwise there is no way to exercise routing off-device.
    ///
    /// DEBUG-only: `_XCAppClipURL` is never set in a shipped clip, but gating it
    /// keeps it out of release builds entirely.
    func resolveDebugEnvironment() {
        #if DEBUG
        guard
            destination == nil,
            let raw = ProcessInfo.processInfo.environment["_XCAppClipURL"],
            let url = URL(string: raw)
        else { return }
        resolve(url: url)
        #endif
    }
}
