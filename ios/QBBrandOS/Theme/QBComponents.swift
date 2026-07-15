import SwiftUI

// MARK: - Two-layer 3D pill button (signature 2)
// Ink slab beneath, colored face above. Face rests lifted, drops when pressed.
struct QBButtonStyle: ButtonStyle {
    var background: Color = QB.gold
    var foreground: Color = QB.ink
    var expand = false
    var compact = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let lift: CGFloat = reduceMotion ? 0 : (configuration.isPressed ? 2 : -3)
        return configuration.label
            .font(QBFont.body(compact ? QBFont.Step.minus1 : QBFont.Step.zero, weight: 700))
            .foregroundStyle(foreground)
            .padding(.vertical, compact ? 12 : 17)
            .padding(.horizontal, compact ? 20 : 28)
            .frame(maxWidth: expand ? .infinity : nil)
            .background {
                ZStack {
                    Capsule().fill(QB.ink).offset(y: 3)
                    Capsule().fill(background)
                        .overlay(Capsule().stroke(QB.ink, lineWidth: QB.borderWidth))
                        .offset(y: lift)
                }
            }
            .offset(y: reduceMotion ? 0 : (configuration.isPressed ? 2 : -3))
            .animation(reduceMotion ? nil : QB.easeQB, value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == QBButtonStyle {
    static var qbPrimary: QBButtonStyle { QBButtonStyle() }
    static var qbSecondary: QBButtonStyle { QBButtonStyle(background: QB.roseDeep, foreground: QB.cream) }
}

// MARK: - Eyebrow tag (signature 4, Part 9.2)
// Ink pill wrapping a cream face with a 6px dot and mono caps text.
struct QBTag: View {
    var text: String
    var dot: Color = QB.rose
    var fill: Color = QB.creamCard

    var body: some View {
        HStack(spacing: 7) {
            Circle().fill(dot).frame(width: 6, height: 6)
            Text(text)
                .font(QBFont.mono(QBFont.Step.minus2))
                .tracking(0.12 * QBFont.Step.minus2)
                .textCase(.uppercase)
                .foregroundStyle(QB.ink)
        }
        .padding(.vertical, 7)
        .padding(.horizontal, 14)
        .background(Capsule().fill(fill))
        .overlay(Capsule().stroke(QB.ink, lineWidth: 1))
        .padding(1)
        .background(Capsule().fill(QB.ink))
    }
}

// MARK: - Card (Part 9.3) with hard offset shadow (signature 3)
extension View {
    func qbCard(
        background: Color = QB.creamCard,
        radius: CGFloat = QB.Radius.card,
        padding: CGFloat = QB.Space.m,
        shadow: Bool = true
    ) -> some View {
        self
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: radius).fill(background))
            .overlay(RoundedRectangle(cornerRadius: radius).stroke(QB.ink, lineWidth: QB.borderWidth))
            .background(
                RoundedRectangle(cornerRadius: radius)
                    .fill(QB.ink)
                    .offset(y: shadow ? QB.shadowOffset : 0)
            )
    }

    // Illustration frame (Part 17.5). Illustrations never appear bare.
    func qbIllusCard() -> some View {
        self
            .frame(maxWidth: .infinity)
            .padding(QB.Space.m)
            .background(RoundedRectangle(cornerRadius: QB.Radius.card).fill(QB.creamCard))
            .overlay(RoundedRectangle(cornerRadius: QB.Radius.card).stroke(QB.ink, lineWidth: QB.borderWidth))
            .background(
                RoundedRectangle(cornerRadius: QB.Radius.card)
                    .fill(QB.ink)
                    .offset(y: QB.shadowOffset)
            )
    }
}

// MARK: - Headline with italic gold spotlight
struct QBHeadline: View {
    var plain: String
    var spotlight: String = ""
    var size: CGFloat = QBFont.Step.four
    var color: Color = QB.ink
    var alignment: TextAlignment = .leading

    var body: some View {
        (Text(plain)
            .font(QBFont.display(size))
            .foregroundColor(color)
        + Text(spotlight.isEmpty ? "" : " \(spotlight)")
            .font(QBFont.spotlight(size))
            .foregroundColor(QB.gold))
            .tracking(-0.02 * size)
            .lineSpacing(0.05 * size)
            .multilineTextAlignment(alignment)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Section header (Part 5.3)
struct QBSectionHeader: View {
    var eyebrow: String
    var dot: Color = QB.rose
    var headline: String
    var spotlight: String = ""
    var subhead: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: QB.Space.s) {
            QBTag(text: eyebrow, dot: dot)
            QBHeadline(plain: headline, spotlight: spotlight)
            if !subhead.isEmpty {
                Text(subhead)
                    .font(QBFont.body(QBFont.Step.one))
                    .foregroundStyle(QB.ink75)
                    .lineSpacing(0.4 * QBFont.Step.one * 0.5)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Mono caps label
struct QBMonoLabel: View {
    var text: String
    var color: Color = QB.ink75

    var body: some View {
        Text(text)
            .font(QBFont.mono(QBFont.Step.minus2))
            .tracking(0.12 * QBFont.Step.minus2)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}

// MARK: - Body text helpers
extension Text {
    func qbBody(_ size: CGFloat = QBFont.Step.zero, color: Color = QB.ink) -> some View {
        self
            .font(QBFont.body(size))
            .foregroundColor(color)
            .lineSpacing(0.3 * size)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Score ring (results screen)
struct QBScoreRing: View {
    var score: Int
    var color: Color
    var diameter: CGFloat = 132

    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle()
                .stroke(QB.ink25, lineWidth: 9)
            Circle()
                .trim(from: 0, to: shown ? CGFloat(score) / 100 : 0)
                .stroke(color, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(score)")
                    .font(QBFont.display(QBFont.Step.four))
                    .foregroundStyle(color)
                Text("/100")
                    .font(QBFont.mono(QBFont.Step.minus2))
                    .foregroundStyle(QB.ink50)
            }
        }
        .frame(width: diameter, height: diameter)
        .onAppear {
            if reduceMotion {
                shown = true
            } else {
                withAnimation(QB.easeQB.delay(0.1)) { shown = true }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Score \(score) out of 100")
    }
}

// MARK: - Dimension bar (results screen)
struct QBGapBar: View {
    var score: Int
    var color: Color
    var delay: Double = 0

    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(QB.ink.opacity(0.08))
                Capsule()
                    .fill(color)
                    .frame(width: shown ? geo.size.width * CGFloat(score) / 100 : 0)
            }
        }
        .frame(height: 8)
        .onAppear {
            if reduceMotion {
                shown = true
            } else {
                withAnimation(QB.easeQB.delay(delay)) { shown = true }
            }
        }
    }
}

// MARK: - Loading skeleton
struct QBSkeleton: View {
    var height: CGFloat = 14
    @State private var pulse = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        RoundedRectangle(cornerRadius: QB.Radius.box)
            .fill(QB.skeleton)
            .frame(height: height)
            .opacity(pulse ? 0.45 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                    pulse = true
                }
            }
    }
}
