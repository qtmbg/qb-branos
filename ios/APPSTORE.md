# App Store submission package

Everything App Store Connect asks for, in order. The only things this file cannot do for you: enroll in the Apple Developer Program, set the signing team, and press Submit.

## One-time setup (your part)

1. Apple Developer Program membership active.
2. In Xcode: open `ios/QBBrandOS.xcodeproj`, select the QBBrandOS target, Signing and Capabilities, pick your team. Bundle ID is `ai.quantumbranding.qbbrandos` (register it in the developer portal if prompted).
3. In Vercel: add `GEMINI_API_KEY` (free key from aistudio.google.com) so the deep reading goes live. The app ships fine without it, the card degrades gracefully, but reviewers should see the real thing.

## Archive and upload

Product → Archive in Xcode, then Distribute App → App Store Connect. Or:

```bash
cd ios
xcodebuild -project QBBrandOS.xcodeproj -scheme QBBrandOS \
  -destination 'generic/platform=iOS' archive \
  -archivePath build/QBBrandOS.xcarchive DEVELOPMENT_TEAM=YOURTEAMID
xcodebuild -exportArchive -archivePath build/QBBrandOS.xcarchive \
  -exportOptionsPlist exportOptions.plist -exportPath build/export
```

## Listing

| Field | Value |
|---|---|
| Name | QB BrandOS |
| Subtitle | Brand diagnostic in 5 minutes |
| Primary category | Business |
| Secondary category | Productivity |
| Age rating | 4+ |
| Price | Free |
| Support URL | https://quantumbranding.ai |
| Marketing URL | https://quantumbranding.ai |
| Privacy policy URL | https://quantumbranding.ai/privacy |

**Promotional text** (170 max):

> Signal Scan is live. Free brand diagnostic. 5 minutes to your first insight. Run yours.

**Description:**

> Idea in, brand out.
>
> QB BrandOS puts Signal Scan in your pocket. A free brand diagnostic that reads your brand across 6 health dimensions and tells you exactly what to fix first.
>
> 8 questions. 5 minutes. A precise read on where your brand is strong, where it is losing you money, and what to do about it.
>
> What you get:
>
> • A brand health score built from identity, visual coherence, voice, positioning, content, and price authority
> • The structural gap that costs you the most, named and explained
> • A deep reading written for your situation
> • Your recommended first move
> • A Quantum Brand Profile that lives on your device and grows with every scan
>
> Four doors, one system. Starting from zero, sensing something is off, facing new competition, or building for clients. The scan meets you where you are.
>
> Your answers stay on your device. No account. No sign-in. Send yourself the full report by email when you want it, and nothing more.

**Keywords** (100 chars):

> brand,branding,diagnostic,brand audit,positioning,identity,founder,startup,logo,voice,strategy

## App privacy questionnaire

No tracking. Two data types, both optional, neither linked to identity:

| Data type | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Email address | Only if the user sends themselves the report | No | No | App functionality |
| Other user content (scan answers) | Only for generating the deep reading | No | No | App functionality |

The bundled `PrivacyInfo.xcprivacy` already declares this plus the UserDefaults access reason (CA92.1).

## Screenshots

Required: 6.9-inch (iPhone 17 Pro Max class). The UI test produces clean captures: run the test target against the Pro Max simulator and pull from `/tmp/qb-screens`. Suggested set, in store order: welcome, doors, question, results top, results dimensions, profile.

## Review notes (paste into App Review Information)

> No account or sign-in exists. All scan logic runs on device. The optional "deep reading" on the results screen calls our server, which generates a short text reading. The optional email field sends the user their own report once, through our transactional mail service. Nothing is sold inside the app.

## Known review considerations

- The app is free, sells nothing, and has no external purchase steering, so 3.1.1 exposure is low. The results screen links to our web tools as the recommended next step and the System tab links to the website. If review objects to those links, remove the three `Link` views (results `pathCard`, results `footer`, profile `handoff`) and resubmit. One-line changes each.
- Minimum functionality (4.2) is covered by the native diagnostic, scoring engine, profile, and generated reading.
- The fonts are SIL OFL and bundled with their licenses.

## Version discipline

`MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` live in `ios/project.yml`. Bump, regenerate, archive.
