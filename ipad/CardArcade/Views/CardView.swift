import SwiftUI

/// One card: the pixel-art face or back, flipping around its vertical axis.
/// The flip angle is animatable, so a change of `faceUp` springs through the
/// edge-on frame and swaps faces halfway. A card with an edition shines and
/// wears a tag in its color; a sealed card wears its wax seal.
struct CardView: View {
    @Environment(GameModel.self) private var model
    let card: CardV?
    var faceUp: Bool
    var highlight: Color? = nil
    var dim = false
    var lift = 0.0
    /// The deck back to show (the run's, or the deck picked on the menu).
    var back: String? = nil

    var body: some View {
        Color.clear
            .frame(width: TableLayout.cardW, height: TableLayout.cardH)
            .modifier(FlipModifier(angle: faceUp ? 0 : 180, front: front, back: backView))
            .shadow(color: .black.opacity(0.32 - min(0.12, lift * 0.004)), radius: 0,
                    x: (3 + lift * 0.35) * 0.6, y: 3 + lift * 0.35)
    }

    private var front: AnyView {
        AnyView(
            ZStack(alignment: .topLeading) {
                PixelImage(image: card.flatMap { model.art.card($0, trump: $0.trump, fourColor: model.fourColor) })
                    .modifier(EditionShine(edition: card?.edition))
                if let e = card?.edition {
                    Rectangle().fill(Edition.color(e)).frame(width: 18, height: 6)
                        .shadow(color: .black.opacity(0.4), radius: 0, x: 0, y: 2)
                        .offset(x: 3, y: TableLayout.cardH - 2)
                }
                if let seal = card?.seal {
                    SealBadge(seal: seal, size: 24).offset(x: TableLayout.cardW - 20, y: -4)
                }
                if dim { PixelRect(radius: 4).fill(Color(red: 0.06, green: 0.1, blue: 0.09).opacity(0.5)) }
                if let highlight {
                    PixelRect(radius: 6).stroke(highlight, lineWidth: 3).padding(-3)
                }
            }
        )
    }

    private var backView: AnyView {
        AnyView(PixelImage(image: model.art.back(back ?? model.view?.back ?? model.game?.back ?? "standard")))
    }
}

struct FlipModifier: ViewModifier, Animatable {
    var angle: Double
    let front: AnyView
    let back: AnyView

    nonisolated var animatableData: Double {
        get { angle }
        set { angle = newValue }
    }

    func body(content: Content) -> some View {
        content
            .overlay { angle < 90 ? front : AnyView(back.scaleEffect(x: -1, y: 1)) }
            .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.4)
    }
}

/// A card at a fixed size, for panels (the shop, the deck, a prompt).
struct SmallCard: View {
    let card: CardV
    var scale = 0.8
    var highlight: Color? = nil
    var dim = false
    var body: some View {
        CardView(card: card, faceUp: true, highlight: highlight, dim: dim)
            .scaleEffect(scale)
            .frame(width: TableLayout.cardW * scale, height: TableLayout.cardH * scale)
    }
}
