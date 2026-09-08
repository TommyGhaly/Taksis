import Foundation

/// Minimal encoder for Firestore's REST document representation.
///
/// Firestore's REST API does not accept plain JSON; every field must be wrapped
/// in a type tag (`stringValue`, `booleanValue`, `arrayValue`, `mapValue`). This
/// mirrors the `fsStr` / `fsBool` / `fsArr` / `fsMap` helpers in
/// `backend/vehicleRegistrationForm.html`.
enum FSValue {
    case string(String)
    case bool(Bool)
    case timestamp(Date)
    case array([FSValue])
    case map([String: FSValue])

    var json: [String: Any] {
        switch self {
        case .string(let v):
            return ["stringValue": v]
        case .bool(let v):
            return ["booleanValue": v]
        case .timestamp(let date):
            return ["timestampValue": ISO8601DateFormatter.firestore.string(from: date)]
        case .array(let values):
            return ["arrayValue": ["values": values.map(\.json)]]
        case .map(let fields):
            return ["mapValue": ["fields": fields.mapValues(\.json)]]
        }
    }
}

extension ISO8601DateFormatter {
    static let firestore: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f
    }()
}

enum FirestoreError: LocalizedError {
    case badResponse
    case server(status: Int, message: String?)

    var errorDescription: String? {
        switch self {
        case .badResponse:
            return "The server sent an unexpected response."
        case .server(let status, let message):
            return message ?? "The server returned an error (\(status))."
        }
    }
}

struct FirestoreREST {
    /// Creates a document in `collection` with an auto-generated ID.
    static func createDocument(
        in collection: String,
        fields: [String: FSValue],
        session: URLSession = .shared
    ) async throws {
        var components = URLComponents(
            url: ClipConfig.documentsBaseURL.appendingPathComponent(collection),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [URLQueryItem(name: "key", value: ClipConfig.firebaseAPIKey)]

        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(
            withJSONObject: ["fields": fields.mapValues(\.json)]
        )
        request.timeoutInterval = 30

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw FirestoreError.badResponse }
        guard (200..<300).contains(http.statusCode) else {
            throw FirestoreError.server(status: http.statusCode, message: errorMessage(from: data))
        }
    }

    private static func errorMessage(from data: Data) -> String? {
        guard
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let error = root["error"] as? [String: Any],
            let message = error["message"] as? String
        else { return nil }
        return message
    }
}
