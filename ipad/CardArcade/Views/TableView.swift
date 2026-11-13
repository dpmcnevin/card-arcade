import SwiftUI

/// The table, for any game: four seats from the shared view (kit/src/view),
/// your hand fanned at the bottom, the trick in the middle. Every card is one
/// keyed view in a single layer, so when a card changes place (played,
/// passed, swept to whoever took the trick) SwiftUI springs it to its new
/// spot and flips it on the way.
struct TableView: View {
    @Environment(GameModel.self) private var model
    @State private var drag: (key: String, at: CGPoint, moved: Bool)?

    private var L: TableLayout { model.layout }

    struct Placement: Identifiable {
        let id: String
        let card: CardV?
        let faceUp: Bool
        let x, y, r, s: Double
        let z: Double
        var lift = 0.0
        var highlight: Color? = nil
        var dim = false
        var opacity = 1.0
        var from: (Double, Double)? = nil
        var delay = 0.0
    }

    var body: some View {
        if let v = model.view, let tv = v.tableView {
            ZStack(alignment: .topLeading) {
                oval
                labels(v, tv)
                ForEach(placements(v, tv)) { p in
                    CardView(card: p.card, faceUp: p.faceUp, highlight: p.highlight, dim: p.dim, lift: p.lift)
                        .scaleEffect(p.s)
                        .rotationEffect(.radians(p.r))
                        .opacity(p.opacity)
                        .position(x: p.x, y: p.y)
                        .zIndex(p.z)
                        .transition(transition(p))
                }
                notes(tv)
                handHitZones(v, tv)
                dummyHitZones(v, tv)
                controls(v, tv)
                if v.phase == .pre, let p = v.prompt { PromptPanel(prompt: p).zIndex(85) }
                if let code = model.asking, let choices = v.cardChoices[code] { CardQuestion(code: code, choices: choices).zIndex(88) }
                if model.showLastTrick, let t = tv.lastTrick {
                    LastTrickPanel(trick: t, seats: tv.seats)
                        .frame(width: L.W, height: L.H)
                        .zIndex(130)
                        .transition(.opacity)
                }
            }
            .frame(width: L.W, height: L.H)
            .animation(.spring(duration: 0.45, bounce: 0.2), value: animationKey(v, tv))
            .animation(.easeOut(duration: 0.15), value: model.showLastTrick)
        }
    }

    /// Changes whenever cards should move.
    private func animationKey(_ v: RunView, _ tv: TableV) -> String {
        let counts = tv.seats.map { "\($0.cards.count)\($0.faceUp)" }.joined()
        return "\(model.deal)|\(counts)|\(tv.trick.count)|\(tv.played.count)|\(model.swept ?? "")|\(model.sweeping)|\(model.picked)|\(model.handOrder)|\(drag?.key ?? "")|\(Int(drag?.at.x ?? 0) / 8)|\(Int(drag?.at.y ?? 0) / 8)|\(model.hovered ?? "")|\(v.phase)|\(model.busy)"
    }

    private func transition(_ p: Placement) -> AnyTransition {
        let insertion: AnyTransition = p.from.map { f in
            AnyTransition.offset(x: f.0 - p.x, y: f.1 - p.y).animation(.spring(duration: 0.5, bounce: 0.2).delay(p.delay))
        } ?? .opacity
        return .asymmetric(insertion: insertion, removal: .opacity)
    }

    // MARK: - Placements

    /// Your hand as shown: in order, with a dragged card already in its new place.
    private func shownHand(_ seat: SeatV) -> [CardV] {
        var mine = model.ordered(seat.cards)
        if let d = drag, d.moved, let from = mine.firstIndex(where: { $0.key == d.key }) {
            let card = mine.remove(at: from)
            let slots = L.handSlots(mine.count + 1)
            var index = 0
            for (i, s) in slots.enumerated() where s.cx < d.at.x { index = i + 1 }
            mine.insert(card, at: min(index, mine.count))
        }
        return mine
    }

