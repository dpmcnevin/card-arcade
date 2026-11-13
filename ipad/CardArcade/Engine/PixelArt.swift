import SwiftUI
import CoreGraphics

/// Pixel-art images built from the engine's bitmaps (the same cards, icons
/// and seals the web arcade draws), cached and shown with nearest-neighbour
/// scaling so every pixel stays square.
@MainActor
final class PixelArt {
    private let engine: GameEngine
    private var cache: [String: CGImage] = [:]

    init(engine: GameEngine) { self.engine = engine }

    func card(_ c: CardV, trump: Bool = false, fourColor: Bool) -> CGImage? {
        image("card|\(c.suit)|\(c.rank)|\(trump)|\(fourColor)") {
            engine.pixels("cardImage", [c.suit, c.rank, trump, fourColor])
        }
    }

    /// A card back; each starting deck has its own.
    func back(_ deck: String = "standard") -> CGImage? { image("back|\(deck)") { engine.pixels("backImage", [deck]) } }
    func icon(_ key: String) -> CGImage? { image("icon|\(key)") { engine.pixels("iconImage", [key]) } }
    func seal(_ s: SealV) -> CGImage? { image("seal|\(s.glyph)|\(s.color)") { engine.pixels("sealImage", [s.glyph, s.color]) } }

    private func image(_ key: String, _ make: () -> PixelData?) -> CGImage? {
        if let hit = cache[key] { return hit }
        guard let data = make(), let bytes = Data(base64Encoded: data.rgba),
              let provider = CGDataProvider(data: bytes as CFData) else { return nil }
        let img = CGImage(
            width: data.w, height: data.h, bitsPerComponent: 8, bitsPerPixel: 32,
            bytesPerRow: data.w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
        cache[key] = img
        return img
    }
}

/// A pixel-art image scaled with hard edges.
struct PixelImage: View {
    let image: CGImage?
    var body: some View {
        if let image {
            Image(decorative: image, scale: 1).resizable().interpolation(.none)
        } else {
            Color.clear
        }
    }
}
