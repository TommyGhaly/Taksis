import Foundation

/// One screen the App Clip can launch into — a "snippet".
///
/// iOS allows an app exactly **one** App Clip target, so every snippet lives in
/// this single clip and is selected by the URL the clip was invoked with. Each
/// destination corresponds to one App Clip Experience registered in App Store
/// Connect, and to one entry in the associated-domain paths.
///
/// To add a snippet:
///  1. Add a case here, with its URL path segment as the raw value.
///  2. Add its view to the `switch` in `RootView`.
///  3. Add a page at `church-site/c/<raw-value>.html` and a rewrite for it in
///     the *church site's* `firebase.json`, so visitors without the app get
///     something. Android has no App Clip equivalent — Instant Apps are gone —
///     so this page is the whole Android no-install path, not a nicety.
///     A snippet that genuinely needs the app can share a "get the app" page,
///     but the URL must still answer 200: a 404 reads as a dead NFC tag.
///  4. Nothing in App Store Connect. The registered experience is the prefix
///     `https://www.spsmwayland.org/c`, which Apple matches against every URL
///     beneath it, so a new snippet is invocable the moment it ships. Register
///     a specific URL only to give one snippet its own card.
///
/// The AASA needs no edit per snippet: it claims `/c/*` once, and its `appclips`
/// key takes App IDs only, never paths.
///
/// Keep each snippet's size in mind: they all ship in one binary, against a
/// single 15 MB budget.
enum ClipDestination: String, CaseIterable, Identifiable {
    case registerVehicle = "register-vehicle"

    var id: String { rawValue }

    /// First path component of every snippet URL.
    ///
    /// Namespacing under one prefix is what keeps nine snippets cheap: the AASA
    /// claims `/c/*` once, and Android needs a single `pathPrefix` intent filter.
    /// Neither is touched again per snippet. It also means the app never claims
    /// an unrelated URL on the church domain.
    ///
    /// Every such URL must be on `www.spsmwayland.org`. The apex 301s there, and
    /// both platforms refuse to follow a redirect for the association files.
    static let pathPrefix = "c"

    /// Where a DEBUG build lands when launched with no invocation URL, which is
    /// what a plain simulator run does. Never consulted in a release build, where
    /// the URL always decides. Change this to work on a different snippet in the
    /// simulator, or pass its URL — see the README.
    #if DEBUG
    static let debugDefault: ClipDestination = .registerVehicle
    #endif

    /// Matches the component after `pathPrefix`, so
    /// `https://www.spsmwayland.org/c/register-vehicle` → `.registerVehicle`.
    /// Query parameters are ignored here; a destination reads its own.
    ///
    /// Returns nil for anything outside the prefix, which surfaces as the
    /// unrecognized-link state rather than silently opening some other snippet.
    static func from(url: URL) -> ClipDestination? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        let segments = components.path.split(separator: "/").map { $0.lowercased() }
        guard segments.count >= 2, segments[0] == pathPrefix else { return nil }
        return ClipDestination(rawValue: segments[1])
    }
}
