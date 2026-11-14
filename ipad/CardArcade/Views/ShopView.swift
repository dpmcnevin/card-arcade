import SwiftUI

/// The club: the wares laid out on the baize as cards, each with its price
/// coin (tap one to read it and buy), your relics to sell, a reroll and the
/// way to the next board.
struct ShopView: View {
    @Environment(GameModel.self) private var model
    @State private var picked: Int?

    var body: some View {
        let v = model.view!
        let L = model.layout
        let next = v.board == v.boardsPerTable ? "Next \(v.words.table.lowercased())" : "Next board"
        VStack(alignment: .leading, spacing: 16 + L.dy * 0.15) {
            HStack(alignment: .top) {
                VStack(alignment: .leading) {
                    Text("The Club").font(Theme.font(44, .bold)).foregroundStyle(Theme.brass).inkShadow(4)
                    Text("Spend your winnings before the next board. Tap an item to read it.").font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                }
                Spacer()
                Text("$\(num(v.money))").font(Theme.font(44, .bold)).monospacedDigit().foregroundStyle(Theme.brass).inkShadow(4)
                    .contentTransition(.numericText())
                    .padding(.trailing, 100) // clear of the Menu button
                    .padding(.top, 30)
            }
            HStack(spacing: 30) {
                ForEach(v.shop ?? []) { item in
                    Ware(item: item, selected: picked == item.slot) {
                        picked = picked == item.slot ? nil : item.slot
                    } buy: {
                        picked = nil
                        model.buy(item)
                    }
                    .zIndex(picked == item.slot ? 1 : 0)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 320 + L.dy * 0.3)
            .background(Rectangle().fill(RadialGradient(colors: [Theme.feltLight, Theme.feltEdge], center: .center, startRadius: 0, endRadius: 520))
                .overlay(Rectangle().stroke(Theme.brassDim, lineWidth: 3))
                .shadow(color: .black.opacity(0.35), radius: 0, x: 0, y: 6))
            .zIndex(2)
            VStack(alignment: .leading, spacing: 8) {
                Text("Your relics \(v.relicSlotsUsed)/\(v.relicSlots)").font(Theme.font(20, .bold))
                HStack(spacing: 12) {
                    ForEach(0..<(v.relics.count + max(0, v.relicSlots - v.relicSlotsUsed)), id: \.self) { i in
                        if i < v.relics.count { OwnedRelic(relic: v.relics[i], index: i) }
                        else {
                            VStack(spacing: 6) {
                                Text("+").font(Theme.font(30, .bold))
                                Text("Empty slot").font(Theme.font(14))
                            }
                            .foregroundStyle(Theme.inkFaint.opacity(0.7))
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(PixelRect(radius: 10).fill(Theme.bg.opacity(0.45)))
                            .overlay(PixelRect(radius: 10).stroke(Theme.panelEdge, style: StrokeStyle(lineWidth: 2, dash: [6, 4])))
                        }
                    }
                }
                .frame(height: 150 + L.dy * 0.3)
            }
            Spacer()
            HStack {
                GameButton("Reroll $\(v.rerollCost)", style: .plain, enabled: v.money >= v.rerollCost, sound: "reroll") { picked = nil; model.reroll() }
                    .frame(width: 190)
                Spacer()
                GameButton(next, pulse: true) { model.leaveShop() }.frame(width: 210)
            }
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 30).padding(.top, 18).padding(.bottom, 26)
        .frame(width: L.table.width, height: L.table.height)
        .contentShape(Rectangle())
        .onTapGesture { picked = nil }
        .animation(.spring(duration: 0.35), value: v.money)
        .animation(.spring(duration: 0.25), value: picked)
    }
}

/// A relic you own, along the top, with its sell button.
/// A relic you hold, as a card: a banner in its rarity's color, the icon
/// large on a tile with its edition's shine, what it does, and its price to sell.
struct OwnedRelic: View {
    @Environment(GameModel.self) private var model
    let relic: RelicV
    let index: Int

