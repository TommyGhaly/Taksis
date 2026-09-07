import SwiftUI

/// Colors and metrics lifted from `screens/Settings/RegisterVehicle.js` so the
/// clip and the in-app screen read as the same surface.
enum Theme {
    static let accent = Color(hex: 0x147EFB)
    static let background = Color(hex: 0x121212)
    static let card = Color(hex: 0x1C1C1E)
    static let success = Color(hex: 0x34C759)
    static let danger = Color(hex: 0xFF453A)

    static let ink = Color.white
    static let inkSoft = Color.white.opacity(0.62)
    static let inkMuted = Color.white.opacity(0.38)
    static let placeholder = Color.white.opacity(0.30)
    static let line = Color.white.opacity(0.10)
    static let fieldBackground = Color.white.opacity(0.06)

    static let corner: CGFloat = 12
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

/// Mirrors `COLOR_OPTIONS` in `components/TrafficVehicleComponents.js`. The
/// `value` strings are what get written to Firestore, so they must stay in sync
/// with the JS list or the admin UI will not recognize them.
struct VehicleColorOption: Identifiable, Hashable {
    let label: String
    let value: String
    let hex: UInt32

    var id: String { value }
    var color: Color { Color(hex: hex) }

    static let all: [VehicleColorOption] = [
        .init(label: "White",  value: "white",  hex: 0xFFFFFF),
        .init(label: "Black",  value: "black",  hex: 0x1A1A1A),
        .init(label: "Silver", value: "silver", hex: 0xC0C0C0),
        .init(label: "Gray",   value: "gray",   hex: 0x808080),
        .init(label: "Red",    value: "red",    hex: 0xD32F2F),
        .init(label: "Blue",   value: "blue",   hex: 0x1976D2),
        .init(label: "Green",  value: "green",  hex: 0x388E3C),
        .init(label: "Brown",  value: "brown",  hex: 0x795548),
        .init(label: "Beige",  value: "beige",  hex: 0xD4C5A9),
        .init(label: "Orange", value: "orange", hex: 0xF57C00),
        .init(label: "Yellow", value: "yellow", hex: 0xFBC02D),
        .init(label: "Gold",   value: "gold",   hex: 0xFFD700),
    ]
}
