import SwiftUI

/// An opened bundle: three choices side by side; take one, or none.
struct BundleView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        if let v = model.view, let open = v.opening { panel(v, open) }
    }

    private func panel(_ v: RunView, _ open: OpeningV) -> some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            Panel(edge: Theme.ploy) {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(open.name).font(Theme.font(26, .bold)).inkShadow()
                        Text("Choose one.").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    }
                    HStack(alignment: .top, spacing: 14) {
                        ForEach(Array(open.options.enumerated()), id: \.offset) { i, c in choice(i, c) }
                    }
                    HStack {
                        Text(open.bundle == "relic" ? "Relics \(v.relicSlotsUsed)/\(v.relicSlots)" : open.bundle == "ploy" ? "Ploys \(v.ploys.count)/\(v.ploySlots)" : "The edition stays on the card for the run.")
                            .font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        Spacer()
                        GameButton("Take none", style: .plain) { model.pickBundle(-1) }.frame(width: 160)
                    }
                }
                .padding(.horizontal, 22).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 860)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }

    private func choice(_ i: Int, _ c: BundleOptionV) -> some View {
        let edge: Color = c.kind == "relic" ? Theme.rarity[min(c.rarity ?? 1, Theme.rarity.count - 1)] : c.kind == "ploy" ? Theme.ploy : Edition.color(c.cardEdition ?? "etched")
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                if let e = c.edition { EditionTag(edition: e, size: 12) }
                Text(c.kind == "relic" ? "\(c.rarityName ?? "") relic" : c.kind == "ploy" ? "Ploy" : "Card edition").font(Theme.font(14)).foregroundStyle(edge)
            }
            HStack {
                Spacer()
                if let card = c.card {
                    PixelImage(image: model.art.card(card, fourColor: model.fourColor)).frame(width: 80, height: 112)
                        .modifier(EditionShine(edition: c.cardEdition))
                } else if let icon = c.icon {
                    Icon(key: icon, scale: 4).modifier(EditionShine(edition: c.edition?.key))
                }
                Spacer()
            }
            .frame(height: 120)
            Text(c.name).font(Theme.font(20, .bold))
            Text(c.text + (c.kind == "relic" ? "" : ".")).font(Theme.font(15)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            GameButton("Take", sound: nil) { model.pickBundle(i) }
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .frame(maxWidth: .infinity, minHeight: 320, alignment: .topLeading)
        .background(PixelRect(radius: 8).fill(Theme.bg))
        .overlay(PixelRect(radius: 8).stroke(edge, lineWidth: 2))
    }
}


/// The table at a glance: its three boards with their goals, hands and
/// payouts, which are won, and the High Board's boss and its rule. Shown
/// before each board starts, and from the sidebar's progress.
struct TableOverview: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let L = model.layout
        let table = v.endless ? v.table : min(v.table, v.tables)
        let current = v.tableBoards.first { $0.board == v.board }
        let playLabel: String = {
            guard let b = current else { return "Back to the table" }
            if b.board == v.boardsPerTable, let boss = v.boss { return "Face \(boss.name)" }
            return v.handsLeft < v.handsThisBoard || v.score > 0 ? "Back to \(b.name)" : "Play \(b.name)"
        }()

        ZStack {
            Color.black.opacity(0.55)
            Panel(edge: v.boss?.active == true ? Theme.bad : Theme.brass) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(v.endless ? "\(v.words.table) \(table) · endless" : "\(v.words.table) \(table) of \(v.tables)").font(Theme.font(34, .bold)).foregroundStyle(Theme.brass).inkShadow(3)
                        Spacer()
                        HStack(spacing: 4) {
                            ForEach(1...v.tables, id: \.self) { t in
                                Rectangle().fill(t < table ? Theme.brass : t == table ? Theme.ink : Theme.panelEdge)
                                    .frame(width: 14, height: 14)
                            }
                        }
                    }
                    Text("Win every board to move on to the next \(v.words.table.lowercased()). Each board's goal must be reached before its \(v.words.hands) run out.")
                        .font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(alignment: .top, spacing: 14) {
                        ForEach(v.tableBoards) { b in
                            BoardColumn(v: v, board: b)
                        }
                    }
                    .frame(height: 360)

                    HStack {
                        Text("Money $\(num(Double(v.money)))").font(Theme.font(18)).foregroundStyle(Theme.brass)
                        Spacer()
                        GameButton(playLabel, pulse: true) { model.showOverview = false }
                            .frame(width: 260)
                    }
                }
                .padding(.horizontal, 28).padding(.vertical, 22)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 820)
            .position(x: L.W / 2 + L.sidebar.width / 2, y: L.H / 2)
        }
    }
}

