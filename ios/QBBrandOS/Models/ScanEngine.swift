import SwiftUI

// 1:1 port of the production Signal Scan logic in signal-scan.html.
// Question copy, weights, scoring, verdict bands, gap copy, and recommended
// paths are verbatim from the shipped web tool. Do not paraphrase.

struct ScanOption: Identifiable, Hashable {
    let value: Int
    let label: String
    var id: Int { value }
}

struct ScanQuestion: Identifiable {
    enum Kind { case choice, text }
    let id: String
    let kind: Kind
    let question: String
    let sub: String
    let options: [ScanOption]
}

struct ScanDimension: Identifiable {
    let id: String
    let label: String
    let weight: Double
}

struct ScanDimensionScore: Identifiable, Codable, Hashable {
    let id: String
    let label: String
    let score: Int
}

struct ScanVerdict {
    let grade: String
    let label: String
    let desc: String

    var color: Color {
        switch grade {
        case "A": QB.phaseDiscovery
        case "B": QB.tealDeep
        case "C": QB.goldDeep
        default: QB.roseDeep
        }
    }
}

struct ScanPath {
    let tool: String
    let file: String
    let desc: String

    var url: URL { URL(string: "https://quantumbranding.ai/\(file)")! }
}

enum ScanEngine {
    static let questions: [ScanQuestion] = [
        ScanQuestion(
            id: "moment", kind: .choice,
            question: "Where are you right now?",
            sub: "Be honest. The scan only works if you are.",
            options: [
                ScanOption(value: 0, label: "Building from zero. I have an idea but no brand yet"),
                ScanOption(value: 1, label: "I have a brand but something feels off or unclear"),
                ScanOption(value: 2, label: "I am making money but competition is arriving"),
                ScanOption(value: 3, label: "Something fundamental needs to change in my direction"),
            ]
        ),
        ScanQuestion(
            id: "identity", kind: .choice,
            question: "Can you say what your brand stands for in one sentence?",
            sub: "Not what you do. What you stand for.",
            options: [
                ScanOption(value: 0, label: "Yes, clearly and without hesitation"),
                ScanOption(value: 1, label: "Roughly yes, but I struggle to phrase it consistently"),
                ScanOption(value: 2, label: "I know it internally but cannot articulate it"),
                ScanOption(value: 3, label: "No. This is exactly the problem"),
            ]
        ),
        ScanQuestion(
            id: "visual", kind: .choice,
            question: "When someone sees your brand visually, what do they feel?",
            sub: "Think logo, colors, fonts, overall look.",
            options: [
                ScanOption(value: 0, label: "Exactly what I intend them to feel"),
                ScanOption(value: 1, label: "Something close but not quite right"),
                ScanOption(value: 2, label: "I am not sure. I never tested this"),
                ScanOption(value: 3, label: "Probably nothing distinctive"),
            ]
        ),
        ScanQuestion(
            id: "voice", kind: .choice,
            question: "How consistent is your brand voice across platforms?",
            sub: "LinkedIn, Instagram, email, website. Does it sound like the same brand?",
            options: [
                ScanOption(value: 0, label: "Very consistent. Unmistakably the same voice everywhere"),
                ScanOption(value: 1, label: "Mostly consistent with some drift"),
                ScanOption(value: 2, label: "Each platform sounds different. No real coherence"),
                ScanOption(value: 3, label: "I have no defined voice. I write differently every time"),
            ]
        ),
        ScanQuestion(
            id: "positioning", kind: .choice,
            question: "Can your ideal client immediately understand why you and not someone else?",
            sub: "Does your positioning create a clear reason to choose you specifically?",
            options: [
                ScanOption(value: 0, label: "Yes. My differentiation is clear and specific"),
                ScanOption(value: 1, label: "Somewhat, but I could be confused with competitors"),
                ScanOption(value: 2, label: "No. I struggle to articulate what makes me different"),
                ScanOption(value: 3, label: "I compete mostly on price because the difference is unclear"),
            ]
        ),
        ScanQuestion(
            id: "content", kind: .choice,
            question: "Does your content attract the right people?",
            sub: "Not just engagement. Do the right clients find you through what you publish?",
            options: [
                ScanOption(value: 0, label: "Yes. My content consistently brings in qualified leads"),
                ScanOption(value: 1, label: "Sometimes. Hits and misses"),
                ScanOption(value: 2, label: "I get engagement but not the right clients"),
                ScanOption(value: 3, label: "My content does not generate leads at all"),
            ]
        ),
        ScanQuestion(
            id: "price", kind: .choice,
            question: "Does your brand support the price you want to charge?",
            sub: "Do clients pay without negotiating, or do you constantly justify your rates?",
            options: [
                ScanOption(value: 0, label: "Yes. Clients rarely question my pricing"),
                ScanOption(value: 1, label: "Sometimes. Depends on the client"),
                ScanOption(value: 2, label: "I regularly have to justify or discount"),
                ScanOption(value: 3, label: "I undercharge because I do not trust my brand to hold the price"),
            ]
        ),
        ScanQuestion(
            id: "describe", kind: .text,
            question: "In your own words, what is the single biggest problem your brand has right now?",
            sub: "One sentence. Do not overthink it.",
            options: []
        ),
    ]

