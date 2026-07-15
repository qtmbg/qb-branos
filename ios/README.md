# QB BrandOS for iOS

Native SwiftUI app. Signal Scan in your pocket, the Quantum Brand Profile on device, the six phases explained. Ports the production web scan 1:1 and adds a Gemini-powered deep reading through a server-keyed proxy.

## Layout

```
ios/
├── project.yml                 xcodegen definition (the source of truth for the project)
├── QBBrandOS.xcodeproj         generated. Re-generate with `xcodegen generate`
├── QBBrandOS/
│   ├── App/                    entry point, app state (persistence mirrors web QBP keys)
│   ├── Theme/                  design tokens ported from Design System v3.4 Part 11
│   ├── Models/                 scan engine (1:1 port of signal-scan.html), doors, phases
│   ├── Services/               QBAPI: /api/gemini deep reading, /api/send-welcome-email
│   ├── Features/               Onboarding, Home, Scan, Profile, System, Settings
│   └── Resources/              fonts (OFL), asset catalog, privacy manifest
└── QBBrandOSUITests/           full-flow UI test, screenshots every screen to /tmp/qb-screens
```

## Build and run

Requires Xcode 26 or newer. No packages, no build scripts, no dependencies.

```bash
cd ios
xcodegen generate          # only after editing project.yml
open QBBrandOS.xcodeproj   # or:
xcodebuild -project QBBrandOS.xcodeproj -scheme QBBrandOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Full-flow UI test (walks onboarding, all 8 questions, results, every tab):

```bash
xcodebuild -project QBBrandOS.xcodeproj -scheme QBBrandOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## Backend

Two endpoints, both already on the production host:

- `POST /api/send-welcome-email` sends the report email through Resend. Live today.
- `POST /api/gemini` powers the deep reading on the results screen. Same body shape as `/api/claude`, translated to Google `generateContent`. The key lives in the `GEMINI_API_KEY` Vercel environment variable. Get a free key at aistudio.google.com, add it in Vercel project settings, redeploy. Until the key exists the endpoint returns 503 and the app shows the standard unavailable state with a retry. Everything else in the app works without it.

The scan itself is fully deterministic and runs on device. Scoring, verdicts, gap copy, and recommended paths are verbatim ports of `signal-scan.html`.

## Design rules honored

- Every color comes from the `QB` token enum, hex-identical to the web `:root` block.
- Fraunces, Inter, and JetBrains Mono ship as variable fonts (SIL OFL, licenses bundled). The wordmark cut is Fraunces italic 600, SOFT 60, opsz 80, WONK 1, lowercase.
- The brand mark renders from the canonical Part 21 path geometry. The Q tail is present.
- Two-layer pill buttons, hard offset ink shadows with no blur, eyebrow tag rhythm, `cubic-bezier(0.19, 1, 0.22, 1)` on signature transforms.
- Reduced motion disables every animation, including the score ring and button lift.
- Illustrations come from the inventoried `/img/illus/` files, framed in illus cards, personas paired with their doors.

## App Store

See `APPSTORE.md` for listing copy, privacy answers, and the submission checklist.