    private func placements(_ v: RunView, _ tv: TableV) -> [Placement] {
        var out: [Placement] = []
        let key = { (c: CardV) in "\(model.deal)-\(c.id)" }
        let deck = L.deckPoint
        let total = tv.seats.reduce(0) { $0 + $1.cards.count }
        let step = min(0.03, 0.7 / Double(max(1, total))) / model.speed
        var order = 0
        let myTurn = v.phase == .play && !model.busy && !tv.legal.isEmpty
        let ringed = Set(tv.ringed)
        let picking = v.phase == .pre && v.pickCount > 0

        // Your hand.
        if let seat = tv.seat("S") {
            let mine = shownHand(seat)
            let slots = L.handSlots(mine.count)
            for (i, c) in mine.enumerated() {
                let s = slots[i]
                let picked = model.picked.contains(c.code)
                let legal = model.isLegal(c)
                let hovered = model.hovered == c.key && (legal || picking)
                let lift = (picked ? 30.0 : hovered ? 22 : (legal ? 8 : 0)) * L.handScale
                var p = Placement(
                    id: key(c), card: c, faceUp: seat.faceUp, x: s.cx, y: s.cy - lift,
                    r: picked || hovered ? 0 : s.r, s: (hovered ? 1.08 : 1) * L.handScale, z: hovered ? 45 : 10 + Double(i), lift: lift,
                    highlight: picked ? Theme.ploy : (ringed.contains(c.key) || hovered ? Theme.brass : nil),
                    dim: myTurn && seat.playable && !legal)
                if let d = drag, d.moved, d.key == c.key {
                    let drop = legal && L.isOverTrick(d.at)
                    p = Placement(id: key(c), card: c, faceUp: true, x: d.at.x, y: d.at.y, r: 0, s: 1.1 * L.handScale, z: 95,
                                  lift: 26, highlight: drop ? Theme.good : nil)
                }
                p.from = deck
                p.delay = Double(order) * step
                order += 1
                out.append(p)
            }
        }

        // The other seats.
        for pos in ["W", "N", "E"] {
            guard let seat = tv.seat(pos) else { continue }
            let spots = L.seatSlots(pos, seat.cards.count, faceUp: seat.faceUp)
            let shown = seat.faceUp ? model.ordered(seat.cards) : seat.cards
            for (i, c) in shown.enumerated() {
                let sp = spots[i]
                let legal = seat.playable && model.isLegal(c)
                out.append(Placement(id: key(c), card: c, faceUp: seat.faceUp, x: sp.x, y: sp.y - (legal ? 8 : 0), r: sp.r, s: sp.s,
                                     z: 5 + Double(i), lift: legal ? 6 : 0,
                                     dim: myTurn && seat.playable && !legal,
                                     from: deck, delay: Double(order) * step))
                order += 1
            }
        }

        // The trick, until it's been swept to whoever took it.
        let done = tv.trickDone
        let gone = done && model.swept == tv.trickKey
        if !gone {
            let hidden = Set(tv.hidden)
            let to = done ? tv.lastTrick.map { L.origin($0.winner) } : nil
            for (i, t) in tv.trick.enumerated() {
                let (x, y) = L.trickPoint(t.pos)
                let won = done && tv.lastTrick?.winner == t.pos
                let off = model.sweeping && to != nil
                out.append(Placement(id: key(t.card), card: t.card, faceUp: !hidden.contains(t.card.key),
                                     x: off ? to!.0 : x, y: off ? to!.1 : y, r: tossAngle(t.card),
                                     s: (off ? 0.5 : won ? 1.06 : 1) * L.trickScale, z: 60 + Double(i), lift: won ? 10 : 2,
                                     highlight: won && !off ? Theme.brass : nil, opacity: off ? 0 : 1,
                                     from: L.origin(t.pos)))
            }
        }
        return out
    }

    // MARK: - Input

    private static let dragThreshold = 22.0

