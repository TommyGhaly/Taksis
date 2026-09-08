import SwiftUI
import StoreKit

struct RegisterVehicleView: View {
    @StateObject private var model = RegistrationModel()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            if model.didSubmit {
                SubmittedView(
                    onRegisterAnother: model.reset
                )
                .transition(.opacity)
            } else {
                form
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.didSubmit)
        .preferredColorScheme(.dark)
    }

    private var form: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    howItWorks
                        .padding(.bottom, 28)

                    SectionHeader(title: "VEHICLE INFORMATION")
                        .padding(.bottom, 18)
                    vehicleFields

                    SectionHeader(title: "DRIVERS")
                        .padding(.top, 28)
                        .padding(.bottom, 18)
                    driverFields

                    if let error = model.submitError {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.danger)
                            .padding(.top, 18)
                    }

                    submitButton
                        .padding(.top, 26)

                    Text("Your information is used only for church parking verification.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.inkMuted)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 16)
                        .padding(.bottom, 40)
                }
                .padding(.horizontal, 20)
                .padding(.top, 22)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("CHURCH PARKING PROGRAM")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.8)
                .foregroundStyle(Theme.accent)
            Text("Register Vehicle")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.ink)
            Text(model.church)
                .font(.system(size: 13))
                .foregroundStyle(Theme.inkMuted)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 20)
        .background(Theme.background)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.line).frame(height: 1)
        }
    }

    private var howItWorks: some View {
        HStack(alignment: .top, spacing: 11) {
            Image(systemName: "camera")
                .font(.system(size: 17))
                .foregroundStyle(Theme.accent)
                .padding(.top, 1)

            (
                Text("How it works — ").font(.system(size: 13, weight: .bold))
                    + Text("By submitting this form, your vehicle is registered for the church parking program. ")
                    .font(.system(size: 13))
                    + Text("No stickers are placed on your car.").font(.system(size: 13, weight: .bold))
                    + Text(" Your license plate is simply scanned by camera at the lot to confirm your registration.")
                    .font(.system(size: 13))
            )
            .foregroundStyle(Theme.inkSoft)
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: Theme.corner))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.corner)
                .strokeBorder(Theme.accent.opacity(0.40), lineWidth: 1)
        )
    }

    private var vehicleFields: some View {
        VStack(alignment: .leading, spacing: 18) {
            Field(label: "License Plate", required: true, error: model.plateError) {
                ClipTextField(
                    placeholder: "e.g. NH-ABC1234",
                    text: $model.plate,
                    isInvalid: model.plateError != nil,
                    monospaced: true,
                    textCase: .characters
                )
            }

            HStack(alignment: .top, spacing: 12) {
                Field(label: "Make") {
                    ClipTextField(placeholder: "e.g. Toyota", text: $model.make, textCase: .words)
                }
                Field(label: "Model") {
                    ClipTextField(placeholder: "e.g. Camry", text: $model.model, textCase: .words)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Color")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.inkSoft)

                FlowLayout(spacing: 8) {
                    ForEach(VehicleColorOption.all) { option in
                        ColorChip(
                            option: option,
                            isSelected: model.color == option.value
                        ) {
                            model.toggleColor(option.value)
                        }
                    }
                }
            }
        }
    }

    private var driverFields: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Number of Drivers")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.inkSoft)
                HStack(spacing: 8) {
                    ForEach(1...RegistrationModel.maxDrivers, id: \.self) { n in
                        CountPill(number: n, isActive: model.drivers.count == n) {
                            model.setDriverCount(n)
                        }
                    }
                }
            }

            ForEach(Array(model.drivers.enumerated()), id: \.element.id) { index, _ in
                driverBlock(at: index)
            }
        }
    }

    private func driverBlock(at index: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text("\(index + 1)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 24, height: 24)
                    .background(Theme.accent, in: Circle())
                Text("Driver \(index + 1)")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.05))

            VStack(alignment: .leading, spacing: 16) {
                Field(
                    label: "Full Name",
                    required: index == 0,
                    error: model.nameError(at: index)
                ) {
                    ClipTextField(
                        placeholder: "First and last name",
                        text: $model.drivers[index].name,
                        isInvalid: model.nameError(at: index) != nil,
                        textCase: .words
                    )
                }

                Field(
                    label: "Phone Number",
                    required: index == 0,
                    error: model.phoneError(at: index)
                ) {
                    ClipTextField(
                        placeholder: "(xxx) xxx-xxxx",
                        text: $model.drivers[index].phone,
                        isInvalid: model.phoneError(at: index) != nil,
                        keyboard: .phonePad
                    )
                }

                TaksisToggle(isOn: $model.drivers[index].hasTaksis)
            }
            .padding(14)
        }
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.corner)
                .strokeBorder(Theme.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.corner))
    }

    private var submitButton: some View {
        Button {
            Task { await model.submit() }
        } label: {
            ZStack {
                if model.isSubmitting {
                    ProgressView().tint(.white)
                } else {
                    Text("Submit Registration")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                Theme.accent.opacity(model.isSubmitting ? 0.6 : 1),
                in: RoundedRectangle(cornerRadius: Theme.corner)
            )
        }
        .buttonStyle(.plain)
        .disabled(model.isSubmitting)
    }
}

// MARK: - Success

private struct SubmittedView: View {
    let onRegisterAnother: () -> Void

    /// Offers the full Taksis app once the registration is in. This is the
    /// standard App Clip upgrade path and only appears in the clip.
    @State private var showAppStoreOverlay = true

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            Image(systemName: "checkmark")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(Theme.success)
                .frame(width: 76, height: 76)
                .background(Theme.success.opacity(0.14), in: Circle())
                .overlay(Circle().strokeBorder(Theme.success.opacity(0.35), lineWidth: 1))

            Text("Registration Submitted")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.ink)
                .padding(.top, 22)

            Text("Your vehicle is pending approval. Once reviewed, your license plate will be recognized automatically at the lot — no sticker needed.")
                .font(.system(size: 15))
                .foregroundStyle(Theme.inkSoft)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.top, 12)
                .padding(.horizontal, 8)

            Button(action: onRegisterAnother) {
                Text("Register another vehicle")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: Theme.corner))
            }
            .buttonStyle(.plain)
            .padding(.top, 30)

            Spacer()
        }
        .padding(.horizontal, 28)
        // Leaves room for the App Store overlay card pinned to the bottom.
        .padding(.bottom, 90)
        .appStoreOverlay(isPresented: $showAppStoreOverlay) {
            SKOverlay.AppClipConfiguration(position: .bottom)
        }
    }
}