private struct BoardColumn: View {
    @Environment(GameModel.self) private var model
    let v: RunView
    let board: BoardInfo

    var body: some View {
        let isBoss = board.board == v.boardsPerTable && v.boss != nil
        let won = board.board < v.board || (board.board == v.board && (v.phase == .won || v.phase == .shop))
        let skipped = false
        let now = board.board == v.board && !won
        let edge = isBoss ? Theme.bad : now ? Theme.brass : Theme.panelEdge

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(board.name).font(Theme.font(22, .bold))
                Spacer()
                Text(skipped ? "SKIPPED" : won ? "WON" : now ? "NOW" : "UP NEXT").font(Theme.font(12, .bold)).kerning(1)
                    .foregroundStyle(won ? Theme.good : now ? Theme.brass : Theme.inkFaint)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text("Goal").font(Theme.font(13)).foregroundStyle(Theme.inkDim)
                Text(num(board.goal)).font(Theme.font(34, .bold)).monospacedDigit().inkShadow()
            }
            HStack {
                Text("\(board.hands) \(v.words.hands)").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                Spacer()
                Text("Pays $\(board.reward)+").font(Theme.font(15)).foregroundStyle(Theme.brass)
            }
            if isBoss, let boss = v.boss {
                Rectangle().fill(Theme.panelEdge).frame(height: 2)
                Text("BOSS").font(Theme.font(12, .bold)).kerning(1).foregroundStyle(Theme.bad)
                Text(boss.name).font(Theme.font(20, .bold)).foregroundStyle(Theme.ink)
                Text(boss.text).font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Spacer(minLength: 0)
                Text(skipped ? "Skipped for its tag." : won ? "Done." : now ? "You're here." : "Standard rules.")
                    .font(Theme.font(14)).foregroundStyle(Theme.inkFaint)
            }
            if let tag = board.tag, !won, !skipped {
                Rectangle().fill(Theme.panelEdge).frame(height: 2)
                HStack(spacing: 6) {
                    Icon(key: tag.icon)
                    Text("Skip for \(Text(tag.name).bold())").font(Theme.font(14)).foregroundStyle(Theme.ploy)
                }
                Text(tag.text + ".").font(Theme.font(13)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                if now, v.skipTag != nil {
                    GameButton("Skip \(board.name)", style: .ploy, size: .small) { model.skipBoard() }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(PixelRect(radius: 10).fill(won ? Theme.bg : Theme.panel).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 5))
        .overlay(PixelRect(radius: 10).stroke(edge, lineWidth: now || isBoss ? 3 : 2))
        .opacity(won ? 0.7 : 1)
    }
}

/// The run's deck, a row per suit, each card with its edition and seal;
/// the cards played this hand greyed. Tap a card to read it.
struct DeckView: View {
    @Environment(GameModel.self) private var model
    @State private var looking: CardV?

