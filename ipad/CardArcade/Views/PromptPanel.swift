import SwiftUI

/// The step before play, for any game, drawn from the game's prompt
/// (kit/src/view/types.ts): a title and lines, cards to show (the upcard,
/// the dog), its choices (a bid, a call, a grid of contracts), and cards to
/// pick in your hand first (the pass, the cards to set aside).
struct PromptPanel: View {
    @Environment(GameModel.self) private var model
    let prompt: PromptV

    var body: some View {
        let L = model.layout
        let grid = prompt.grid > 0
        VStack(spacing: 8) {
            Text(prompt.title).font(Theme.font(24, .bold)).foregroundStyle(Theme.ink).inkShadow()
                .multilineTextAlignment(.center)
            ForEach(Array(prompt.lines.enumerated()), id: \.offset) { _, line in
                Text(line).font(Theme.font(15)).foregroundStyle(Theme.inkDim).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !prompt.cards.isEmpty {
                HStack(spacing: 6) {
                    ForEach(prompt.cards) { c in SmallCard(card: c, scale: prompt.cards.count > 3 ? 0.7 : 0.9) }
                }
                .padding(.vertical, 4)
            }
            if grid {
                let cols = Array(repeating: GridItem(.fixed(104), spacing: 6), count: prompt.grid)
                LazyVGrid(columns: cols, spacing: 6) {
                    ForEach(Array(prompt.choices.enumerated()), id: \.offset) { _, c in choice(c, compact: true) }
                }
                .padding(.top, 4)
            } else if !prompt.choices.isEmpty {
                FlowRow(spacing: 8) {
                    ForEach(Array(prompt.choices.enumerated()), id: \.offset) { _, c in choice(c, compact: false) }
                }
                .frame(width: 440)
                .padding(.top, 4)
            }
            if let p = prompt.pick {
                Text("\(model.picked.count) of \(p.count) chosen").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                GameButton(p.label, enabled: model.picked.count == p.count, pulse: true) { model.commitPick() }
                    .frame(width: 200)
            }
            if let h = prompt.hint {
                Text(h).font(Theme.font(13)).foregroundStyle(Theme.inkFaint).multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let tag = model.view?.skipTag {
                Button { model.skipBoard() } label: {
                    Text("or skip this board for \(Text(tag.name).bold())").underline()
                        .font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 14)
        .frame(width: grid ? Double(prompt.grid) * 110 + 30 : 480)
        .background(PixelRect(radius: 10).fill(Theme.sidebar.opacity(0.96)).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 5))
        .overlay(PixelRect(radius: 10).stroke(Theme.ploy, lineWidth: 2))
        .position(x: L.tableCX, y: grid ? L.trickCY - 10 : L.trickCY)
        .disabled(model.busy)
    }

    private func choice(_ c: PromptV.Choice, compact: Bool) -> some View {
        let fill = !c.enabled ? Theme.panel : c.primary ? Theme.brass : Theme.panelEdge
        let ink = !c.enabled ? Theme.inkFaint : c.primary ? Theme.bg : Theme.ink
        return Button {
            guard c.enabled else { return }
            model.audio.play("button", jitter: 0.03)
            model.move(c.action)
        } label: {
            VStack(spacing: 0) {
                HStack(spacing: 3) {
                    if c.star { Text("★").font(.system(size: 12)).foregroundStyle(c.primary ? Theme.bg : Theme.brass) }
                    Text(c.label).font(Theme.font(compact ? 17 : 19, .bold)).lineLimit(1).minimumScaleFactor(0.6)
                }
                if let s = c.sub { Text(s).font(Theme.font(11)).lineLimit(1).minimumScaleFactor(0.6).opacity(0.85) }
            }
            .foregroundStyle(ink)
            .padding(.horizontal, compact ? 4 : 14)
            .frame(minWidth: compact ? 104 : 64)
            .frame(width: compact ? 104 : nil, height: compact ? 42 : 40)
            .background(
                PixelRect(radius: 6).fill(fill)
                    .shadow(color: .black.opacity(c.enabled ? 0.35 : 0), radius: 0, x: 2, y: 3)
            )
            .overlay(PixelRect(radius: 6).stroke(c.star ? Theme.goldLight : .clear, lineWidth: 2))
        }
        .buttonStyle(PressStyle())
        .disabled(!c.enabled)
    }
}
