import SwiftUI

@main
struct QBBrandOSApp: App {
    @State private var appState: AppState

    init() {
        if CommandLine.arguments.contains("-qbUITestReset") {
            let d = UserDefaults.standard
            ["qb_onboarded", "qb_qbp", "qb_door", "qb_scans"].forEach { d.removeObject(forKey: $0) }
        }
        _appState = State(initialValue: AppState())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .tint(QB.ink)
                .preferredColorScheme(.light)
        }
    }
}