    var body: some View {
        let v = model.view!
        let played = Set(v.tableView?.played ?? [])
        let suits = Array(Set(v.pack.map(\.suit))).sorted { a, b in
            (v.pack.first { $0.suit == a }?.suitOrder ?? 0) < (v.pack.first { $0.suit == b }?.suitOrder ?? 0)
        }
        let rows = suits.map { s in v.pack.filter { $0.suit == s }.sorted { $0.rankOrder > $1.rankOrder } }
        let cols = Double(max(13, rows.map(\.count).max() ?? 13))
        let w = min(62, (900 - (cols - 1) * 4) / cols)
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea().onTapGesture { model.showDeck = false }
            Panel {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Your deck · \(v.pack.count) cards").font(Theme.font(26, .bold)).inkShadow()
                        Spacer()
                        GameButton("Close", style: .plain, size: .small) { model.showDeck = false }.frame(width: 110)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                            HStack(spacing: 4) {
                                ForEach(row) { c in
                                    PixelImage(image: model.art.card(c, trump: c.trump, fourColor: model.fourColor))
                                        .modifier(EditionShine(edition: c.edition))
                                        .frame(width: w, height: w * 1.4)
                                        .overlay(alignment: .bottomLeading) {
                                            if let e = c.edition { Rectangle().fill(Edition.color(e)).frame(width: w * 0.3, height: 5).offset(x: 2, y: 3) }
                                        }
                                        .overlay(alignment: .topTrailing) {
                                            if let s = c.seal { SealBadge(seal: s, size: 16).offset(x: 3, y: -3) }
                                        }
                                        .overlay { if looking?.id == c.id { PixelRect(radius: 4).stroke(Theme.brass, lineWidth: 2).padding(-2) } }
                                        .opacity(played.contains(c.key) ? 0.3 : 1)
                                        .onTapGesture { looking = looking?.id == c.id ? nil : c }
                                }
                            }
                        }
                    }
                    if let c = looking {
                        HStack(alignment: .top, spacing: 14) {
                            SmallCard(card: c, scale: 0.9)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(c.name.prefix(1).uppercased() + c.name.dropFirst()).font(Theme.font(20, .bold))
                                if played.contains(c.key) { Text("Played this hand").font(Theme.font(13)).foregroundStyle(Theme.inkFaint) }
                                if let e = c.edition { Text("\(e.capitalized) edition").font(Theme.font(15)).foregroundStyle(Edition.color(e)) }
                                if let s = c.seal { Text("\(s.name): \(s.text)").font(Theme.font(15)).foregroundStyle(Color(css: s.color)) }
                                if c.edition == nil && c.seal == nil { Text("A plain card: no edition, no seal.").font(Theme.font(15)).foregroundStyle(Theme.inkDim) }
                            }
                        }
                        .padding(10)
                        .background(PixelRect(radius: 6).fill(Theme.bg))
                    } else {
                        Text("Tap a card to read it. Cards played this hand are greyed.").font(Theme.font(14)).foregroundStyle(Theme.inkFaint)
                    }
                }
                .padding(.horizontal, 22).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 960)
        }
    }
}

/// How to play the game: its own help sections.
struct HelpView: View {
    @Environment(GameModel.self) private var model
    let game: GameInfo

    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea().onTapGesture { model.showHelp = false }
            Panel {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("How to play \(game.title)").font(Theme.font(28, .bold)).foregroundStyle(Theme.brass).inkShadow()
                        Spacer()
                        GameButton("Close", style: .plain, size: .small) { model.showHelp = false }.frame(width: 110)
                    }
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            ForEach(game.help, id: \.title) { s in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(s.title).font(Theme.font(19, .bold)).foregroundStyle(Theme.ink)
                                    Text(s.text).font(Theme.font(16)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.horizontal, 26).padding(.vertical, 20)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 760, height: min(640, model.layout.H - 80))
        }
    }
}

/// Everything a game holds, marked with what you've found, and your stats.
struct CollectionView: View {
    @Environment(GameModel.self) private var model
    let game: GameInfo
    @State private var tab = "Relics"
    private static let tabs = ["Relics", "Ploys", "Bosses", "Decks", "Cards", "Stats"]

