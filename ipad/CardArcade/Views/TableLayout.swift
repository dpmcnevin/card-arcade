import SwiftUI

/// Stage geometry. The stage is 1280 points wide, like the web arcade, and as
/// tall as the screen's shape needs (960 on a 4:3 iPad), so it fills the
/// screen with no bars. `dy` is how much taller than 720 it is, halved.
struct TableLayout {
    static let cardW = 80.0
    static let cardH = 112.0

    let W: Double, H: Double
    let sidebar: CGRect
    let table: CGRect
    let tableCX: Double
    let trickCY: Double
    let ovalRX: Double, ovalRY: Double
    let northY: Double
    let sideX: Double
    let handY: Double
    let maxHandWidth: Double
    /// Your hand is drawn larger than the other cards.
    let handScale: Double
    let trickScale: Double
    let dy: Double

    static func fit(_ size: CGSize) -> TableLayout {
        guard size.width > 0, size.height > 0 else { return make(height: 720) }
        let aspect = size.width / size.height
        if 1280 / aspect >= 720 { return make(height: 1280 / aspect) }
        return make(width: min(1800, (720 * aspect).rounded()), height: 720)
    }

    static func make(width: Double = 1280, height: Double) -> TableLayout {
        let W = width, H = min(1000, max(720, height.rounded())), side = 270.0
        let extra = H - 720
        let cx = side + (W - side) / 2, cy = 290.0 + extra * 0.5
        let hs = 1.45 + min(0.25, extra / 960)
        let ts = 1.35 + min(0.2, extra / 1200)
        let handY = H - cardH * hs - 26 - min(14, extra / 16)
        return TableLayout(
            W: W, H: H,
            sidebar: CGRect(x: 0, y: 0, width: side, height: H),
            table: CGRect(x: side, y: 0, width: W - side, height: H),
            tableCX: cx, trickCY: cy, ovalRX: 290 + extra * 0.1, ovalRY: 180 + extra * 0.2,
            northY: 62 + extra * 0.18, sideX: 64,
            handY: handY, maxHandWidth: min(950, 620 * hs), handScale: hs, trickScale: ts, dy: extra / 2
        )
    }

    /// Where a seat's card lands in the trick.
    func trickPoint(_ pos: String) -> (Double, Double) {
        let tv = 92 * trickScale / 1.35, th = 104 * trickScale
        switch pos {
        case "N": return (tableCX, trickCY - tv)
        case "S": return (tableCX, trickCY + tv)
        case "W": return (tableCX - th, trickCY)
        default: return (tableCX + th, trickCY)
        }
    }

    /// Where a seat's cards come from and go to.
    func origin(_ pos: String) -> (Double, Double) {
        switch pos {
        case "S": return (tableCX, H + Self.cardH)
        case "N": return (tableCX, northY - 40)
        case "W": return (table.minX + sideX - 40, trickCY)
        default: return (W - sideX + 40, trickCY)
        }
    }

    /// The deck, where the deal comes from.
    var deckPoint: (Double, Double) { (tableCX, trickCY) }

    struct Slot { let x, w, cx, cy, r: Double }

    var handCardW: Double { Self.cardW * handScale }
    var handCardH: Double { Self.cardH * handScale }

    /// Your fanned hand. `x` and `w` are the strip of each card left showing.
    func handSlots(_ n: Int) -> [Slot] {
        let cw = handCardW
        let spacing = n > 1 ? min(56 * handScale, (maxHandWidth - cw) / Double(n - 1)) : 0
        let total = cw + spacing * Double(max(0, n - 1))
        let x0 = tableCX - total / 2
        return (0..<n).map { i in
            let k = Double(i + 1) - Double(n + 1) / 2
            return Slot(x: x0 + Double(i) * spacing, w: i == n - 1 ? cw : spacing,
                        cx: x0 + Double(i) * spacing + cw / 2,
                        cy: handY + handCardH / 2 + k * k * 0.4, r: k * 0.024)
        }
    }

    /// A seat across or beside you: its cards in a row (North) or a column.
    /// Face-up cards (Bridge's dummy) are bigger and spread to be read.
    struct SeatSlot { let x, y, r, s: Double }
    func seatSlots(_ pos: String, _ n: Int, faceUp: Bool) -> [SeatSlot] {
        guard n > 0 else { return [] }
        if pos == "N" {
            let s = faceUp ? 0.9 : 0.62
            let dx = faceUp ? min(46.0, (table.width - 300) / Double(max(1, n - 1))) : min(26.0, 480 / Double(max(1, n)))
            return (0..<n).map { i in
                let k = Double(i) - Double(n - 1) / 2
                return SeatSlot(x: tableCX + k * dx, y: northY + (faceUp ? 14 : 0), r: faceUp ? 0 : .pi, s: s)
            }
        }
        let x = pos == "W" ? table.minX + sideX : W - sideX
        let s = faceUp ? 0.8 : 0.62
        let dy = faceUp ? min(28.0, 380 / Double(max(1, n))) : min(20.0, 380 / Double(max(1, n)))
        return (0..<n).map { i in
            let k = Double(i) - Double(n - 1) / 2
            return SeatSlot(x: x, y: trickCY + k * dy, r: faceUp ? 0 : (pos == "W" ? .pi / 2 : -.pi / 2), s: s)
        }
    }

    /// Where a seat's name goes.
    func labelPoint(_ pos: String) -> (Double, Double) {
        switch pos {
        case "N": return (tableCX, northY + 64)
        case "W": return (table.minX + sideX + 6, trickCY - 220)
        case "E": return (W - sideX - 6, trickCY - 220)
        default: return (tableCX, handY - 16 - 30 * handScale)
        }
    }

    func isOverTrick(_ p: CGPoint) -> Bool {
        let dx = (p.x - tableCX) / ovalRX, dy = (p.y - trickCY) / ovalRY
        return dx * dx + dy * dy < 1
    }
}

/// A small fixed tilt per card, so tricks look tossed rather than placed.
func tossAngle(_ c: CardV) -> Double {
    let step: Int = (c.rank * 7 + c.suit * 13) % 11 - 5
    return Double(step) * 0.022
}
