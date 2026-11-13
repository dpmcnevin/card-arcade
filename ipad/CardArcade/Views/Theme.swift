import SwiftUI

/// The card room at night: deep green baize, cream cards, brass accents.
/// The same palette as the web game (src/app.css).
enum Theme {
    static let bg = Color(hex: 0x0b1f17)
    static let felt = Color(hex: 0x14402c)
    static let feltLight = Color(hex: 0x1c5239)
    static let feltEdge = Color(hex: 0x0e2d20)
    static let sidebar = Color(hex: 0x0f1a16)
    static let panel = Color(hex: 0x15241e)
    static let panelEdge = Color(hex: 0x2c4a3d)
    static let ink = Color(hex: 0xece6d6)
    static let inkDim = Color(hex: 0x9fb3a8)
    static let inkFaint = Color(hex: 0x5f7a6d)
    static let brass = Color(hex: 0xd9a441)
    static let brassDim = Color(hex: 0x8a6a2c)
    static let good = Color(hex: 0x4fbf7a)
    static let warn = Color(hex: 0xe3b341)
    static let bad = Color(hex: 0xe0604f)
    static let chips = Color(hex: 0x4a9fe0)
    static let mult = Color(hex: 0xe0604f)
    static let gold = Color(hex: 0xc9a24a)
    static let goldLight = Color(hex: 0xe8c873)
    static let ploy = Color(hex: 0x8e6bd1)
    static let heartPink = Color(hex: 0xf08a8a)
    static let confetti: [Color] = [Color(hex: 0xe8c873), Color(hex: 0xc9a24a), Color(hex: 0xf3ead6), Color(hex: 0x4fbf7a), Color(hex: 0xc8323c)]
    static let rarity: [Color] = [inkDim, inkDim, good, chips, brass]

    /// Jersey 10, the game's pixel font. It runs small for its point size,
    /// so sizes are scaled up to match the layout's. It has one weight; the
    /// weight argument is kept so call sites read as they did.
    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom("Jersey 10", size: (size * 1.3).rounded())
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255, opacity: 1)
    }

    init(css: String) {
        let s = css.hasPrefix("#") ? String(css.dropFirst()) : css
        self.init(hex: UInt32(s, radix: 16) ?? 0xffffff)
    }
}

extension View {
    /// The text shadow used throughout the game.
    func inkShadow(_ r: CGFloat = 2) -> some View {
        shadow(color: .black.opacity(0.6), radius: 0, x: r, y: r)
    }
}

/// Number formatting: 12,345.
func num(_ n: Double) -> String {
    let v = Int((n + 0.5).rounded(.down))
    return v.formatted(.number.grouping(.automatic))
}
func num(_ n: Int) -> String { num(Double(n)) }
