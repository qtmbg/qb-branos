import SwiftUI

// Canonical QB BrandOS palette. Ported verbatim from Design System v3.4 Part 11.
// Every color in the app comes from here. Never hardcode a hex elsewhere.
extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

enum QB {
    // Surface / neutrals
    static let cream = Color(hex: 0xFBF5E6)
    static let creamCard = Color(hex: 0xF2EBD3)
    static let creamWarm = Color(hex: 0xECDDB8)
    static let creamEdge = Color(hex: 0xDBD4C0)
    static let creamRose = Color(hex: 0xF4D9DD)
    static let paper = Color(hex: 0xFFFEF8)

    // Ink + opacity ramp
    static let ink = Color(hex: 0x2D1521)
    static let ink75 = Color(hex: 0x2D1521, alpha: 0.75)
    static let ink50 = Color(hex: 0x2D1521, alpha: 0.50)
    static let ink33 = Color(hex: 0x2D1521, alpha: 0.33)
    static let ink25 = Color(hex: 0x2D1521, alpha: 0.25)

    // Brand triad
    static let gold = Color(hex: 0xE0B069)
    static let rose = Color(hex: 0xCA6180)
    static let teal = Color(hex: 0x9ED3DC)

    // Depth / secondary
    static let roseDeep = Color(hex: 0x8E3F58)
    static let tealDeep = Color(hex: 0x5BA8B5)
    static let goldDeep = Color(hex: 0xB58840)
    static let aubergine = Color(hex: 0x4A2B3A)

    // Decoration accents (paint only, never text or border)
    static let pink = Color(hex: 0xFCB7C7)
    static let butter = Color(hex: 0xFEFD99)
    static let tealSoft = Color(hex: 0xC5E5E9)
    static let roseSoft = Color(hex: 0xECC4D0)

    // Phase colors, one per phase 00-05
    static let phaseAcquisition = Color(hex: 0xC5E5E9)
    static let phaseDiscovery = Color(hex: 0x9CC4A2)
    static let phaseCreation = Color(hex: 0xB5C8E5)
    static let phaseContent = Color(hex: 0xFCB7C7)
    static let phaseExecution = Color(hex: 0xE89380)
    static let phaseIntelligence = Color(hex: 0xB080A0)

    // System utilities
    static let scrim = Color(hex: 0xFBF5E6, alpha: 0.90)
    static let skeleton = Color(hex: 0xE0B069, alpha: 0.33)

    // Spacing scale, evaluated from the fluid clamp at iPhone width
    enum Space {
        static let xxs: CGFloat = 9
        static let xs: CGFloat = 14
        static let s: CGFloat = 18
        static let m: CGFloat = 27
        static let l: CGFloat = 36
        static let xl: CGFloat = 54
        static let xxl: CGFloat = 72
    }

    // Radii
    enum Radius {
        static let pill: CGFloat = 9999
        static let card: CGFloat = 32
        static let cardSmall: CGFloat = 24
        static let box: CGFloat = 8
    }

    // Hard offset shadow signature: no blur, full opacity, ink
    static let shadowOffset: CGFloat = 9
    static let borderWidth: CGFloat = 2

    // Signature easing, cubic-bezier(0.19, 1, 0.22, 1) at 0.4s
    static let easeQB = Animation.timingCurve(0.19, 1, 0.22, 1, duration: 0.4)
}
