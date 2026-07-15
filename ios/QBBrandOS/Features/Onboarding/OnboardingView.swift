import SwiftUI

struct OnboardingView: View {
    @Environment(AppState.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Step { case welcome, doors, name }
    @State private var step: Step = .welcome
    @State private var chosenDoor: Door?
    @State private var name = ""

    var body: some View {
        ZStack {
            QB.cream.ignoresSafeArea()
            switch step {
            case .welcome: welcome
            case .doors: doors
            case .name: nameCapture
            }
        }
        .animation(reduceMotion ? nil : QB.easeQB, value: step)
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: QB.Space.l) {
            Spacer()
            QBMark(width: 96)
            VStack(alignment: .leading, spacing: 6) {
                Text("quantum branding")
                    .font(QBFont.wordmark(QBFont.Step.two))
                    .foregroundStyle(QB.ink)
                Text("From idea to orbit")
                    .font(QBFont.mono(QBFont.Step.minus2))
                    .tracking(0.12 * QBFont.Step.minus2)
                    .textCase(.uppercase)
                    .foregroundStyle(QB.ink50)
            }
            QBHeadline(plain: "Idea in,", spotlight: "brand out.", size: QBFont.Step.five)
            Text("The brand operating system that turns one founder, one idea, and zero assets into a complete brand running across 20 specialised agents.")
                .qbBody(QBFont.Step.zero, color: QB.ink75)
            Spacer()
            Button("Start free") {
                step = .doors
            }
            .buttonStyle(QBButtonStyle(expand: true))
            Text("FREE FOREVER · NO CREDIT CARD · 5 MINUTES TO FIRST RESULT")
                .font(QBFont.mono(10.5))
                .tracking(1.1)
                .foregroundStyle(QB.ink50)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, QB.Space.m)
        .padding(.bottom, QB.Space.s)
        .transition(.opacity)
    }

    private var doors: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: QB.Space.s) {
                QBTag(text: "Four doors")
                    .padding(.top, QB.Space.l)
                QBHeadline(plain: "Where are you", spotlight: "right now?", size: QBFont.Step.four)
                Text("Each door is a person, not a feature. Pick the one that sounds like you.")
                    .qbBody(QBFont.Step.zero, color: QB.ink75)
                    .padding(.bottom, QB.Space.xs)

                ForEach(Door.allCases) { door in
                    Button {
                        chosenDoor = door
                        app.door = door
                        step = .name
                    } label: {
                        HStack(spacing: QB.Space.s) {
                            Image(door.illustration)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 64, height: 64)
                                .clipShape(RoundedRectangle(cornerRadius: QB.Radius.box))
                                .overlay(RoundedRectangle(cornerRadius: QB.Radius.box).stroke(QB.ink, lineWidth: 1))
                            VStack(alignment: .leading, spacing: 4) {
                                QBMonoLabel(text: "\(door.number) · \(door.name)")
                                Text(door.line)
                                    .font(QBFont.display(QBFont.Step.one))
                                    .foregroundStyle(QB.ink)
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.right")
                                .foregroundStyle(QB.ink50)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .qbCard(padding: QB.Space.s)
                    .padding(.bottom, 6)
                }
            }
            .padding(.horizontal, QB.Space.s)
            .padding(.bottom, QB.Space.xl)
        }
        .scrollIndicators(.hidden)
        .transition(.opacity)
    }

    private var nameCapture: some View {
        VStack(alignment: .leading, spacing: QB.Space.l) {
            Spacer()
            QBTag(text: chosenDoor.map { "\($0.number) · \($0.name)" } ?? "Your brand")
            QBHeadline(plain: "Name the", spotlight: "brand.", size: QBFont.Step.five)
            Text("One field. You can change it later. The profile builds itself from here.")
                .qbBody(QBFont.Step.zero, color: QB.ink75)

            TextField("Your brand's name", text: $name)
                .font(QBFont.body(QBFont.Step.one, weight: 600))
                .foregroundStyle(QB.ink)
                .padding(QB.Space.s)
                .background(RoundedRectangle(cornerRadius: QB.Radius.box).fill(QB.creamCard))
                .overlay(RoundedRectangle(cornerRadius: QB.Radius.box).stroke(QB.ink, lineWidth: QB.borderWidth))
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()

            Spacer()

            Button("Enter QB BrandOS") {
                app.brandName = name.trimmingCharacters(in: .whitespacesAndNewlines)
                app.onboarded = true
            }
            .buttonStyle(QBButtonStyle(expand: true))

            Button("Skip for now") {
                app.onboarded = true
            }
            .font(QBFont.mono(QBFont.Step.minus1))
            .foregroundStyle(QB.ink50)
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, QB.Space.m)
        .padding(.bottom, QB.Space.s)
        .transition(.opacity)
    }
}
