import SwiftUI

// Native port of the Signal Scan state machine.
// Step 0 intro · 1-8 questions · 9 analyzing · 10 results.
struct ScanFlowView: View {
    @Environment(AppState.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var step = 0
    @State private var answers: [String: Int] = [:]
    @State private var describeText = ""
    @State private var record: ScanRecord?
    @State private var advancing = false

    var body: some View {
        ZStack {
            QB.cream.ignoresSafeArea()
            switch step {
            case 0:
                intro
            case 1...8:
                question(ScanEngine.questions[step - 1])
            case 9:
                analyzing
            default:
                if let record {
                    ScanResultsView(record: record, onRunAnother: reset)
                }
            }
        }
        .animation(reduceMotion ? nil : QB.easeQB, value: step)
    }

    // MARK: - Intro

    private var intro: some View {
        VStack(alignment: .leading, spacing: QB.Space.m) {
            Spacer()
            QBTag(text: "QB BrandOS · Intelligence", dot: QB.phaseAcquisition)
            QBHeadline(plain: "Brand", spotlight: "Signal Scan", size: QBFont.Step.five)
            Text("8 questions. 5 minutes. A precise read on where your brand is strong, where it is losing you money, and exactly what to do first.")
                .qbBody(QBFont.Step.zero, color: QB.ink75)
            HStack(spacing: QB.Space.s) {
                feature("5 minutes")
                feature("Instant score")
                feature("No credit card")
            }
            Spacer()
            Button("Start the scan →") {
                step = 1
            }
            .buttonStyle(QBButtonStyle(expand: true))
            Text("Used by 1,000+ founders and brand builders.")
                .font(QBFont.mono(QBFont.Step.minus2))
                .foregroundStyle(QB.ink50)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, QB.Space.m)
        .padding(.bottom, QB.Space.s)
        .transition(.opacity)
    }

    private func feature(_ label: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(QB.gold).frame(width: 6, height: 6)
            Text(label)
                .font(QBFont.mono(QBFont.Step.minus2))
                .foregroundStyle(QB.ink75)
        }
    }

    // MARK: - Questions

    private func question(_ q: ScanQuestion) -> some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            progress
            if step > 1 {
                Button("← Back") {
                    step -= 1
                }
                .font(QBFont.mono(QBFont.Step.minus1))
                .foregroundStyle(QB.ink50)
            }
            Text(q.question)
                .font(QBFont.display(QBFont.Step.three))
                .foregroundStyle(QB.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(q.sub)
                .qbBody(QBFont.Step.minus1, color: QB.ink50)

            if q.kind == .choice {
                choiceList(q)
            } else {
                textEntry(q)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, QB.Space.m)
        .padding(.top, QB.Space.s)
        .transition(.opacity)
    }

    private var progress: some View {
        VStack(spacing: 8) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(QB.ink.opacity(0.08))
                    Capsule()
                        .fill(QB.gold)
                        .frame(width: geo.size.width * CGFloat(step) / 8)
                }
            }
            .frame(height: 8)
            HStack {
                QBMonoLabel(text: "Step \(step) of 8")
                Spacer()
                QBMonoLabel(text: "\(Int((Double(step) / 8 * 100).rounded()))%", color: QB.ink50)
            }
        }
        .padding(.top, QB.Space.s)
    }

    private func choiceList(_ q: ScanQuestion) -> some View {
        VStack(spacing: 10) {
            ForEach(q.options) { opt in
                Button {
                    guard !advancing else { return }
                    answers[q.id] = opt.value
                    if step < 8 {
                        advancing = true
                        Task {
                            try? await Task.sleep(nanoseconds: 250_000_000)
                            step += 1
                            advancing = false
                        }
                    }
                } label: {
                    HStack(spacing: 12) {
                        Circle()
                            .strokeBorder(QB.ink, lineWidth: 2)
                            .background(Circle().fill(answers[q.id] == opt.value ? QB.gold : .clear))
                            .frame(width: 18, height: 18)
                        Text(opt.label)
                            .font(QBFont.body(QBFont.Step.minus1, weight: 500))
                            .foregroundStyle(QB.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(QB.Space.s)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: QB.Radius.cardSmall)
                            .fill(answers[q.id] == opt.value ? QB.creamWarm : QB.creamCard)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: QB.Radius.cardSmall)
                            .stroke(QB.ink, lineWidth: answers[q.id] == opt.value ? 2 : 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, QB.Space.xs)
    }

    private func textEntry(_ q: ScanQuestion) -> some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            TextEditor(text: $describeText)
                .font(QBFont.body(QBFont.Step.minus1))
                .foregroundStyle(QB.ink)
                .scrollContentBackground(.hidden)
                .padding(QB.Space.xs)
                .frame(height: 130)
                .background(RoundedRectangle(cornerRadius: QB.Radius.box).fill(QB.creamCard))
                .overlay(RoundedRectangle(cornerRadius: QB.Radius.box).stroke(QB.ink, lineWidth: QB.borderWidth))
            Button("Continue →") {
                finishScan()
            }
            .buttonStyle(QBButtonStyle(expand: true))
        }
        .padding(.top, QB.Space.xs)
    }

    // MARK: - Analyzing

    private var analyzing: some View {
        VStack(spacing: QB.Space.s) {
            SpinnerView()
            QBMonoLabel(text: "Compiling intelligence", color: QB.ink)
            Text("Reading answers through the brand lens.")
                .qbBody(QBFont.Step.minus1, color: QB.ink50)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .transition(.opacity)
    }

    // MARK: - Flow

    private func finishScan() {
        let describe = describeText.trimmingCharacters(in: .whitespacesAndNewlines)
        let momentIndex = answers["moment"] ?? 0
        let moment = ScanEngine.momentKeys[min(max(momentIndex, 0), 3)]
        let (overall, dims) = ScanEngine.calcScores(answers: answers)
        let verdict = ScanEngine.verdict(for: overall)
        let gap = ScanEngine.topGap(dims: dims)

        let scan = ScanRecord(
            overall: overall,
            grade: verdict.grade,
            verdictLabel: verdict.label,
            dims: dims,
            topGapId: gap.id,
            topGapLabel: gap.label,
            moment: moment,
            describe: describe.isEmpty ? "Not specified" : describe
        )
        record = scan
        app.save(scan: scan)
        step = 9
        Task {
            try? await Task.sleep(nanoseconds: 3_200_000_000)
            step = 10
        }
    }

    private func reset() {
        step = 0
        answers = [:]
        describeText = ""
        record = nil
    }
}

private struct SpinnerView: View {
    @State private var spinning = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle()
                .stroke(QB.ink.opacity(0.1), lineWidth: 5)
            Circle()
                .trim(from: 0, to: 0.28)
                .stroke(QB.gold, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(spinning ? 360 : 0))
            Circle()
                .trim(from: 0.5, to: 0.64)
                .stroke(QB.phaseDiscovery, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(spinning ? 360 : 0))
        }
        .frame(width: 56, height: 56)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 1.1).repeatForever(autoreverses: false)) {
                spinning = true
            }
        }
    }
}
