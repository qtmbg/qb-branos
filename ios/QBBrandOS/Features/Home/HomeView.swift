import SwiftUI

struct HomeView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        QBPage {
            header
            banner
            if let scan = app.latestScan {
                latestScore(scan)
            }
            phasesRail
            architecture
            threeSteps
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBTag(text: "QB BrandOS · Studio")
            if app.brandName.isEmpty {
                QBHeadline(plain: "Idea in,", spotlight: "brand out.", size: QBFont.Step.five)
            } else {
                QBHeadline(plain: app.brandName + ".", spotlight: "In orbit.", size: QBFont.Step.five)
            }
        }
    }

    // The banner copy is a system constant. Verbatim.
    private var banner: some View {
        VStack(alignment: .leading, spacing: QB.Space.xs) {
            (Text("Signal Scan is live. ")
                .font(QBFont.body(QBFont.Step.zero, weight: 700))
             + Text("Free brand diagnostic. 5 minutes to your first insight.")
                .font(QBFont.body(QBFont.Step.zero, weight: 500)))
                .foregroundColor(QB.ink)
                .fixedSize(horizontal: false, vertical: true)
            Button("Run yours →") {
                app.selectedTab = .scan
            }
            .buttonStyle(QBButtonStyle(compact: true))
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard(background: QB.creamWarm)
    }

    private func latestScore(_ scan: ScanRecord) -> some View {
        let verdict = ScanEngine.verdict(for: scan.overall)
        return HStack(spacing: QB.Space.s) {
            QBScoreRing(score: scan.overall, color: verdict.color, diameter: 84)
            VStack(alignment: .leading, spacing: 5) {
                QBMonoLabel(text: "Latest signal")
                Text(verdict.label)
                    .font(QBFont.display(QBFont.Step.one))
                    .foregroundStyle(QB.ink)
                Text(scan.date.formatted(date: .abbreviated, time: .omitted))
                    .font(QBFont.mono(QBFont.Step.minus2))
                    .foregroundStyle(QB.ink50)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .foregroundStyle(QB.ink50)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard(padding: QB.Space.s)
        .onTapGesture { app.selectedTab = .profile }
        .accessibilityAddTraits(.isButton)
    }

    private var phasesRail: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBSectionHeader(
                eyebrow: "The system",
                headline: "Everything your brand needs,",
                spotlight: "built step by step."
            )
            ScrollView(.horizontal) {
                HStack(spacing: QB.Space.s) {
                    ForEach(Array(PhaseCatalog.all.enumerated()), id: \.element.id) { _, phase in
                        VStack(alignment: .leading, spacing: QB.Space.xs) {
                            QBTag(text: "\(phase.number) · \(phase.name)", dot: phaseColor(phase))
                            Text(phase.tools.joined(separator: " · "))
                                .qbBody(QBFont.Step.minus1, color: QB.ink75)
                            Spacer(minLength: 0)
                        }
                        .frame(width: 250, height: 148, alignment: .topLeading)
                        .qbCard(padding: QB.Space.s)
                    }
                }
                .padding(.vertical, QB.Space.xs)
                .padding(.horizontal, 2)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var architecture: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBHeadline(plain: "Twenty agents.", spotlight: "One brain.", size: QBFont.Step.four)
            Text("A connected system, not a toolkit. The output of every tool becomes the intelligence that powers the next, so nothing has to be re-explained. Ever.")
                .qbBody(QBFont.Step.zero, color: QB.ink75)
            Link(destination: URL(string: "https://quantumbranding.ai/foundation")!) {
                Text("Explore BrandOS →")
            }
            .buttonStyle(QBButtonStyle(background: QB.roseDeep, foreground: QB.cream, compact: true))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard(background: QB.paper)
    }

    private var threeSteps: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBHeadline(plain: "Three steps.", spotlight: "That's it.", size: QBFont.Step.four)
            Image("IllusThreeSteps")
                .resizable()
                .scaledToFit()
                .qbIllusCard()
        }
    }

    private func phaseColor(_ phase: Phase) -> Color {
        switch phase.name {
        case "Acquisition": QB.phaseAcquisition
        case "Discovery": QB.phaseDiscovery
        case "Brand Creation": QB.phaseCreation
        case "Content Creation": QB.phaseContent
        case "Execution": QB.phaseExecution
        default: QB.phaseIntelligence
        }
    }
}