    /// Stable hit zones for your hand (the sprites move; these don't).
    private func handHitZones(_ v: RunView, _ tv: TableV) -> some View {
        let mine = tv.seat("S").map { model.ordered($0.cards) } ?? []
        let slots = L.handSlots(mine.count)
        let cw = L.handCardW, ch = L.handCardH, reach = 34 * L.handScale
        return ForEach(Array(mine.enumerated()), id: \.element.id) { i, c in
            let s = slots[i]
            ZStack(alignment: .topLeading) {
                Color.clear.frame(width: cw, height: ch + reach)
                Color.white.opacity(0.001)
                    .frame(width: s.w, height: ch + reach)
                    .contentShape(Rectangle())
                    .gesture(cardGesture(c, mine: mine, slots: slots))
            }
            .frame(width: cw, height: ch + reach, alignment: .topLeading)
            .rotationEffect(.radians(s.r), anchor: UnitPoint(x: 0.5, y: (reach + ch / 2) / (ch + reach)))
            .position(x: s.cx, y: s.cy - reach / 2)
            .zIndex(80 + Double(i) * 0.01)
            .onHover { inside in model.hovered = inside ? c.key : (model.hovered == c.key ? nil : model.hovered) }
        }
    }

    /// Tap zones for a seat you play from across the table (Bridge's dummy).
    @ViewBuilder
    private func dummyHitZones(_ v: RunView, _ tv: TableV) -> some View {
        if let seat = tv.seat("N"), seat.playable, seat.faceUp {
            let cards = model.ordered(seat.cards)
            let spots = L.seatSlots("N", cards.count, faceUp: true)
            let w = cards.count > 1 ? abs(spots[1].x - spots[0].x) : TableLayout.cardW * 0.9
            ForEach(Array(cards.enumerated()), id: \.element.id) { i, c in
                Color.white.opacity(0.001)
                    .frame(width: i == cards.count - 1 ? TableLayout.cardW * 0.9 : w, height: TableLayout.cardH * 0.9)
                    .contentShape(Rectangle())
                    .position(x: spots[i].x - TableLayout.cardW * 0.45 + (i == cards.count - 1 ? TableLayout.cardW * 0.45 : w / 2), y: spots[i].y)
                    .onTapGesture { model.tap(c) }
                    .zIndex(80)
            }
        }
    }

