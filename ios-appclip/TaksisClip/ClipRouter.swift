import Foundation
import OSLog

/// Resolves which snippet to show from the clip's invocation URL.
@MainActor
final class ClipRouter: ObservableObject {
    @Published private(set) var invocation: ClipDestination.Invocation = .generic
    @Published private(set) var invocationURL: URL?

    /// The invocation URL is the one thing needed to explain a clip that opened
    /// on the wrong screen, and it is invisible from a screenshot — a launch
    /// that delivered no URL and one that delivered an unusable URL look
    /// identical on the device. Logged so `Console.app`, or a sysdiagnose from a
    /// tester, can tell them apart without another build.
    private static let log = Logger(subsystem: "com.tghaly.taksis.Clip", category: "routing")

    init() {
        // Resolved in `init` rather than an `onAppear`/`task` so the first render
        // already has the destination; otherwise the view briefly shows the
        // generic snippet and then swaps.
        resolveDebugEnvironment()
    }

    func resolve(url: URL?) {
        guard let url else { return }
        invocationURL = url
        invocation = ClipDestination.invocation(for: url)
        Self.log.notice(
            "invoked with \(url.absoluteString, privacy: .public) -> \(String(describing: self.invocation), privacy: .public)"
        )
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
            invocationURL == nil,
            let raw = ProcessInfo.processInfo.environment["_XCAppClipURL"],
            let url = URL(string: raw)
        else { return }
        resolve(url: url)
        #endif
    }
}