    var body: some View {
        let edge = Theme.rarity[min(relic.rarity, Theme.rarity.count - 1)]
        let jinxed = model.view?.jinxed == relic.key
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text(relic.rarityName.uppercased()).font(Theme.font(11, .bold)).kerning(1).foregroundStyle(Theme.bg)
                Spacer(minLength: 0)
                if jinxed {
                    Text("JINXED").font(Theme.font(11, .bold)).kerning(1).foregroundStyle(Theme.bad)
                } else if let e = relic.edition {
                    Text(e.name.uppercased()).font(Theme.font(11, .bold)).kerning(1)
                        .foregroundStyle(Theme.bg)
                        .padding(.horizontal, 5)
                        .background(PixelRect(radius: 2).fill(Edition.color(e.key)))
                }
            }
            .padding(.horizontal, 10).frame(height: 20)
            .background(edge)
            HStack(alignment: .top, spacing: 10) {
                PixelImage(image: model.art.iconArt(relic.icon))
                    .frame(width: 64, height: 64)
                    .modifier(EditionShine(edition: relic.edition?.key))
                    .saturation(jinxed ? 0 : 1)
                    .padding(4)
                    .background(PixelRect(radius: 6).fill(edge.opacity(0.22)))
                    .overlay(PixelRect(radius: 6).stroke(edge.opacity(0.7), lineWidth: 2))
                VStack(alignment: .leading, spacing: 3) {
                    Text(relic.name).font(Theme.font(16, .bold)).foregroundStyle(Theme.ink)
                        .lineLimit(2).minimumScaleFactor(0.8).fixedSize(horizontal: false, vertical: true)
                    Text(relic.text).font(Theme.font(12)).foregroundStyle(Theme.inkDim)
                        .lineLimit(4).minimumScaleFactor(0.85)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 9).padding(.top, 8)
            Spacer(minLength: 0)
            HStack {
                Spacer()
                Button {
                    model.sell(relic.slot)
                } label: {
                    Text("Sell $\(relic.sell)").font(Theme.font(13, .bold)).foregroundStyle(Theme.ink)
                        .padding(.horizontal, 10).frame(height: 24)
                        .background(PixelRect(radius: 4).fill(Theme.panelEdge).shadow(color: .black.opacity(0.35), radius: 0, x: 1, y: 3))
                }
                .buttonStyle(PressStyle())
            }
            .padding(8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            PixelRect(radius: 8)
                .fill(LinearGradient(colors: [edge.mix(Theme.panel, 0.16), Theme.panel], startPoint: .top, endPoint: .bottom))
                .shadow(color: .black.opacity(0.4), radius: 0, x: 2, y: 5)
        )
        .clipShape(PixelRect(radius: 8))
        .overlay(PixelRect(radius: 8).stroke(edge, lineWidth: 2))
        .shadow(color: .black.opacity(0.4), radius: 0, x: 2, y: 5)
    }
}

extension Color {
    /// This color mixed into another: `amount` of self, the rest `other`.
    func mix(_ other: Color, _ amount: Double) -> Color {
        let a = UIColor(self), b = UIColor(other)
        var (r1, g1, b1, a1, r2, g2, b2, a2): (CGFloat, CGFloat, CGFloat, CGFloat, CGFloat, CGFloat, CGFloat, CGFloat) = (0, 0, 0, 0, 0, 0, 0, 0)
        a.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        b.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let t = CGFloat(amount)
        return Color(red: Double(r1 * t + r2 * (1 - t)), green: Double(g1 * t + g2 * (1 - t)), blue: Double(b1 * t + b2 * (1 - t)))
    }
}

struct Ware: View {
    @Environment(GameModel.self) private var model
    let item: ShopItemV
    let selected: Bool
    let tap: () -> Void
    let buy: () -> Void

    static let cream = Color(hex: 0xf3ead6)
    static let ink = Color(hex: 0x2a2418)

