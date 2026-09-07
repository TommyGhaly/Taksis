import Foundation

/// One screen the App Clip can launch into — a "snippet".
///
/// iOS allows an app exactly **one** App Clip target, so every snippet lives in
/// this single clip and is selected by the URL the clip was invoked with. Each
/// destination corresponds to one App Clip Experience registered in App Store
/// Connect, and to one entry in the associated-domain paths.
///
/// To add a snippet:
///  1. Add a case here, with the URL path as its raw value.
///  2. Add its view to the `switch` in `RootView`.
///  3. Add the path to `components` in
///     `public/.well-known/apple-app-site-association`.
///  4. Register the Advanced App Clip Experience for that URL in App Store
///     Connect.
///
/// Keep each snippet's size in mind: they all ship in one binary, against a
/// single 15 MB budget.
enum ClipDestination: String, CaseIterable, Identifiable {
    case registerVehicle = "register_vehicle"

    var id: String { rawValue }

    /// Where a DEBUG build lands when launched with no invocation URL, which is
    /// what a plain simulator run does. Never consulted in a release build, where
    /// the URL always decides. Change this to work on a different snippet in the
    /// simulator, or pass its URL — see the README.
    #if DEBUG
    static let debugDefault: ClipDestination = .registerVehicle
    #endif

    /// Matches on the first path component, so
    /// `https://taksis-a8ba7.web.app/register-vehicle` → `.registerVehicle`.
    /// Query parameters are ignored here; a destination reads its own.
    static func from(url: URL) -> ClipDestination? {
        guard
            let first = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .path
                .split(separator: "/")
                .first
        else { return nil }
        return ClipDestination(rawValue: String(first).lowercased())
    }
}
