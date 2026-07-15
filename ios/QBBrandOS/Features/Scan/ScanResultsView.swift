import SwiftUI

// The Brand Signal Report. Score ring, dimension breakdown, structural gap,
// deep reading (Gemini through the server proxy), recommended first move,
// optional email delivery. Copy is verbatim from the production scan.
struct ScanResultsView: View {
    @Environment(AppState.self) private var app

    @State var record: ScanRecord
    var onRunAnother: (() -> Void)?

    private enum ReadingState: Equatable {
        case loading
        case done(String)
        case failed
    }
    @State private var reading: ReadingState = .loading
    @State private var readingRounds = 0

    private enum EmailState: Equatable {
        case idle, invalid, sending, sent, failed
    }
    @State private var email = ""
    @State private var emailState: EmailState = .idle

    private var verdict: ScanVerdict { ScanEngine.verdict(for: record.overall) }
    private var path: ScanPath {
        ScanEngine.recommendedPath(
            moment: record.moment,
            topGap: ScanDimensionScore(id: record.topGapId, label: record.topGapLabel, score: 0)
        )
    }

    var body: some View {
        ZStack {
            QB.cream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: QB.Space.m) {
                    header
                    scoreBlock
                    dimensionCard
                    gapCard
                    readingCard
                    pathCard
                    emailCard
                    footer
                }
                .padding(.horizontal, QB.Space.s)
                .padding(.top, QB.Space.s)
                .padding(.bottom, QB.Space.xl)
            }
            .scrollIndicators(.hidden)
        }
        .task {
            if let saved = record.deepReading {
                reading = .done(saved)
            } else {
                await fetchReading()
            }
        }
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: QB.Space.xs) {
            QBMonoLabel(text: "Brand Signal Report")
            QBHeadline(plain: "Your intelligence", spotlight: "brief.", size: QBFont.Step.four)
            Text("Based on 6 brand health dimensions")
                .qbBody(QBFont.Step.minus1, color: QB.ink50)
        }
    }

    private var scoreBlock: some View {
        VStack(spacing: QB.Space.s) {
            QBScoreRing(score: record.overall, color: verdict.color)
            HStack(spacing: 10) {
                Text(record.grade)
                    .font(QBFont.display(QBFont.Step.zero))
                    .foregroundStyle(verdict.color)
                QBMonoLabel(text: verdict.label, color: QB.ink)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 18)
            .background(Capsule().fill(verdict.color.opacity(0.2)))
            Text(verdict.desc)
                .qbBody(QBFont.Step.zero, color: QB.ink75)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private var dimensionCard: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBMonoLabel(text: "Dimension breakdown")
            ForEach(Array(record.dims.enumerated()), id: \.element.id) { index, dim in
                let isGap = dim.id == record.topGapId
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(isGap ? "\(dim.label) ← primary gap" : dim.label)
                            .font(QBFont.body(QBFont.Step.minus1, weight: isGap ? 600 : 500))
                            .foregroundStyle(isGap ? QB.ink : QB.ink75)
                        Spacer()
                        Text("\(dim.score)%")
                            .font(QBFont.mono(QBFont.Step.minus1))
                            .foregroundStyle(ScanEngine.barColor(for: dim.score))
                    }
                    QBGapBar(
                        score: dim.score,
                        color: ScanEngine.barColor(for: dim.score),
                        delay: 0.2 + Double(index) * 0.08
                    )
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard()
    }

    private var gapCard: some View {
        VStack(alignment: .leading, spacing: QB.Space.xs) {
            QBMonoLabel(text: "Structural gap: \(record.topGapLabel)", color: verdict.color)
            Text(ScanEngine.gapCopy(for: record.topGapId))
                .qbBody(QBFont.Step.zero, color: QB.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard(background: QB.paper)
    }

    private var readingCard: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBTag(text: "Deep reading", dot: QB.phaseIntelligence)
            switch reading {
            case .loading:
                VStack(alignment: .leading, spacing: 10) {
                    QBSkeleton()
                    QBSkeleton()
                    QBSkeleton(height: 14)
                    QBMonoLabel(text: "Drafting in your voice…", color: QB.ink50)
                }
            case .done(let text):
                Text(text)
                    .qbBody(QBFont.Step.zero, color: QB.ink)
                if readingRounds < 3 {
                    Button("Read it again") {
                        Task { await fetchReading(force: true) }
                    }
                    .font(QBFont.mono(QBFont.Step.minus1))
                    .foregroundStyle(QB.ink50)
                }
            case .failed:
                Text("Synthesis was unavailable. The diagnostic was scored but the deep reading could not be generated. Try again in a moment.")
                    .qbBody(QBFont.Step.minus1, color: QB.ink75)
                Button("Try again") {
                    Task { await fetchReading(force: true) }
                }
                .buttonStyle(QBButtonStyle(compact: true))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard()
    }

    private var pathCard: some View {
        VStack(alignment: .leading, spacing: QB.Space.xs) {
            QBMonoLabel(text: "Recommended first move", color: QB.phaseDiscovery)
            Text(path.tool)
                .font(QBFont.display(QBFont.Step.one))
                .foregroundStyle(QB.ink)
            Text(path.desc)
                .qbBody(QBFont.Step.minus1, color: QB.ink75)
            Link(destination: path.url) {
                Text("Open \(path.tool) →")
            }
            .buttonStyle(QBButtonStyle(compact: true))
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard()
    }

    private var emailCard: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            if emailState == .sent {
                QBMonoLabel(text: "Results on the way. Check your inbox.", color: QB.phaseDiscovery)
                Text("Check your spam folder if you don't see it within 2 minutes.")
                    .qbBody(QBFont.Step.minus1, color: QB.ink50)
            } else {
                Text("Your scan, in your inbox.")
                    .font(QBFont.display(QBFont.Step.one))
                    .foregroundStyle(QB.ink)
                Text("Enter your email to receive your complete Brand Signal Report. Your score, the gaps, and the exact first move.")
                    .qbBody(QBFont.Step.minus1, color: QB.ink75)
                TextField("your@email.com", text: $email)
                    .font(QBFont.body(QBFont.Step.zero))
                    .foregroundStyle(QB.ink)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(QB.Space.xs)
                    .background(RoundedRectangle(cornerRadius: QB.Radius.box).fill(QB.cream))
                    .overlay(
                        RoundedRectangle(cornerRadius: QB.Radius.box)
                            .stroke(emailState == .invalid ? QB.roseDeep : QB.ink, lineWidth: QB.borderWidth)
                    )
                if emailState == .failed {
                    Text("We couldn't reach the service. Try again in a moment.")
                        .qbBody(QBFont.Step.minus2, color: QB.roseDeep)
                }
                Button(emailState == .sending ? "Sending…" : "Send my report →") {
                    Task { await sendEmail() }
                }
                .buttonStyle(QBButtonStyle(expand: true))
                .disabled(emailState == .sending)
                Text("No spam. No sales sequences. Just your intelligence report.")
                    .font(QBFont.mono(QBFont.Step.minus2))
                    .foregroundStyle(QB.ink50)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .qbCard(background: QB.creamWarm)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            Rectangle().fill(QB.ink25).frame(height: 1)
            Text("Want the full system? QB BrandOS takes you from this scan through every phase: identity, visual system, voice, content, and execution. All connected.")
                .qbBody(QBFont.Step.minus1, color: QB.ink75)
            Link(destination: URL(string: "https://quantumbranding.ai/foundation")!) {
                Text("Explore BrandOS →")
            }
            .buttonStyle(QBButtonStyle(background: QB.roseDeep, foreground: QB.cream, compact: true))
            if let onRunAnother {
                Button("Run another scan") {
                    onRunAnother()
                }
                .font(QBFont.mono(QBFont.Step.minus1))
                .foregroundStyle(QB.ink50)
            }
        }
    }

    // MARK: - Actions

    private func fetchReading(force: Bool = false) async {
        if force { readingRounds += 1 }
        reading = .loading
        do {
            let text = try await QBAPI.deepReading(for: record, brandName: app.brandName)
            reading = .done(text)
            record.deepReading = text
            app.save(scan: record)
        } catch {
            reading = .failed
        }
    }

    private func sendEmail() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard QBAPI.isValidEmail(trimmed) else {
            emailState = .invalid
            return
        }
        emailState = .sending
        let ok = await QBAPI.sendReport(email: trimmed, scan: record)
        emailState = ok ? .sent : .failed
    }
}