    var body: some View {
        let edge = ShopItemInfo.edge(item)
        let bundle = item.kind == "bundle"
        // Each kind reads at a glance: a banner naming it, and its own card.
        // Relics are plain cream; bundles are wrapped packages; the rest are
        // tinted with their kind's color.
        let fill: Color = bundle ? Color(hex: 0x3b2a63) : item.kind == "relic" ? Self.cream : edge.mix(Self.cream, 0.18)
        VStack(spacing: 0) {
            Text(item.kind == "relic" ? "RELIC" : ShopItemInfo.kindName(item).uppercased())
                .font(Theme.font(13, .bold)).tracking(1.2).foregroundStyle(Theme.bg)
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.horizontal, 22).padding(.vertical, 4)
                .frame(maxWidth: .infinity)
                .background(bundle ? Theme.brass : edge)
            // The item's picture fills the card, edge to edge.
            ZStack {
                if item.kind == "relic" { RelicBurst(color: edge, rays: 8 + 2 * (item.rarity ?? 1)).frame(width: 180, height: 180) }
                if let s = item.seal { SealBadge(seal: s, size: 128) }
                else if let e = item.cardEdition, let sample = model.view?.pack.first(where: { $0.rank == 14 }) ?? model.view?.pack.first {
                    PixelImage(image: model.art.card(sample, fourColor: model.fourColor)).frame(width: 96, height: 134)
                        .modifier(EditionShine(edition: e))
                        .shadow(color: .black.opacity(0.3), radius: 0, x: 3, y: 4)
                }
                else if let g = item.glyph, item.kind == "upgrade" {
                    Text(g).font(.system(size: 118, weight: .heavy)).foregroundStyle(Self.ink)
                        .minimumScaleFactor(0.4).lineLimit(1)
                }
                else if let i = item.icon {
                    PixelImage(image: model.art.iconArt(i))
                        .frame(width: 144, height: 144)
                        .modifier(EditionShine(edition: item.edition?.key))
                        .shadow(color: .black.opacity(0.25), radius: 0, x: 4, y: 4)
                }
            }
            .frame(width: 176, height: 160)
            .clipped()
            if item.kind == "relic", let r = item.rarityName {
                HStack(spacing: 4) {
                    ForEach(0..<max(1, item.rarity ?? 1), id: \.self) { _ in
                        Rectangle().fill(edge).frame(width: 6, height: 6).rotationEffect(.degrees(45))
                    }
                    Text(r).font(Theme.font(12)).foregroundStyle(edge).brightness(-0.3)
                }
                .padding(.bottom, 2)
            }
            Text(item.name).font(Theme.font(16, .bold)).foregroundStyle(bundle ? Self.cream : Self.ink)
                .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.8)
                .padding(.horizontal, 10).padding(.bottom, 12)
                .shadow(color: bundle ? .black.opacity(0.6) : .clear, radius: 0, x: 2, y: 2)
        }
        .frame(width: 176, height: 262)
        .clipShape(PixelRect(radius: 10)) // the banner follows the corners
        .background {
            ZStack {
                Self.cream.opacity(0) // keep the shape's frame
                if bundle {
                    // The ribbon round the package.
                    Theme.brass.frame(width: 14).opacity(0.9)
                    Theme.brass.frame(height: 14).opacity(0.9)
                }
            }
            .background(fill)
            .clipShape(PixelRect(radius: 10))
            .shadow(color: .black.opacity(0.45), radius: 0, x: 0, y: selected ? 10 : 7)
        }
        .overlay(PixelRect(radius: 10).stroke(bundle ? Color(hex: 0x3b2a63) : edge, lineWidth: 4))
        .overlay(PixelRect(radius: 7).stroke(edge.opacity(selected ? 1 : 0.45), lineWidth: 2).padding(6).opacity(bundle ? 0 : 1))
        .overlay(alignment: .topTrailing) {
            if !item.sold {
                Text("$\(item.cost)").font(Theme.font(16, .bold)).foregroundStyle(Self.ink)
                    .frame(minWidth: 40, minHeight: 40)
                    .background(PixelRect(radius: 10).fill(Theme.brass))
                    .overlay(PixelRect(radius: 10).stroke(Theme.brassDim, lineWidth: 3))
                    .offset(x: 12, y: -14)
            }
        }
        .overlay {
            if item.sold {
                ZStack {
                    PixelRect(radius: 10).fill(.black.opacity(0.5))
                    Text("SOLD").font(Theme.font(28, .bold)).foregroundStyle(Self.cream).padding(.horizontal, 8)
                        .overlay(Rectangle().stroke(Self.cream, lineWidth: 3)).rotationEffect(.degrees(-14))
                }
            }
        }
        .rotationEffect(.degrees(selected ? -1.5 : 0))
        .offset(y: selected ? -8 : 0)
        .contentShape(Rectangle())
        .onTapGesture { if !item.sold { tap() } }
        .overlay(alignment: .top) {
            // The card is a fixed 210 tall: hang the details just below it.
            if selected && !item.sold {
                ShopItemInfo(item: item, buy: buy)
                    .frame(width: 280)
                    .fixedSize(horizontal: false, vertical: true)
                    .offset(y: 274)
                    .transition(.opacity)
            }
        }
    }
}

