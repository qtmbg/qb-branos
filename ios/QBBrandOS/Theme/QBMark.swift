import SwiftUI

// The QB brand mark, rendered from the canonical geometry in Design System v3.4 Part 21.2.
// ViewBox 0 0 280 130, three strokes, round caps and joins. The Q tail is non-negotiable.
struct QBMarkShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 280
        let sy = rect.height / 130
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy)
        }
        var path = Path()
        // Q lobe (left, round)
        path.move(to: p(138, 60))
        path.addCurve(to: p(62, 30), control1: p(138, 22), control2: p(92, 18))
        path.addCurve(to: p(62, 90), control1: p(26, 46), control2: p(26, 76))
        path.addCurve(to: p(138, 60), control1: p(92, 102), control2: p(138, 98))
        path.closeSubpath()
        // B lobe (right, central pinch)
        path.move(to: p(138, 60))
        path.addCurve(to: p(214, 30), control1: p(138, 22), control2: p(184, 20))
        path.addCurve(to: p(214, 60), control1: p(248, 42), control2: p(248, 55))
        path.addCurve(to: p(214, 92), control1: p(248, 65), control2: p(248, 80))
        path.addCurve(to: p(138, 60), control1: p(184, 102), control2: p(138, 98))
        path.closeSubpath()
        // Q tail
        path.move(to: p(108, 92))
        path.addLine(to: p(128, 118))
        return path
    }
}

struct QBMark: View {
    var width: CGFloat = 56
    var color: Color = QB.ink

    var body: some View {
        let height = width * 130 / 280
        QBMarkShape()
            .stroke(color, style: StrokeStyle(
                lineWidth: 10 * (width / 280),
                lineCap: .round,
                lineJoin: .round
            ))
            .frame(width: width, height: height)
            .accessibilityLabel("Quantum Branding")
    }
}

// Horizontal lockup: mark left, wordmark right, optional mono-caps tagline
struct QBLockup: View {
    var markWidth: CGFloat = 52
    var wordmarkSize: CGFloat = QBFont.Step.one
    var color: Color = QB.ink
    var showTagline = false

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            QBMark(width: markWidth, color: color)
            VStack(alignment: .leading, spacing: 3) {
                Text("quantum branding")
                    .font(QBFont.wordmark(wordmarkSize))
                    .tracking(-0.01 * wordmarkSize)
                    .foregroundStyle(color)
                if showTagline {
                    Text("From idea to orbit")
                        .font(QBFont.mono(QBFont.Step.minus2))
                        .tracking(0.12 * QBFont.Step.minus2)
                        .textCase(.uppercase)
                        .foregroundStyle(QB.ink50)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}
