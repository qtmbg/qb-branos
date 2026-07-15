import SwiftUI

// The system explained: six phases, four doors, the connected architecture.
struct SystemView: View {
    var body: some View {
        QBPage {
            QBSectionHeader(
                eyebrow: "The system",
                headline: "Everything your brand needs,",
                spotlight: "built step by step.",
                subhead: "Six phases. Twenty agents. One connected brain that never asks you to repeat yourself."
            )
            phases
            doors
            ecosystem
            about
        }
    }

    private var phases: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            ForEach(PhaseCatalog.all) { phase in
                VStack(alignment: .leading, spacing: QB.Space.xs) {
                    QBTag(text: "\(phase.number) · \(phase.name)", dot: color(for: phase))
                    Text(phase.tools.joined(separator: " · "))
                        .qbBody(QBFont.Step.minus1, color: QB.ink75)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .qbCard(padding: QB.Space.s)
                .padding(.bottom, 4)
            }
        }
    }

    private var doors: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBSectionHeader(
                eyebrow: "Four doors",
                headline: "QB is made",
                spotlight: "for you.",
                subhead: "Different entry points into the same system. Each door is a person, not a feature."
            )
            ForEach(Door.allCases) { door in
                HStack(spacing: QB.Space.s) {
                    Image(door.illustration)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 72, height: 72)
                        .clipShape(RoundedRectangle(cornerRadius: QB.Radius.box))
                        .overlay(RoundedRectangle(cornerRadius: QB.Radius.box).stroke(QB.ink, lineWidth: 1))
                    VStack(alignment: .leading, spacing: 4) {
                        QBMonoLabel(text: "\(door.number) · \(door.name)")
                        Text(door.line)
                            .font(QBFont.display(QBFont.Step.one))
                            .foregroundStyle(QB.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .qbCard(padding: QB.Space.s)
                .padding(.bottom, 4)
            }
        }
    }

    private var ecosystem: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBHeadline(plain: "A connected system,", spotlight: "not a toolkit.", size: QBFont.Step.three)
            Image("IllusSynergy")
                .resizable()
                .scaledToFit()
                .qbIllusCard()
            Text("The output of every tool becomes the intelligence that powers the next, so nothing has to be re-explained. Ever.")
                .qbBody(QBFont.Step.zero, color: QB.ink75)
        }
    }

    private var about: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            Rectangle().fill(QB.ink25).frame(height: 1)
            QBMonoLabel(text: "quantum branding · QB BrandOS")
            HStack(spacing: QB.Space.s) {
                Link("Website", destination: URL(string: "https://quantumbranding.ai")!)
                Link("Privacy", destination: URL(string: "https://quantumbranding.ai/privacy")!)
                Link("Terms", destination: URL(string: "https://quantumbranding.ai/terms")!)
            }
            .font(QBFont.mono(QBFont.Step.minus1))
            .foregroundStyle(QB.tealDeep)
            Text("The Brand Operating System. From idea to orbit. Identity, look, voice, content, strategy. One connected platform.")
                .qbBody(QBFont.Step.minus2, color: QB.ink50)
        }
    }

    private func color(for phase: Phase) -> Color {
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
