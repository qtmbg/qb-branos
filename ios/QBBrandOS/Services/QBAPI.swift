import Foundation

// Network layer. Two endpoints, both on the production host.
// The deep reading goes through /api/gemini, a server-keyed proxy
// (free Google AI Studio tier). No API key ever lives in the app.
enum QBAPI {
    static let host = URL(string: "https://quantumbranding.ai")!

    enum Failure: Error {
        case unavailable
    }

    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 40
        return URLSession(configuration: config)
    }()

    // MARK: - Deep reading

    private static let readingSystemPrompt = """
    You are the intelligence layer of QB BrandOS, the brand operating system by quantum branding. \
    You write like a thoughtful founder. Direct. Calm. Slightly contrarian. Short declarative sentences, \
    8 to 14 words on average. Sentence fragments with periods are allowed. Contractions are encouraged. \
    Sentence case everywhere. Address the reader as you. \
    Never use an em dash. Never use exclamation points. Never use the words: empower, unlock, supercharge, \
    boost, transform, revolutionize, disrupt, game-changer, cutting-edge, best-in-class, world-class, \
    seamless, frictionless, effortless, robust, scalable, solutions, synergy, leverage, optimize, streamline, \
    maximize, journey, really, very, just, literally, actually, basically, simply, truly. \
    You are reading a founder's Brand Signal Scan results. Write a deep reading in exactly three short \
    paragraphs separated by blank lines. First paragraph: what the scores say about the brand as a system. \
    Second: the single most expensive gap and why it costs money. Third: the first move and what changes \
    once it is made. No headings, no lists, no preamble, no sign-off. 90 to 130 words total.
    """

    static func deepReading(for scan: ScanRecord, brandName: String) async throws -> String {
        let dimLines = scan.dims.map { "\($0.label): \($0.score)/100" }.joined(separator: "\n")
        let momentLabels = [
            "blank": "building from zero, idea but no brand yet",
            "doubt": "has a brand but something feels off",
            "scale": "making money, competition arriving",
            "pivot": "something fundamental needs to change",
        ]
        let user = """
        Brand: \(brandName.isEmpty ? "Not named yet" : brandName)
        Situation: \(momentLabels[scan.moment] ?? scan.moment)
        Overall score: \(scan.overall)/100, grade \(scan.grade) (\(scan.verdictLabel))
        Dimensions:
        \(dimLines)
        Primary gap: \(scan.topGapLabel)
        The founder's own words on their biggest problem: "\(scan.describe)"
        """

        let payload: [String: Any] = [
            "model": "gemini-2.5-flash-lite",
            "max_tokens": 1024,
            "system": readingSystemPrompt,
            "messages": [["role": "user", "content": user]],
        ]

        var request = URLRequest(url: host.appending(path: "api/gemini"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = json["content"] as? [[String: Any]],
              let text = content.first?["text"] as? String,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw Failure.unavailable
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Report email

    static func sendReport(email: String, scan: ScanRecord) async -> Bool {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let payload: [String: Any] = [
            "email": email,
            "firstName": "",
            "signalScanResult": [
                "score": scan.overall,
                "grade": scan.grade,
                "verdict": scan.verdictLabel,
                "topGap": scan.topGapLabel,
                "moment": scan.moment,
                "describe": scan.describe,
                "date": formatter.string(from: scan.date),
            ],
        ]
        var request = URLRequest(url: host.appending(path: "api/send-welcome-email"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        guard let (_, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse
        else { return false }
        return (200..<300).contains(http.statusCode)
    }

    static func isValidEmail(_ email: String) -> Bool {
        email.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
    }
}
