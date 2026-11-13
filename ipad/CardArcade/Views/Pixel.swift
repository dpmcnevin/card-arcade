import SwiftUI

// Pixel-art building blocks for the UI around the cards, so panels, buttons,
// bars and the table itself sit on the same chunky grid as the card art.
// One art pixel is 2 stage points: the cards are 40x56 pixels drawn 80x112.

enum Pixel {
    static let size = 2.0

    /// A small image drawn at low resolution, shown scaled up without
    /// smoothing: every drawing call lands on whole, chunky pixels.
    static func image(width: Int, height: Int, draw: (CGContext) -> Void) -> CGImage? {
        guard width > 0, height > 0,
              let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.setShouldAntialias(false)
        ctx.setAllowsAntialiasing(false)
        ctx.interpolationQuality = .none
        // Draw top-down, like the views do.
        ctx.translateBy(x: 0, y: CGFloat(height))
        ctx.scaleBy(x: 1, y: -1)
        draw(ctx)
        return ctx.makeImage()
    }
}

/// A rectangle with stair-stepped corners: the pixel-art rounded rectangle.
struct PixelRect: InsettableShape {
    /// Steps in each corner, from the top row in: how far each row is pulled
    /// in, in pixels.
    var steps: [Int]
    var px = Pixel.size
    var insetAmount = 0.0

    /// Pick the steps that best match a rounded rectangle's corner radius.
    init(radius: CGFloat) {
        switch radius {
        case ..<1: steps = []
        case ..<3: steps = [1]
        case ..<7: steps = [2, 1]
        default: steps = [3, 1, 1]
        }
    }

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: insetAmount, dy: insetAmount)
        guard !steps.isEmpty, r.width > 2 * px * Double(steps[0]), r.height > 2 * px * Double(steps.count) else {
            return Path(r)
        }
        // One corner's outline, as (in, down) pixel offsets from the corner,
        // from its top (or bottom) edge toward its side edge.
        var corner: [(Double, Double)] = [(Double(steps[0]), 0)]
        for (k, s) in steps.enumerated() {
            let next = k + 1 < steps.count ? steps[k + 1] : 0
            corner.append((Double(s), Double(k + 1)))
            corner.append((Double(next), Double(k + 1)))
        }
        var pts: [CGPoint] = []
        for (dx, dy) in corner { pts.append(CGPoint(x: r.maxX - dx * px, y: r.minY + dy * px)) }           // top right
        for (dx, dy) in corner.reversed() { pts.append(CGPoint(x: r.maxX - dx * px, y: r.maxY - dy * px)) } // bottom right
        for (dx, dy) in corner { pts.append(CGPoint(x: r.minX + dx * px, y: r.maxY - dy * px)) }            // bottom left
        for (dx, dy) in corner.reversed() { pts.append(CGPoint(x: r.minX + dx * px, y: r.minY + dy * px)) } // top left
        var p = Path()
        p.addLines(pts)
        p.closeSubpath()
        return p
    }

    func inset(by amount: CGFloat) -> PixelRect {
        var s = self
        s.insetAmount += amount
        return s
    }
}

/// An ellipse drawn as a staircase of pixel rows.
struct PixelEllipse: InsettableShape {
    var px = Pixel.size * 2
    var insetAmount = 0.0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: insetAmount, dy: insetAmount)
        let rows = max(2, Int(r.height / px))
        let a = r.width / 2, b = r.height / 2
        // Half-width at each row, snapped to the pixel grid.
        func half(_ i: Int) -> Double {
            let y = (Double(i) + 0.5) * r.height / Double(rows) - b
            let w = a * (1 - (y * y) / (b * b)).squareRoot()
            return (w / px).rounded() * px
        }
        var right: [CGPoint] = [], left: [CGPoint] = []
        for i in 0..<rows {
            let y0 = r.minY + Double(i) * r.height / Double(rows), y1 = r.minY + Double(i + 1) * r.height / Double(rows)
            let h = half(i)
            right += [CGPoint(x: r.midX + h, y: y0), CGPoint(x: r.midX + h, y: y1)]
            left += [CGPoint(x: r.midX - h, y: y0), CGPoint(x: r.midX - h, y: y1)]
        }
        var p = Path()
        p.addLines(right + left.reversed())
        p.closeSubpath()
        return p
    }

    func inset(by amount: CGFloat) -> PixelEllipse {
        var s = self
        s.insetAmount += amount
        return s
    }
}

/// A tiny sprite from rows of text: "X" is a filled pixel, anything else empty.
struct PixelSprite: View {
    let rows: [String]
    var color: Color = Theme.inkDim
    var px = Pixel.size

    var body: some View {
        let w = rows.map(\.count).max() ?? 0
        Canvas { g, _ in
            for (y, row) in rows.enumerated() {
                for (x, ch) in row.enumerated() where ch == "X" {
                    g.fill(Path(CGRect(x: Double(x) * px, y: Double(y) * px, width: px, height: px)), with: .color(color))
                }
            }
        }
        .frame(width: Double(w) * px, height: Double(rows.count) * px)
    }

