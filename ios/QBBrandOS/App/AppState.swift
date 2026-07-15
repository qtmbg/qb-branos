import SwiftUI
import Observation

enum AppTab: Hashable {
    case studio, scan, profile, system
}

// App-wide state. Persistence mirrors the web app's QBP conventions:
// the profile lives under the key "qb_qbp" as a JSON string, so the
// handoff spine (?qbp= base64) stays compatible with every web tool.
@Observable
final class AppState {
    var onboarded: Bool {
        didSet { defaults.set(onboarded, forKey: Keys.onboarded) }
    }
    var brandName: String {
        didSet { persistQBP() }
    }
    var door: Door? {
        didSet {
            if let door { defaults.set(door.rawValue, forKey: Keys.door) }
        }
    }
    var scans: [ScanRecord] {
        didSet { persistScans() }
    }
    var selectedTab: AppTab = .studio

    private let defaults = UserDefaults.standard

    private enum Keys {
        static let onboarded = "qb_onboarded"
        static let qbp = "qb_qbp"
        static let door = "qb_door"
        static let scans = "qb_scans"
    }

    init() {
        onboarded = defaults.bool(forKey: Keys.onboarded)
        if let raw = defaults.string(forKey: Keys.qbp),
           let data = raw.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            brandName = dict["brandName"] as? String ?? ""
        } else {
            brandName = ""
        }
        if let rawDoor = defaults.string(forKey: Keys.door) {
            door = Door(rawValue: rawDoor)
        } else {
            door = nil
        }
        if let data = defaults.data(forKey: Keys.scans),
           let decoded = try? JSONDecoder().decode([ScanRecord].self, from: data) {
            scans = decoded
        } else {
            scans = []
        }
    }

    var latestScan: ScanRecord? { scans.first }

    func save(scan: ScanRecord) {
        if let idx = scans.firstIndex(where: { $0.id == scan.id }) {
            scans[idx] = scan
        } else {
            scans.insert(scan, at: 0)
        }
    }

    func eraseEverything() {
        onboarded = false
        brandName = ""
        door = nil
        scans = []
        defaults.removeObject(forKey: Keys.qbp)
        defaults.removeObject(forKey: Keys.door)
        defaults.removeObject(forKey: Keys.scans)
        selectedTab = .studio
    }

    // QBP JSON, shaped like the web tools expect
    var qbpJSON: String {
        var dict: [String: Any] = [:]
        if !brandName.isEmpty { dict["brandName"] = brandName }
        guard !dict.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: dict, options: [.sortedKeys]),
              let str = String(data: data, encoding: .utf8) else { return "{}" }
        return str
    }

    // Base64 of the raw QBP JSON string, the ?qbp= handoff spine
    var qbpSpine: String? {
        guard qbpJSON != "{}" else { return nil }
        return Data(qbpJSON.utf8).base64EncodedString()
    }

    private func persistQBP() {
        defaults.set(qbpJSON, forKey: Keys.qbp)
    }

    private func persistScans() {
        if let data = try? JSONEncoder().encode(scans) {
            defaults.set(data, forKey: Keys.scans)
        }
    }
}