    static let dimensions: [ScanDimension] = [
        ScanDimension(id: "identity", label: "Identity Clarity", weight: 20),
        ScanDimension(id: "visual", label: "Visual Coherence", weight: 18),
        ScanDimension(id: "voice", label: "Voice Consistency", weight: 17),
        ScanDimension(id: "positioning", label: "Market Positioning", weight: 22),
        ScanDimension(id: "content", label: "Content Performance", weight: 13),
        ScanDimension(id: "price", label: "Brand Authority", weight: 10),
    ]

    // Moment values map to the web tool's string keys
    static let momentKeys = ["blank", "doubt", "scale", "pivot"]

    static func calcScores(answers: [String: Int]) -> (overall: Int, dims: [ScanDimensionScore]) {
        var total = 0.0
        var dims: [ScanDimensionScore] = []
        for d in dimensions {
            let raw = Double(answers[d.id] ?? 2)
            let score = Int((((3 - raw) / 3) * 100).rounded())
            total += Double(score) * (d.weight / 100)
            dims.append(ScanDimensionScore(id: d.id, label: d.label, score: score))
        }
        return (Int(total.rounded()), dims)
    }

    static func verdict(for score: Int) -> ScanVerdict {
        if score >= 80 {
            return ScanVerdict(grade: "A", label: "Strong Foundation",
                desc: "Your brand has real coherence. The system helps you sharpen and scale what is already working.")
        }
        if score >= 60 {
            return ScanVerdict(grade: "B", label: "Clear Gaps",
                desc: "The bones are right but key elements are misaligned. Targeted work produces rapid improvement.")
        }
        if score >= 40 {
            return ScanVerdict(grade: "C", label: "Structural Issues",
                desc: "Your brand is working against you. The gaps are costing you clients and price authority.")
        }
        return ScanVerdict(grade: "D", label: "Foundation Needed",
            desc: "The brand is not doing its job. Before more content or campaigns, rebuild from identity.")
    }

    static func topGap(dims: [ScanDimensionScore]) -> ScanDimensionScore {
        dims.sorted { $0.score < $1.score }.first!
    }

    static func gapCopy(for id: String) -> String {
        switch id {
        case "identity":
            return "You cannot scale what you cannot define. The brand will keep losing authority until the identity is precise, not approximate."
        case "visual":
            return "Visual incoherence signals a lack of conviction. Clients read uncertainty in design before they read your words."
        case "voice":
            return "A brand that sounds different everywhere has no presence. Consistency is the primary driver of trust in a crowded market."
        case "positioning":
            return "If clients cannot immediately understand why you specifically, they default to price comparison. Positioning is the most commercially expensive gap."
        case "content":
            return "Content that does not attract the right clients is not content strategy. It is noise production. The brief is wrong before the content is written."
        default:
            return "Your brand is not holding the prices you should charge. This is an authority gap, not a pricing problem."
        }
    }

    static func recommendedPath(moment: String, topGap: ScanDimensionScore) -> ScanPath {
        let compass = ScanPath(tool: "Archetype Compass", file: "archetype-compass.html",
            desc: "Read your archetype trinity in 10 minutes. The shortest path to a clear identity foundation.")
        let soulMap = ScanPath(tool: "Brand Soul Map", file: "brand-soul-map.html",
            desc: "Start at identity. Everything else is built from here.")
        let logo = ScanPath(tool: "Logo Evaluation", file: "logo-evaluation-agent.html",
            desc: "Audit what you have against identity standards before rebuilding.")
        let warTable = ScanPath(tool: "War Table", file: "war-table.html",
            desc: "Pressure-test your next move with strategic prioritization.")

        switch moment {
        case "blank", "pivot":
            return compass
        case "doubt":
            if topGap.id == "identity" {
                return ScanPath(tool: soulMap.tool, file: soulMap.file,
                    desc: "The identity is the root problem. Resolve this before any visual or voice work.")
            }
            if topGap.id == "visual" {
                return ScanPath(tool: logo.tool, file: logo.file,
                    desc: "The visual system is your primary gap. Audit it against identity standards first.")
            }
            return logo
        case "scale":
            if topGap.id == "identity" {
                return ScanPath(tool: soulMap.tool, file: soulMap.file,
                    desc: "Scale without a clear identity compounds confusion. Fix the foundation first.")
            }
            if topGap.id == "positioning" {
                return ScanPath(tool: warTable.tool, file: warTable.file,
                    desc: "Sharpen your positioning before scaling. The gap is actively costing you market share.")
            }
            return warTable
        default:
            return soulMap
        }
    }

    // Bar color thresholds on the results screen
    static func barColor(for score: Int) -> Color {
        if score >= 70 { return QB.phaseDiscovery }
        if score >= 45 { return QB.goldDeep }
        return QB.roseDeep
    }
}