    /// 7x7 suit symbols, by suit number (1 clubs, 2 diamonds, 3 hearts, 4 spades).
    static let suits: [Int: [String]] = [
        1: ["..XXX..", "..XXX..", "XX.X.XX", "XXXXXXX", "XX.X.XX", "...X...", "..XXX.."],
        2: ["...X...", "..XXX..", ".XXXXX.", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."],
        3: [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X...", "......."],
        4: ["...X...", "..XXX..", ".XXXXX.", "XXXXXXX", "XXXXXXX", "...X...", "..XXX.."],
    ]

    static let tortoise = [
        "...XXXX....",
        "..XXXXXX.XX",
        ".XXXXXXXXXX",
        "XXXXXXXXXX.",
        ".X.X..X.X..",
    ]
    static let hare = [
        ".......X.X.",
        ".......XX..",
        "..XXXXXXXXX",
        ".XXXXXXXXX.",
        "XXXXXXXXX..",
        "..X....X...",
    ]
}

/// The felt, in chunky pixels: rays fanning up from below the table.
struct Felt: View {
    var body: some View {
        GeometryReader { geo in
            if let img = FeltArt.image(for: geo.size) {
                Image(decorative: img, scale: 1).resizable().interpolation(.none)
            } else {
                Theme.felt
            }
        }
    }
}

@MainActor
enum FeltArt {
    /// Each felt pixel is this many stage points.
    static let cell = 8.0
    private static var cache: [String: CGImage] = [:]

    static func image(for size: CGSize) -> CGImage? {
        let w = Int((size.width / cell).rounded(.up)), h = Int((size.height / cell).rounded(.up))
        let key = "\(w)x\(h)"
        if let c = cache[key] { return c }
        let img = Pixel.image(width: w, height: h) { ctx in
            ctx.setFillColor(UIColor(Theme.felt).cgColor)
            ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
            ctx.setFillColor(UIColor(Theme.feltLight).withAlphaComponent(0.35).cgColor)
            let c = CGPoint(x: Double(w) / 2, y: Double(h) + 120 / cell)
            let reach = Double(max(w, h)) * 3
            for i in stride(from: 0, to: 36, by: 2) {
                let a0 = .pi + Double(i) / 36 * .pi, a1 = .pi + Double(i + 1) / 36 * .pi
                ctx.move(to: c)
                ctx.addLine(to: CGPoint(x: c.x + cos(a0) * reach, y: c.y + sin(a0) * reach))
                ctx.addLine(to: CGPoint(x: c.x + cos(a1) * reach, y: c.y + sin(a1) * reach))
                ctx.closePath()
                ctx.fillPath()
            }
            // The darker edge, in the felt itself so it never falls across
            // cards: four stepped bands toward the corners.
            let cx = Double(w) / 2, cy = Double(h) / 2
            let start = 380 / cell, end = 820 / cell
            for y in 0..<h {
                for x in 0..<w {
                    let dx = Double(x) + 0.5 - cx, dy = Double(y) + 0.5 - cy
                    let t = max(0, min(1, ((dx * dx + dy * dy).squareRoot() - start) / (end - start)))
                    let band = (t * 4).rounded(.down) / 4
                    guard band > 0 else { continue }
                    ctx.setFillColor(UIColor.black.withAlphaComponent(band * 0.5).cgColor)
                    ctx.fill(CGRect(x: x, y: y, width: 1, height: 1))
                }
            }
        }
        cache[key] = img
        return img
    }
}

/// A slider made of pixel blocks, one per step, with a block for the thumb.
struct PixelSlider: View {
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    var tint: Color = Theme.brass

    var body: some View {
        let count = Int(((range.upperBound - range.lowerBound) / step).rounded()) + 1
        let index = Int(((value - range.lowerBound) / step).rounded())
        GeometryReader { geo in
            let gap = Pixel.size
            let w = (geo.size.width - gap * Double(count - 1)) / Double(count)
            ZStack(alignment: .leading) {
                HStack(spacing: gap) {
                    ForEach(0..<count, id: \.self) { i in
                        Rectangle()
                            .fill(i <= index ? tint : Theme.panelEdge)
                            .frame(width: w, height: i == index ? 18 : 8)
                            .overlay(alignment: .top) {
                                if i == index { Rectangle().fill(.white.opacity(0.35)).frame(height: Pixel.size) }
                            }
                    }
                }
                .frame(height: 18)
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { g in
                let i = Int((g.location.x / (w + gap)).rounded(.down)).clamped(to: 0...(count - 1))
                let v = range.lowerBound + Double(i) * step
                if v != value { value = v }
            })
        }
        .frame(height: 18)
        .accessibilityElement()
        .accessibilityValue(String(format: "%g", value))
        .accessibilityAdjustableAction { dir in
            switch dir {
            case .increment: value = min(range.upperBound, value + step)
            case .decrement: value = max(range.lowerBound, value - step)
            @unknown default: break
            }
        }
    }
}
