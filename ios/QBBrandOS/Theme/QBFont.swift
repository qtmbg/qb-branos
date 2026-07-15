import SwiftUI
import CoreText

// Variable-font access to the three canonical families.
// Fraunces (display), Inter (body and UI), JetBrains Mono (labels and captions).
// Axis values follow Design System v3.4 Part 3 and Part 21.
enum QBFont {
    // FourCharCode axis tags
    private static let wght = 0x77676874
    private static let opsz = 0x6F70737A
    private static let soft = 0x534F4654
    private static let wonk = 0x574F4E4B

    private static let cache = NSCache<NSString, CTFont>()

    private static func ctFont(post: String, size: CGFloat, axes: [Int: CGFloat]) -> CTFont {
        let key = "\(post)-\(size)-\(axes.sorted { $0.key < $1.key })" as NSString
        if let hit = cache.object(forKey: key) { return hit }
        var variation: [NSNumber: NSNumber] = [:]
        for (tag, value) in axes {
            variation[NSNumber(value: tag)] = NSNumber(value: Double(value))
        }
        let attrs: [CFString: Any] = [
            kCTFontNameAttribute: post,
            kCTFontVariationAttribute: variation,
        ]
        let descriptor = CTFontDescriptorCreateWithAttributes(attrs as CFDictionary)
        let font = CTFontCreateWithFontDescriptor(descriptor, size, nil)
        cache.setObject(font, forKey: key)
        return font
    }

    static func display(
        _ size: CGFloat,
        weight: CGFloat = 600,
        opticalSize: CGFloat = 60,
        softness: CGFloat = 50,
        wonky: CGFloat = 0,
        italic: Bool = false
    ) -> Font {
        Font(ctFont(
            post: italic ? "Fraunces-ThinItalic" : "Fraunces-Thin",
            size: size,
            axes: [wght: weight, opsz: opticalSize, soft: softness, wonk: wonky]
        ))
    }

    // Wordmark cut: italic 600, SOFT 60, opsz 80, WONK 1, always lowercase
    static func wordmark(_ size: CGFloat) -> Font {
        display(size, weight: 600, opticalSize: 80, softness: 60, wonky: 1, italic: true)
    }

    // Spotlight phrase inside a headline: italic, opsz 80, SOFT 60, WONK 1
    static func spotlight(_ size: CGFloat) -> Font {
        display(size, weight: 600, opticalSize: 80, softness: 60, wonky: 1, italic: true)
    }

    static func body(_ size: CGFloat, weight: CGFloat = 500, italic: Bool = false) -> Font {
        Font(ctFont(
            post: italic ? "Inter-Italic_Thin-Italic" : "Inter-Regular_Thin",
            size: size,
            axes: [wght: weight]
        ))
    }

    static func mono(_ size: CGFloat, weight: CGFloat = 500) -> Font {
        Font(ctFont(post: "JetBrainsMonoRoman-Thin", size: size, axes: [wght: weight]))
    }

    // Fluid type scale evaluated at iPhone width (--step-* in the web system)
    enum Step {
        static let minus2: CGFloat = 12.5
        static let minus1: CGFloat = 15
        static let zero: CGFloat = 18
        static let one: CGFloat = 22
        static let two: CGFloat = 26
        static let three: CGFloat = 31.5
        static let four: CGFloat = 38
        static let five: CGFloat = 46
        static let six: CGFloat = 55
        static let seven: CGFloat = 66
    }
}