    private func cardGesture(_ c: CardV, mine: [CardV], slots: [TableLayout.Slot]) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("stage"))
            .onChanged { g in
                let moved = (drag?.moved ?? false) || hypot(g.translation.width, g.translation.height) > Self.dragThreshold
                if moved && !(drag?.moved ?? false) { model.audio.play("card_hover", volume: 0.6, jitter: 0.1) }
                drag = (c.key, g.location, moved)
            }
            .onEnded { g in
                let d = drag
                drag = nil
                guard let d, d.moved else { return model.tap(c) }
                if model.isLegal(c) && L.isOverTrick(g.location) { return model.play(c) }
                var index = 0
                for (j, s) in slots.enumerated() where mine[j].key != c.key && s.cx < g.location.x { index += 1 }
                model.reorder(c.key, to: index, in: mine)
            }
    }

    // MARK: - Decoration

    private var oval: some View {
        PixelEllipse()
            .fill(Theme.feltEdge.opacity(0.55))
            .overlay(PixelEllipse().stroke(Theme.brassDim.opacity(0.6), lineWidth: 2))
            .overlay(PixelEllipse().stroke(Theme.brassDim.opacity(0.6), lineWidth: 2).padding(8))
            .frame(width: L.ovalRX * 2, height: L.ovalRY * 2)
            .position(x: L.tableCX, y: L.trickCY)
            .contentShape(Rectangle())
            .onTapGesture { _ = model.skip() }
    }

    private func labels(_ v: RunView, _ tv: TableV) -> some View {
        ZStack {
            ForEach(tv.seats, id: \.pos) { seat in
                let (x, y) = L.labelPoint(seat.pos)
                let you = seat.pos == "S"
                // West and East hug the table's edges, so a long label stays on it.
                let align: Alignment = seat.pos == "W" ? .leading : seat.pos == "E" ? .trailing : .center
                let w = 320.0
                let cx = seat.pos == "W" ? L.table.minX + 16 + w / 2 : seat.pos == "E" ? L.W - 16 - w / 2 : x
                seatLabel(seat, note: you && v.phase == .play && !tv.legal.isEmpty && !model.busy && seat.playable ? "Your play" : nil)
                    .frame(width: w, alignment: align)
                    .position(x: cx, y: y + (seat.pos == "N" && seat.faceUp ? 24 : 0))
            }
            if let b = tv.banner {
                HStack(spacing: 8) {
                    if let t = tv.trump, let rows = PixelSprite.suits[t] {
                        PixelSprite(rows: rows, color: suitColor(t))
                    }
                    Text(b).font(Theme.font(16)).foregroundStyle(Theme.ink)
                }
                .padding(.horizontal, 12).padding(.vertical, 4)
                .background(PixelRect(radius: 6).fill(Theme.sidebar.opacity(0.85)))
                .overlay(PixelRect(radius: 6).stroke(Theme.brassDim, lineWidth: 2))
                .frame(width: 520, alignment: .leading)
                .position(x: L.table.minX + 16 + 260, y: 26)
            }
            if tv.trickDone, model.swept != tv.trickKey, let t = tv.lastTrick, v.phase == .play || v.phase == .scored {
                let name = tv.seat(t.winner)?.name ?? t.winner
                Text(name == "You" ? "You take it" : "\(name) takes it")
                    .font(Theme.font(18, .bold))
                    .foregroundStyle(t.winner == "S" ? Theme.good : Theme.inkDim)
                    .inkShadow()
                    .position(x: L.tableCX, y: L.trickCY + L.ovalRY - 16)
            }
            if v.spotlight {
                Text("SPOTLIGHT").font(Theme.font(12, .bold)).kerning(1).foregroundStyle(Theme.ink)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(PixelRect(radius: 4).fill(Theme.ploy))
                    .position(x: L.tableCX + 170, y: L.labelPoint("S").1)
            }
        }
    }

    /// Words on played cards (Whist 22's Fool: 22 or 0).
    private func notes(_ tv: TableV) -> some View {
        ZStack {
            if !(tv.trickDone && model.swept == tv.trickKey) && !model.sweeping {
                ForEach(tv.trick.filter { $0.note != nil }, id: \.card.id) { t in
                    let (x, y) = L.trickPoint(t.pos)
                    Text(t.note!.text).font(Theme.font(13, .bold))
                        .foregroundStyle(t.note!.high == true ? Theme.bg : Theme.ink)
                        .padding(.horizontal, 6).padding(.vertical, 1)
                        .background(PixelRect(radius: 3).fill(t.note!.high == true ? Theme.brass : Theme.panelEdge))
                        .position(x: x, y: y + TableLayout.cardH * L.trickScale / 2 + 4)
                }
            }
        }
        .zIndex(70)
        .allowsHitTesting(false)
    }

    @ViewBuilder
    private func controls(_ v: RunView, _ tv: TableV) -> some View {
        let mine = tv.seat("S")?.cards.count ?? 0
        if v.inHand && mine > 1 && tv.seat("S")?.faceUp == true {
            HStack(spacing: 6) {
                Text("Sort").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                GameButton("Suit", style: model.sortByRank || !model.handOrder.isEmpty ? .plain : .brass, size: .small, sound: nil) { model.resort(byRank: false) }
                    .frame(width: 66)
                GameButton("Rank", style: model.sortByRank && model.handOrder.isEmpty ? .brass : .plain, size: .small, sound: nil) { model.resort(byRank: true) }
                    .frame(width: 66)
            }
            .position(x: L.sidebar.width + 120, y: L.handY - 70)
            .zIndex(90)
        }
        if v.inHand {
            GameButton("Deck", style: .plain, size: .small) { model.showDeck = true }
                .frame(width: 90)
                .position(x: L.sidebar.width + 120, y: L.handY - 112)
                .zIndex(90)
        }
        if v.phase == .play {
            GameButton("Last trick", style: .plain, size: .small, enabled: tv.lastTrick != nil) { model.showLastTrick = true }
                .frame(width: 150)
                .position(x: L.W - 95, y: L.handY - 112)
                .zIndex(90)
            if v.canPlayOut && !model.busy {
                GameButton(v.canClaim ? "Claim the rest" : "Play it out", style: v.canClaim ? .brass : .plain, size: .small, pulse: v.canClaim) { model.playOut() }
                    .frame(width: 150)
                    .position(x: L.W - 95, y: L.handY - 70)
                    .zIndex(90)
            }
        }
    }

    private func suitColor(_ suit: Int) -> Color {
        switch suit {
        case 2, 3: Color(hex: 0xf08a8a)
        default: Theme.ink
        }
    }

    private func seatLabel(_ seat: SeatV, note: String?) -> some View {
        HStack(spacing: 6) {
            if seat.dealer {
                Text("D").font(Theme.font(12, .bold)).foregroundStyle(Theme.bg)
                    .frame(width: 18, height: 18).background(PixelEllipse(px: 2).fill(Theme.ink))
            }
            Text(seat.name.uppercased()).foregroundStyle(seat.active ? Theme.brass : Theme.inkDim).inkShadow()
            if let t = seat.tally, !t.isEmpty {
                Text(t).font(Theme.font(13, .bold)).foregroundStyle(Theme.ink)
                    .padding(.horizontal, 7).background(PixelRect(radius: 4).fill(Theme.panelEdge))
            }
            if let note { Text(note).foregroundStyle(Theme.brass) }
        }
        .font(Theme.font(14))
    }
}

