import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var confirmErase = false

    private var version: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }

    var body: some View {
        ZStack {
            QB.cream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: QB.Space.m) {
                    HStack {
                        QBTag(text: "Settings")
                        Spacer()
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .foregroundStyle(QB.ink)
                        }
                    }
                    .padding(.top, QB.Space.s)

                    VStack(alignment: .leading, spacing: QB.Space.s) {
                        QBMonoLabel(text: "Your door")
                        ForEach(Door.allCases) { door in
                            Button {
                                app.door = door
                            } label: {
                                HStack(spacing: 10) {
                                    Circle()
                                        .strokeBorder(QB.ink, lineWidth: 2)
                                        .background(Circle().fill(app.door == door ? QB.gold : .clear))
                                        .frame(width: 16, height: 16)
                                    Text("\(door.number) · \(door.name)")
                                        .font(QBFont.body(QBFont.Step.minus1, weight: 500))
                                        .foregroundStyle(QB.ink)
                                    Spacer(minLength: 0)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .qbCard(padding: QB.Space.s)

                    VStack(alignment: .leading, spacing: QB.Space.s) {
                        QBMonoLabel(text: "Data")
                        Text("Everything lives on this device. Scans, profile, all of it. Nothing is collected unless you send yourself a report.")
                            .qbBody(QBFont.Step.minus1, color: QB.ink75)
                        Button("Erase everything") {
                            confirmErase = true
                        }
                        .buttonStyle(QBButtonStyle(background: QB.roseDeep, foreground: QB.cream, compact: true))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .qbCard(padding: QB.Space.s)

                    VStack(alignment: .leading, spacing: QB.Space.xs) {
                        QBMonoLabel(text: "About")
                        HStack(spacing: QB.Space.s) {
                            Link("Privacy", destination: URL(string: "https://quantumbranding.ai/privacy")!)
                            Link("Terms", destination: URL(string: "https://quantumbranding.ai/terms")!)
                        }
                        .font(QBFont.mono(QBFont.Step.minus1))
                        .foregroundStyle(QB.tealDeep)
                        Text("Fraunces, Inter, and JetBrains Mono are bundled under the SIL Open Font License.")
                            .qbBody(QBFont.Step.minus2, color: QB.ink50)
                        QBMonoLabel(text: "Version \(version)", color: QB.ink33)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .qbCard(padding: QB.Space.s)
                }
                .padding(.horizontal, QB.Space.s)
                .padding(.bottom, QB.Space.xl)
            }
            .scrollIndicators(.hidden)
        }
        .confirmationDialog(
            "Erase everything?",
            isPresented: $confirmErase,
            titleVisibility: .visible
        ) {
            Button("Erase everything", role: .destructive) {
                app.eraseEverything()
                dismiss()
            }
            Button("Keep my data", role: .cancel) {}
        } message: {
            Text("Your profile and every scan on this device will be removed. This cannot be undone.")
        }
    }
}
