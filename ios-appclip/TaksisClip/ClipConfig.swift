import Foundation

/// Static configuration for the App Clip.
///
/// The clip deliberately does not link the Firebase SDK. App Clips have a hard
/// uncompressed size budget (15 MB on iOS 16+), and the Firebase pods plus
/// their dependencies do not fit alongside anything else. Writing the one
/// document this flow needs over the Firestore REST API keeps the clip at a
/// few hundred kilobytes and matches what `backend/vehicleRegistrationForm.html`
/// already does for the web version of this form.
enum ClipConfig {
    static let firebaseProjectID = "taksis-a8ba7"

    /// Browser-key equivalent used by the existing public web form. This key is
    /// not a secret; access is governed by the Firestore rules on
    /// `pending_registrations`.
    static let firebaseAPIKey = "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA"

    static let pendingCollection = "pending_registrations"

    /// The church these registrations belong to. Hardcoded, matching
    /// `CHURCH_ID` in `backend/vehicleRegistrationForm.html`. If a second church
    /// ever joins the parking program, both this and the web form need a way to
    /// vary it.
    static let church = "St. Philopater and St. Mina, Wayland, MA"

    static var documentsBaseURL: URL {
        URL(string: "https://firestore.googleapis.com/v1/projects/\(firebaseProjectID)/databases/(default)/documents")!
    }
}
