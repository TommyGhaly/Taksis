import Foundation
import SwiftUI

struct Driver: Identifiable {
    let id = UUID()
    var name: String = ""
    var phone: String = ""
    var hasTaksis: Bool = false
}

@MainActor
final class RegistrationModel: ObservableObject {
    static let maxDrivers = 5

    @Published var plate: String = ""
    @Published var make: String = ""
    @Published var model: String = ""
    @Published var color: String = ""
    @Published var drivers: [Driver] = [Driver()]

    @Published var showErrors = false
    @Published var isSubmitting = false
    @Published var didSubmit = false
    @Published var submitError: String?

    let church = ClipConfig.church

    // MARK: - Validation

    var plateError: String? {
        guard showErrors, plate.trimmed.isEmpty else { return nil }
        return "License plate is required."
    }

    /// Only driver 1 is required, matching the in-app screen and the web form.
    func nameError(at index: Int) -> String? {
        guard showErrors, index == 0 else { return nil }
        let name = drivers[0].name.trimmed
        if name.isEmpty { return "Required." }
        if name.split(whereSeparator: \.isWhitespace).count < 2 {
            return "Please enter first and last name."
        }
        return nil
    }

    func phoneError(at index: Int) -> String? {
        guard showErrors, index == 0, drivers[0].phone.trimmed.isEmpty else { return nil }
        return "Required."
    }

    private var isValid: Bool {
        plateError == nil && nameError(at: 0) == nil && phoneError(at: 0) == nil
    }

    // MARK: - Mutation

    func setDriverCount(_ count: Int) {
        guard count != drivers.count else { return }
        if count < drivers.count {
            drivers.removeSubrange(count..<drivers.count)
        } else {
            drivers.append(contentsOf: (drivers.count..<count).map { _ in Driver() })
        }
    }

    func toggleColor(_ value: String) {
        color = (color == value) ? "" : value
    }

    func reset() {
        plate = ""
        make = ""
        model = ""
        color = ""
        drivers = [Driver()]
        showErrors = false
        didSubmit = false
        submitError = nil
    }

    // MARK: - Submit

    func submit() async {
        showErrors = true
        submitError = nil
        guard isValid else { return }

        isSubmitting = true
        defer { isSubmitting = false }

        // Drop trailing blank driver rows the same way the JS screen does: any
        // driver without a name is not a driver.
        let cleaned = drivers
            .filter { !$0.name.trimmed.isEmpty }
            .map { driver in
                FSValue.map([
                    "name": .string(driver.name.trimmed),
                    "phone": .string(driver.phone.trimmed),
                    "has_taksis": .bool(driver.hasTaksis),
                ])
            }

        var fields: [String: FSValue] = [
            "church": .string(church),
            "license": .string(plate.trimmed.uppercased()),
            "drivers": .array(cleaned),
            "present": .bool(false),
            "status": .string("pending"),
            // The REST API has no server-timestamp sentinel, so send the client
            // clock. TrafficManager does not order on this field; it exists so
            // admins can see roughly when a submission arrived.
            "created_at": .timestamp(Date()),
            "source": .string("ios_app_clip"),
        ]
        if !make.trimmed.isEmpty { fields["make"] = .string(make.trimmed) }
        if !model.trimmed.isEmpty { fields["model"] = .string(model.trimmed) }
        if !color.isEmpty { fields["color"] = .string(color) }

        do {
            try await FirestoreREST.createDocument(
                in: ClipConfig.pendingCollection,
                fields: fields
            )
            didSubmit = true
        } catch {
            submitError = error.localizedDescription
        }
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
