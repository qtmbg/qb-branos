import SwiftUI

// The Quantum Brand Profile. One profile, every tool reads it.
struct ProfileView: View {
    @Environment(AppState.self) private var app
    @State private var editingName = ""
    @State private var nameSaved = false
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            QBPage {
                header
                if app.scans.isEmpty && app.brandName.isEmpty && app.door == nil {
                    emptyState
                } else {
                    brandBlock
                    if !app.scans.isEmpty {
                        history
                    }
                    handoff
                }
            }
            .navigationDestination(for: ScanRecord.self) { scan in
                ScanResultsView(record: scan)
                    .toolbarBackground(QB.cream, for: .navigationBar)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundStyle(QB.ink)
                    }
                }
            }
            .toolbarBackground(QB.cream, for: .navigationBar)
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
        }
        .onAppear { editingName = app.brandName }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBTag(text: "Quantum Brand Profile")
            QBHeadline(
                plain: app.brandName.isEmpty ? "Your" : app.brandName + ".",
                spotlight: app.brandName.isEmpty ? "Brand Profile." : "On record.",
                size: QBFont.Step.five
            )
            Text("One profile, every tool reads it. Nothing drifts. Everything compounds.")
                .qbBody(QBFont.Step.zero, color: QB.ink75)
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            Text("No Brand Profile yet.")
                .font(QBFont.display(QBFont.Step.two))
                .foregroundStyle(QB.ink)
            Text("Start with Signal Scan to begin.")
                .qbBody(QBFont.Step.zero, color: QB.ink75)
            Button("Run the scan →") {
                app.selectedTab = .scan
            }
            .buttonStyle(QBButtonStyle(compact: true))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard()
    }

    private var brandBlock: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBMonoLabel(text: "Brand name")
            HStack(spacing: 10) {
                TextField("Your brand's name", text: $editingName)
                    .font(QBFont.body(QBFont.Step.one, weight: 600))
                    .foregroundStyle(QB.ink)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .onSubmit(saveName)
                if editingName != app.brandName {
                    Button("Save", action: saveName)
                        .font(QBFont.mono(QBFont.Step.minus1))
                        .foregroundStyle(QB.tealDeep)
                } else if nameSaved {
                    QBMonoLabel(text: "Saved.", color: QB.phaseDiscovery)
                }
            }
            .padding(QB.Space.xs)
            .background(RoundedRectangle(cornerRadius: QB.Radius.box).fill(QB.cream))
            .overlay(RoundedRectangle(cornerRadius: QB.Radius.box).stroke(QB.ink, lineWidth: QB.borderWidth))

            if let door = app.door {
                QBMonoLabel(text: "Your door")
                HStack(spacing: QB.Space.s) {
                    Image(door.illustration)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: QB.Radius.box))
                        .overlay(RoundedRectangle(cornerRadius: QB.Radius.box).stroke(QB.ink, lineWidth: 1))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(door.number) · \(door.name)")
                            .font(QBFont.body(QBFont.Step.minus1, weight: 600))
                            .foregroundStyle(QB.ink)
                        Text(door.line)
                            .font(QBFont.body(QBFont.Step.minus2))
                            .foregroundStyle(QB.ink75)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard()
    }

    private var history: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBMonoLabel(text: "Signal history")
            ForEach(app.scans) { scan in
                NavigationLink(value: scan) {
                    HStack(spacing: QB.Space.s) {
                        Text("\(scan.overall)")
                            .font(QBFont.display(QBFont.Step.two))
                            .foregroundStyle(ScanEngine.verdict(for: scan.overall).color)
                            .frame(width: 56)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(scan.verdictLabel)
                                .font(QBFont.body(QBFont.Step.minus1, weight: 600))
                                .foregroundStyle(QB.ink)
                            Text(scan.date.formatted(date: .abbreviated, time: .omitted))
                                .font(QBFont.mono(QBFont.Step.minus2))
                                .foregroundStyle(QB.ink50)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .foregroundStyle(QB.ink50)
                    }
                    .padding(QB.Space.xs)
                    .background(RoundedRectangle(cornerRadius: QB.Radius.cardSmall).fill(QB.cream))
                    .overlay(RoundedRectangle(cornerRadius: QB.Radius.cardSmall).stroke(QB.ink, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard()
    }

    private var handoff: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBHeadline(plain: "Continue on", spotlight: "the web.", size: QBFont.Step.three)
            Text("Phase 01 is four exercises that surface your brand's truth. Free, at your own pace, and every result lands in this profile.")
                .qbBody(QBFont.Step.minus1, color: QB.ink75)
            Link(destination: URL(string: "https://quantumbranding.ai/foundation")!) {
                Text("Enter QB BrandOS")
            }
            .buttonStyle(QBButtonStyle(compact: true))
            if app.qbpSpine != nil {
                ShareLink(item: app.qbpJSON, preview: SharePreview("Quantum Brand Profile")) {
                    Text("Share profile JSON")
                        .font(QBFont.mono(QBFont.Step.minus1))
                        .foregroundStyle(QB.ink50)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard(background: QB.paper)
    }

    private func saveName() {
        app.brandName = editingName.trimmingCharacters(in: .whitespacesAndNewlines)
        nameSaved = true
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            nameSaved = false
        }
    }
}
