import SwiftUI

/// Labeled field wrapper — the Swift counterpart of the `Field` helper in
/// `screens/Settings/RegisterVehicle.js`.
struct Field<Content: View>: View {
    let label: String
    var required: Bool = false
    var error: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 0) {
                Text(label)
                if required {
                    Text(" *").foregroundStyle(Theme.danger)
                }
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.inkSoft)

            content

            if let error {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.danger)
            }
        }
    }
}

struct ClipTextField: View {
    let placeholder: String
    @Binding var text: String
    var isInvalid: Bool = false
    var monospaced: Bool = false
    var textCase: TextInputAutocapitalization = .sentences
    var keyboard: UIKeyboardType = .default

    var body: some View {
        TextField("", text: $text, prompt: Text(placeholder).foregroundColor(Theme.placeholder))
            .font(
                monospaced
                    ? .system(size: 17, weight: .semibold, design: .monospaced)
                    : .system(size: 16)
            )
            .foregroundStyle(Theme.ink)
            .textInputAutocapitalization(textCase)
            .autocorrectionDisabled()
            .keyboardType(keyboard)
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Theme.fieldBackground, in: RoundedRectangle(cornerRadius: Theme.corner))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(isInvalid ? Theme.danger : Theme.line, lineWidth: 1)
            )
    }
}

struct SectionHeader: View {
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(Theme.inkMuted)
            Rectangle()
                .fill(Theme.line)
                .frame(height: 1)
        }
    }
}

/// The "I have the Taksis app" switch row, including its custom pill so it
/// matches the in-app control rather than a stock `Toggle`.
struct TaksisToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            withAnimation(.easeOut(duration: 0.18)) { isOn.toggle() }
        } label: {
            HStack(alignment: .center, spacing: 12) {
                ZStack(alignment: isOn ? .trailing : .leading) {
                    Capsule()
                        .fill(isOn ? Theme.accent : Color.white.opacity(0.18))
                        .frame(width: 44, height: 26)
                    Circle()
                        .fill(.white)
                        .frame(width: 20, height: 20)
                        .padding(.horizontal, 3)
                }

                (
                    Text("Taksis App").font(.system(size: 13, weight: .bold))
                        + Text(" — I have it installed ").font(.system(size: 13))
                        + Text("(optional)").font(.system(size: 13).italic())
                        .foregroundColor(Theme.inkMuted)
                )
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)
            }
            .padding(12)
            .background(
                (isOn ? Theme.accent.opacity(0.12) : Color.white.opacity(0.04)),
                in: RoundedRectangle(cornerRadius: Theme.corner)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.corner)
                    .strokeBorder(isOn ? Theme.accent.opacity(0.45) : Theme.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct ColorChip: View {
    let option: VehicleColorOption
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Circle()
                    .fill(option.color)
                    .frame(width: 16, height: 16)
                    .overlay(Circle().strokeBorder(Color.white.opacity(0.25), lineWidth: 1))
                Text(option.label)
                    .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Theme.ink : Theme.inkSoft)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(
                (isSelected ? Theme.accent.opacity(0.16) : Color.white.opacity(0.04)),
                in: Capsule()
            )
            .overlay(
                Capsule().strokeBorder(
                    isSelected ? Theme.accent : Theme.line,
                    lineWidth: 1
                )
            )
        }
        .buttonStyle(.plain)
    }
}

struct CountPill: View {
    let number: Int
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("\(number)")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(isActive ? .white : Theme.inkSoft)
                .frame(width: 46, height: 44)
                .background(
                    (isActive ? Theme.accent : Color.white.opacity(0.05)),
                    in: RoundedRectangle(cornerRadius: Theme.corner)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.corner)
                        .strokeBorder(isActive ? .clear : Theme.line, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
