import XCTest

// Walks the entire app end to end and captures a screenshot of every screen.
// Screenshots land in /tmp/qb-screens on the host.
final class FullFlowTests: XCTestCase {

    private let shotsDir = "/tmp/qb-screens"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try? FileManager.default.createDirectory(
            atPath: shotsDir, withIntermediateDirectories: true)
    }

    private func shoot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        FileManager.default.createFile(atPath: "\(shotsDir)/\(name).png", contents: png)
    }

    func testFullFlow() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-qbUITestReset"]
        app.launch()

        // Onboarding: welcome
        let startFree = app.buttons["Start free"]
        XCTAssertTrue(startFree.waitForExistence(timeout: 10))
        shoot("01-welcome")
        startFree.tap()

        // Onboarding: four doors
        let door = app.descendants(matching: .any).matching(
            NSPredicate(format: "label CONTAINS[c] %@", "Something feels off")).firstMatch
        let doorAppeared = door.waitForExistence(timeout: 6)
        shoot("02-doors")
        XCTAssertTrue(doorAppeared)
        door.tap()

        // Onboarding: brand name
        let nameField = app.textFields["Your brand's name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5))
        nameField.tap()
        nameField.typeText("Selvaggi Built")
        shoot("03-name")
        app.buttons["Enter QB BrandOS"].tap()

        // Home
        let runYours = app.buttons["Run yours →"]
        XCTAssertTrue(runYours.waitForExistence(timeout: 8))
        shoot("04-home")
        runYours.tap()

        // Scan intro
        let startScan = app.buttons["Start the scan →"]
        XCTAssertTrue(startScan.waitForExistence(timeout: 5))
        shoot("05-scan-intro")
        startScan.tap()

        // Q1 through Q7: pick options that produce a mixed score
        let picks: [String] = [
            "I have a brand but something feels off or unclear",
            "Roughly yes, but I struggle to phrase it consistently",
            "I am not sure. I never tested this",
            "Mostly consistent with some drift",
            "No. I struggle to articulate what makes me different",
            "I get engagement but not the right clients",
            "I regularly have to justify or discount",
        ]
        for (i, pick) in picks.enumerated() {
            let option = app.buttons.matching(
                NSPredicate(format: "label CONTAINS %@", pick)).firstMatch
            XCTAssertTrue(option.waitForExistence(timeout: 6), "Q\(i + 1) option missing")
            if i == 0 { shoot("06-question-1") }
            option.tap()
            usleep(600_000)
        }

        // Q8: free text
        let editor = app.textViews.firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 6))
        editor.tap()
        editor.typeText("Nobody understands what makes us different from other builders.")
        shoot("07-question-8")
        app.buttons["Continue →"].tap()

        // Analyzing
        usleep(800_000)
        shoot("08-analyzing")

        // Results
        let report = app.staticTexts["Brand Signal Report"]
        XCTAssertTrue(report.waitForExistence(timeout: 12))
        sleep(2)
        shoot("09-results-top")
        app.swipeUp()
        shoot("10-results-mid")
        app.swipeUp()
        sleep(4)
        shoot("11-results-deep")
        app.swipeUp()
        shoot("12-results-footer")

        // Profile tab
        app.tabBars.buttons["Profile"].tap()
        sleep(1)
        shoot("13-profile")

        // System tab
        app.tabBars.buttons["System"].tap()
        sleep(1)
        shoot("14-system-top")
        app.swipeUp()
        app.swipeUp()
        shoot("15-system-doors")

        // Settings sheet
        app.tabBars.buttons["Profile"].tap()
        let gear = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "gear")).firstMatch
        if gear.waitForExistence(timeout: 3) {
            gear.tap()
        } else {
            app.navigationBars.buttons.firstMatch.tap()
        }
        sleep(1)
        shoot("16-settings")
    }
}
