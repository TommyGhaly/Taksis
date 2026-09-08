import SwiftUI

/// The Taksis App Clip.
///
/// iOS permits one App Clip target per app, so every snippet ships here and
/// `RootView` picks one based on the invocation URL. See `ClipDestination` for
/// how to add another. No Firebase SDK and no pods — see `ClipConfig`.
@main
struct TaksisClipApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
