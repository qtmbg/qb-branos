import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        @Bindable var app = app
        Group {
            if app.onboarded {
                TabView(selection: $app.selectedTab) {
                    HomeView()
                        .tabItem { Label("Studio", systemImage: "house.fill") }
                        .tag(AppTab.studio)
                    ScanFlowView()
                        .tabItem { Label("Scan", systemImage: "waveform.path.ecg") }
                        .tag(AppTab.scan)
                    ProfileView()
                        .tabItem { Label("Profile", systemImage: "book.closed.fill") }
                        .tag(AppTab.profile)
                    SystemView()
                        .tabItem { Label("System", systemImage: "circle.hexagongrid.fill") }
                        .tag(AppTab.system)
                }
                .toolbarBackground(QB.cream, for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
            } else {
                OnboardingView()
            }
        }
    }
}

// Shared page chrome: cream background, brand header row
struct QBPage<Content: View>: View {
    var showLockup = true
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            QB.cream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: QB.Space.l) {
                    if showLockup {
                        QBLockup(markWidth: 44, wordmarkSize: QBFont.Step.zero)
                            .padding(.top, QB.Space.xs)
                    }
                    content
                }
                .padding(.horizontal, QB.Space.s)
                .padding(.bottom, QB.Space.xl)
            }
            .scrollIndicators(.hidden)
        }
    }
}
