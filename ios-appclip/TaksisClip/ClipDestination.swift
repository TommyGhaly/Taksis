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
///     a specific URL only to give one snippet its own card. Note that the
///     prefix itself is an invocation URL — see `genericDefault`.
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

    /// Snippet shown when the invocation does not name one.
    ///
    /// There are more ways for that to happen than the routing table suggests,
    /// and all of them are ordinary:
    ///
    ///  - The **registered experience is the prefix** `https://www.spsmwayland.org/c`,
    ///    and Apple invokes the clip with that URL verbatim when the launch comes
    ///    from the experience itself rather than a full URL someone tapped.
    ///  - The **default App Clip Experience** in App Store Connect carries its own
    ///    URL, which need not be under `/c` at all.
    ///  - **No URL arrives**, which is what a plain simulator run looks like.
    ///
    /// So this is a real destination, not a fallback: it is whatever the generic
    /// card advertises. When a second snippet ships, give the one that must *not*
    /// be reachable generically its own registered experience URL.
    static let genericDefault: ClipDestination = .registerVehicle

    /// What an invocation asks the clip to show.
    ///
    /// The cases are deliberately lopsided. A clip that shows a dead end has
    /// failed — nobody scans a code to be told there is nothing to see — so only
    /// one case is a dead end, and it is the single case where showing something
    /// else would be actively wrong.
    enum Invocation: Equatable {
        /// A snippet this binary has.
        case snippet(ClipDestination)

        /// The URL named a snippet this binary does not have: an installed clip
        /// meeting a tag from a later release. Opening an unrelated snippet here
        /// would be worse than saying so.
        case unknownSnippet(String)

        /// The URL named no snippet — see `genericDefault` for the several
        /// ordinary ways that happens. Opens `genericDefault`.
        case generic
    }

    /// Reads the snippet out of an invocation URL, so
    /// `https://www.spsmwayland.org/c/register-vehicle` → `.snippet(.registerVehicle)`.
    /// Query parameters are ignored here; a destination reads its own.
    ///
    /// A nil URL, the bare `/c` prefix, and any URL off the prefix all come back
    /// `.generic` rather than failing.
    static func invocation(for url: URL?) -> Invocation {
        guard
            let url,
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return .generic }

        let segments = components.path.split(separator: "/").map { $0.lowercased() }
        guard segments.first == pathPrefix, segments.count >= 2 else { return .generic }

        // The no-install web page is literally `c/register-vehicle.html`, so a
        // tag or a shared link can carry the extension. Same snippet.
        var slug = segments[1]
        if slug.hasSuffix(".html") {
            slug.removeLast(5)
        } else if slug.hasSuffix(".htm") {
            slug.removeLast(4)
        }

        guard let destination = ClipDestination(rawValue: slug) else {
            return .unknownSnippet(slug)
        }
        return .snippet(destination)
    }
}