/// What a ware does, and its Buy button.
struct ShopItemInfo: View {
    let item: ShopItemV
    let buy: () -> Void

    static func edge(_ item: ShopItemV) -> Color {
        switch item.kind {
        case "relic": Theme.rarity[min(item.rarity ?? 1, Theme.rarity.count - 1)]
        case "seal": Color(css: item.seal?.color ?? "#d9a441")
        case "pack": Theme.chips
        case "ploy", "bundle": Theme.ploy
        case "edition": Edition.color(item.cardEdition ?? "etched")
        default: Theme.brass
        }
    }

    static func kindName(_ item: ShopItemV) -> String {
        switch item.kind {
        case "relic": "\(item.rarityName ?? "") relic"
        case "edition": "Card edition"
        default: item.kind.prefix(1).uppercased() + item.kind.dropFirst()
        }
    }

    var kindLabel: String {
        switch item.kind {
        case "relic": "\(item.rarityName ?? "") relic"
        case "seal": "Seal"
        case "pack": "Pack"
        case "ploy": "Ploy"
        case "bundle": "Bundle"
        case "edition": "Card edition"
        default: "Upgrade"
        }
    }

    var body: some View {
        let edge = Self.edge(item)
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                if let e = item.edition { EditionTag(edition: e, size: 12) }
                Text(kindLabel).font(Theme.font(13)).foregroundStyle(item.kind == "ploy" || item.kind == "bundle" ? Color(hex: 0xc2adf0) : edge)
            }
            Text(item.name).font(Theme.font(20, .bold)).inkShadow()
            Text(item.text + (item.kind == "relic" ? "" : ".")).font(Theme.font(15)).foregroundStyle(Theme.inkDim)
            if let e = item.edition {
                Text("\(e.name): \(e.text.prefix(1).lowercased() + e.text.dropFirst())")
                    .font(Theme.font(15)).foregroundStyle(Edition.color(e.key))
            }
            if item.kind == "upgrade", let lvl = item.level {
                Text("Lv.\(lvl) → Lv.\(lvl + 1): +\(num(item.chips ?? 0)) chips, +\(item.mult ?? 0, specifier: "%g") mult more")
                    .font(Theme.font(15))
            }
            if item.kind == "pack" { Text("Changes the deck everyone is dealt from. You choose the card.").font(Theme.font(14)) }
            if item.kind == "ploy" { Text("One use. Hold up to 2; use it from the sidebar.").font(Theme.font(14)) }
            if item.kind == "seal" { Text("You choose the card.").font(Theme.font(15)) }
            if item.kind == "edition" { Text("Lasts the run. You choose the card.").font(Theme.font(15)) }
            GameButton(item.canBuy ? "Buy $\(item.cost)" : (item.why ?? "Can't buy"), enabled: item.canBuy, sound: nil) { buy() }
                .padding(.top, 6)
        }
        .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PixelRect(radius: 8).fill(Theme.panel).shadow(color: .black.opacity(0.45), radius: 0, x: 0, y: 6))
        .overlay(PixelRect(radius: 8).stroke(Theme.brassDim, lineWidth: 2))
        .onTapGesture {} // keep taps inside from closing it
    }
}