    var body: some View {
        let cat = model.catalog(game.id)
        let p = model.profile(game.id)
        let found = Set(p.relicsFound), beaten = Set(p.bossesBeaten)
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea().onTapGesture { model.showCollection = false }
            Panel {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("\(game.title): collection").font(Theme.font(28, .bold)).foregroundStyle(Theme.brass).inkShadow()
                        Spacer()
                        GameButton("Close", style: .plain, size: .small) { model.showCollection = false }.frame(width: 110)
                    }
                    HStack(spacing: 6) {
                        ForEach(Self.tabs, id: \.self) { t in
                            GameButton(t, style: tab == t ? .brass : .plain, size: .small, sound: "select") { tab = t }.frame(width: 100)
                        }
                    }
                    ScrollView {
                        LazyVGrid(columns: [GridItem(.flexible(), alignment: .topLeading), GridItem(.flexible(), alignment: .topLeading)], alignment: .leading, spacing: 10) {
                            if let cat {
                                switch tab {
                                case "Relics":
                                    ForEach(cat.relics) { r in row(icon: r.icon, title: r.name, sub: "\(r.rarityName) · $\(r.cost)", text: r.text, seen: found.contains(r.key)) }
                                case "Ploys":
                                    ForEach(cat.ploys) { r in row(icon: r.icon, title: r.name, sub: "$\(r.cost)", text: r.text, seen: true) }
                                case "Bosses":
                                    ForEach(cat.bosses) { b in row(icon: b.icon ?? "skull", title: b.name, sub: beaten.contains(b.key) ? "Beaten" : "Not beaten yet", text: b.text, seen: beaten.contains(b.key)) }
                                case "Decks":
                                    ForEach(cat.decks) { d in
                                        HStack(alignment: .top, spacing: 10) {
                                            PixelImage(image: model.art.back(d.back)).frame(width: 40, height: 56)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(d.name).font(Theme.font(17, .bold))
                                                Text(d.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                                            }
                                        }
                                    }
                                case "Cards":
                                    ForEach(cat.cardEditions) { e in row(icon: nil, title: "\(e.name) edition", sub: "$\(e.cost)", text: e.text, seen: true, color: Edition.color(e.key)) }
                                    ForEach(cat.seals, id: \.key) { s in
                                        HStack(alignment: .top, spacing: 10) {
                                            SealBadge(seal: s, size: 32)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(s.name).font(Theme.font(17, .bold)).foregroundStyle(Color(css: s.color))
                                                Text(s.text).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                                            }
                                        }
                                    }
                                    ForEach(cat.relicEditions) { e in row(icon: nil, title: "\(e.name) relic", sub: "+$\(e.cost)", text: e.text, seen: true, color: Edition.color(e.key)) }
                                default:
                                    stat("Runs", "\(p.runs)"); stat("Wins", "\(p.wins)")
                                    stat("Best \(game.words.table.lowercased())", "\(p.bestTable)"); stat("Best \(game.words.hand)", num(p.bestHand))
                                    stat("\(game.words.hands.capitalized) played", "\(p.handsPlayed)")
                                    stat("Relics found", "\(found.count) of \(cat.relics.count)")
                                    ForEach(cat.counterNames.sorted(by: { $0.key < $1.key }), id: \.key) { k, name in stat(name, num(p.counters[k] ?? 0)) }
                                }
                            }
                        }
                        if tab == "Stats" && !p.history.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Recent runs").font(Theme.font(18, .bold)).padding(.top, 10)
                                ForEach(p.history.prefix(10)) { h in
                                    HStack {
                                        Text(Date(timeIntervalSince1970: h.started / 1000).formatted(date: .abbreviated, time: .omitted))
                                        Text(h.result.capitalized).foregroundStyle(h.result == "won" ? Theme.good : h.result == "lost" ? Theme.bad : Theme.inkDim)
                                        Spacer()
                                        Text("\(game.words.table) \(h.table), board \(h.board) · best \(num(h.bestHand)) · \(h.seed)").foregroundStyle(Theme.inkDim)
                                    }
                                    .font(Theme.font(14))
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 26).padding(.vertical, 20)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 940, height: min(680, model.layout.H - 60))
        }
    }

    private func row(icon: String?, title: String, sub: String, text: String, seen: Bool, color: Color = Theme.ink) -> some View {
        HStack(alignment: .top, spacing: 10) {
            if let icon { Icon(key: icon, scale: 2).saturation(seen ? 1 : 0).opacity(seen ? 1 : 0.5) }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(title).font(Theme.font(17, .bold)).foregroundStyle(seen ? color : Theme.inkDim)
                    Text(sub).font(Theme.font(13)).foregroundStyle(Theme.inkFaint)
                }
                Text(text).font(Theme.font(14)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        HStack { Text(label).foregroundStyle(Theme.inkDim); Spacer(); Text(value).foregroundStyle(Theme.brass) }
            .font(Theme.font(17)).padding(.horizontal, 10).padding(.vertical, 6)
            .background(PixelRect(radius: 6).fill(Theme.bg))
    }
}
