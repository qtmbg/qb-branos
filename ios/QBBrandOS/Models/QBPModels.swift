import Foundation

// The four doors. Each door is a person, not a feature.
enum Door: String, Codable, CaseIterable, Identifiable {
    case blankSlate
    case doubter
    case player
    case multiBrand

    var id: String { rawValue }

    var number: String {
        switch self {
        case .blankSlate: "Door 01"
        case .doubter: "Door 02"
        case .player: "Door 03"
        case .multiBrand: "Door 04"
        }
    }

    var name: String {
        switch self {
        case .blankSlate: "The Blank Slate"
        case .doubter: "The Doubter"
        case .player: "The Player"
        case .multiBrand: "The Multi-Brand"
        }
    }

    var line: String {
        switch self {
        case .blankSlate: "I have an idea. No brand yet."
        case .doubter: "I have a brand. Something feels off."
        case .player: "Competition is coming fast."
        case .multiBrand: "I build for clients."
        }
    }

    var illustration: String {
        switch self {
        case .blankSlate: "IllusBlankSlate"
        case .doubter: "IllusDoubter"
        case .player: "IllusPlayer"
        case .multiBrand: "IllusAgency"
        }
    }
}

// The six phases, 00 through 05
struct Phase: Identifiable {
    let number: String
    let name: String
    let tools: [String]
    var id: String { number }
}

enum PhaseCatalog {
    static let all: [Phase] = [
        Phase(number: "Phase 00", name: "Acquisition",
              tools: ["Signal Scan"]),
        Phase(number: "Phase 01", name: "Discovery",
              tools: ["Brand Soul Map", "Sensescape", "Visual DNA", "War Table"]),
        Phase(number: "Phase 02", name: "Brand Creation",
              tools: ["Logo Direction", "Logo Evaluation", "Voice Guide"]),
        Phase(number: "Phase 03", name: "Content Creation",
              tools: ["Instagram Seed", "LinkedIn Strategy", "YouTube Strategy", "Newsletter Architecture", "Content Bridge"]),
        Phase(number: "Phase 04", name: "Execution",
              tools: ["Content Repurposing Engine", "Content Scheduler"]),
        Phase(number: "Phase 05", name: "Intelligence",
              tools: ["Brand Performance Dashboard", "Quarterly Brand Review", "Predictive Panel"]),
    ]
}

// A completed Signal Scan, persisted locally
struct ScanRecord: Codable, Identifiable, Hashable {
    var id: UUID = UUID()
    var date: Date = Date()
    var overall: Int
    var grade: String
    var verdictLabel: String
    var dims: [ScanDimensionScore]
    var topGapId: String
    var topGapLabel: String
    var moment: String
    var describe: String
    var deepReading: String?
}