/// Choose a card from the run's pack for a seal or a pack item.
struct CardPickerView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let item = v.shop?.first { $0.slot == model.pickerSlot }
        let suits = Array(Set(v.pack.map(\.suit))).sorted { a, b in
            (v.pack.first { $0.suit == a }?.suitOrder ?? 0) < (v.pack.first { $0.suit == b }?.suitOrder ?? 0)
        }
        let rows = suits.flatMap { s in v.pack.filter { $0.suit == s }.sorted { $0.rankOrder < $1.rankOrder }.chunked(14) }
        let cols = 14
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea().onTapGesture { model.pickerSlot = nil }
            Panel {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 14) {
                        if let s = item?.seal { SealBadge(seal: s, size: 42) } else if let i = item?.icon { Icon(key: i, scale: 2) }
                        VStack(alignment: .leading) {
                            Text("Choose a card: \(item?.name ?? "")").font(Theme.font(24, .bold)).inkShadow()
                            Text((item?.text ?? "") + ".").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        }
                    }
                    VStack(spacing: 8) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                            HStack(spacing: 4) {
                                ForEach(row) { c in
                                    let blocked = item?.kind == "pack" && model.engine.canApply(slot: item!.slot, cardId: c.id) != nil
                                    Button { model.pickCard(c.id) } label: {
                                        PixelImage(image: model.art.card(c, fourColor: model.fourColor))
                                            .aspectRatio(80 / 112, contentMode: .fit)
                                            .modifier(EditionShine(edition: c.edition))
                                            .overlay(alignment: .topTrailing) {
                                                if let s = c.seal { SealBadge(seal: s, size: 21).offset(x: 3, y: -3) }
                                            }
                                            .opacity(blocked ? 0.35 : 1)
                                    }
                                    .buttonStyle(PressStyle())
                                    .frame(width: (900 - Double(cols - 1) * 4) / Double(cols))
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                    HStack {
                        Text("Costs $\(item?.cost ?? 0) · deck: \(v.pack.count) cards").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        Spacer()
                        GameButton("Cancel", style: .plain) { model.pickerSlot = nil }.frame(width: 140)
                    }
                }
                .padding(.horizontal, 22).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 950)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }
}

/// Rays in a relic's rarity color, fading out from the middle, slowly turning.
struct RelicBurst: View {
    let color: Color
    var rays = 10

    var body: some View {
        // Drawn once.
        Canvas { g, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let r = max(size.width, size.height) / 2
            for i in 0..<rays {
                let a0 = Double(i) / Double(rays) * .pi * 2
                let a1 = a0 + .pi / Double(rays)
                var p = Path()
                p.move(to: c)
                p.addLine(to: CGPoint(x: c.x + cos(a0) * r, y: c.y + sin(a0) * r))
                p.addLine(to: CGPoint(x: c.x + cos(a1) * r, y: c.y + sin(a1) * r))
                p.closeSubpath()
                g.fill(p, with: .color(color.opacity(0.32)))
            }
        }
        // A small turn on each glint, then still.
        .rotationEffect(.degrees(Double(Glint.shared.tick) * 9))
        .animation(.easeInOut(duration: 1.2), value: Glint.shared.tick)
        .mask(RadialGradient(colors: [.white, .white.opacity(0)], center: .center, startRadius: 10, endRadius: 64))
        .allowsHitTesting(false)
    }
}