/// A card that asks a question first (Whist 22's Fool: high or low).
struct CardQuestion: View {
    @Environment(GameModel.self) private var model
    let code: String
    let choices: [CardChoiceV]

    var body: some View {
        let L = model.layout
        ZStack {
            Color.black.opacity(0.3).onTapGesture { model.asking = nil }
            Panel(edge: Theme.brass) {
                VStack(spacing: 12) {
                    Text("Play it as?").font(Theme.font(22, .bold)).inkShadow()
                    HStack(spacing: 10) {
                        ForEach(choices, id: \.action) { c in
                            GameButton(c.label, pulse: true) { model.answer(c) }.frame(width: 150)
                        }
                    }
                    Button("Cancel") { model.asking = nil }.font(Theme.font(14)).foregroundStyle(Theme.inkDim).buttonStyle(.plain)
                }
                .padding(18)
                .foregroundStyle(Theme.ink)
            }
            .fixedSize()
            .position(x: L.tableCX, y: L.trickCY)
        }
        .frame(width: L.W, height: L.H)
    }
}

/// The last finished trick: the cards in the order they were played, who
/// played each, and who took it. Tap anywhere to close.
struct LastTrickPanel: View {
    @Environment(GameModel.self) private var model
    let trick: LastTrickV
    let seats: [SeatV]

    var body: some View {
        let L = model.layout
        let name = { (p: String) in seats.first { $0.pos == p }?.name ?? p }
        ZStack {
            Color.black.opacity(0.4)
            Panel(edge: Theme.brass) {
                VStack(spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Last trick").font(Theme.font(26, .bold)).foregroundStyle(Theme.brass).inkShadow()
                        Spacer()
                        Text(name(trick.winner) == "You" ? "You took it" : "\(name(trick.winner)) took it").font(Theme.font(18))
                    }
                    HStack(spacing: 18) {
                        ForEach(Array(trick.plays.enumerated()), id: \.offset) { i, p in
                            VStack(spacing: 8) {
                                CardView(card: p.card, faceUp: true, highlight: p.pos == trick.winner ? Theme.brass : nil,
                                         lift: p.pos == trick.winner ? 8 : 2)
                                    .scaleEffect(1.2)
                                    .frame(width: TableLayout.cardW * 1.2, height: TableLayout.cardH * 1.2)
                                Text(name(p.pos)).font(Theme.font(16))
                                    .foregroundStyle(p.pos == trick.winner ? Theme.brass : Theme.inkDim)
                                Text(i == 0 ? "led" : " ").font(Theme.font(12)).foregroundStyle(Theme.inkFaint)
                            }
                        }
                    }
                    Text("tap to close").font(Theme.font(13)).foregroundStyle(Theme.inkFaint)
                }
                .padding(.horizontal, 26).padding(.vertical, 18)
                .foregroundStyle(Theme.ink)
            }
            .frame(width: 600)
            .position(x: L.tableCX, y: L.trickCY)
        }
        .contentShape(Rectangle())
        .onTapGesture { model.showLastTrick = false }
    }
}
