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
///  3. Add a page at `public/c/<raw-value>.html` and a rewrite for it in
///     `firebase.json`, so non-iOS visitors get something.
///  4. Register the Advanced App Clip Experience for that URL in App Store
///     Connect.
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
    /// claims `/c/*` once, Android needs a single `pathPrefix` intent filter, and
    /// the apex-to-www redirect in `firebase.json` has one clean prefix to skip.
    /// It also means the app never claims an unrelated URL on the church domain.
    static let pathPrefix = "c"

    /// Where a DEBUG build lands when launched with no invocation URL, which is
    /// what a plain simulator run does. Never consulted in a release build, where
    /// the URL always decides. Change this to work on a different snippet in the
    /// simulator, or pass its URL — see the README.
    #if DEBUG
    static let debugDefault: ClipDestination = .registerVehicle
    #endif

    /// Matches the component after `pathPrefix`, so
    /// `https://spsmwayland.org/c/register-vehicle` → `.registerVehicle`.
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
