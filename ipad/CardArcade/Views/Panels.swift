import SwiftUI

/// The hand's score, counted up line by line, then chips x mult.
struct ScorePanel: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        // While the panel animates out, the next hand has already cleared the
        // result, so draw nothing rather than unwrap it.
        if let v = model.view, let r = v.result { panel(v, r) }
    }

    private func panel(_ v: RunView, _ r: ResultV) -> some View {
        let shown = Array(r.lines.prefix(model.revealShown))
        var chips = 0.0, mult = 1.0
        for l in shown {
            chips += l.chips ?? 0
            mult += l.mult ?? 0
            mult *= l.xmult ?? 1
        }
        let good = r.made
        let title = r.title
        let boardShown = v.score - (model.revealDone ? 0 : r.total)
        let next = v.score >= v.target ? (v.table >= v.tables && v.board >= v.boardsPerTable && !v.endless ? "Victory!" : "Board won!") : v.handsLeft <= 0 ? "Out of \(v.words.hands)" : "Next \(v.words.hand) (\(v.handsLeft) left)"
        // Room for eight lines at full size; with more, the panel grows (to
        // fit the stage) and then the lines tighten, so none is cut off.
        let n = r.lines.count
        let panelH = min(model.layout.H - 120, 500 + Double(max(0, n - 8)) * 25)
        let lineH = max(15, min(25, ((200 + panelH - 500) / Double(max(1, n))).rounded(.down)))
        let lineFont = lineH < 21 ? max(13, lineH - 3) : 17

        return Panel(edge: good ? Theme.good : Theme.bad) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(Theme.font(28, .bold)).foregroundStyle(good ? Theme.good : Theme.bad).inkShadow()
                if let chips = v.scoreChips, !chips.isEmpty {
                    FlowRow(spacing: 6) {
                        ForEach(Array(chips.enumerated()), id: \.offset) { _, c in
                            let color = c.tone == "good" ? Theme.good : c.tone == "bad" ? Theme.bad : Theme.panelEdge
                            Text(c.text).font(Theme.font(14, .bold))
                                .foregroundStyle(c.tone == nil ? Theme.ink : Theme.bg)
                                .padding(.horizontal, 7).padding(.vertical, 2)
                                .background(PixelRect(radius: 4).fill(color))
                                .overlay(PixelRect(radius: 4).stroke(c.me == true ? Theme.ink : .clear, lineWidth: 2))
                        }
                    }
                } else if let line = v.scoreLine {
                    Text(line).font(Theme.font(16)).foregroundStyle(Theme.inkDim)
                }
                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.offset) { _, line in
                        HStack {
                            Text(line.label).foregroundStyle(line.edition.map { Edition.color($0) } ?? Theme.ink)
                            Spacer()
                            if let m = line.money, m != 0 { Text("+$\(num(m))").foregroundStyle(Theme.brass) }
                            if let c = line.chips, c != 0 { Text("+\(num(c))").foregroundStyle(Theme.chips) }
                            if let m = line.mult, m != 0 { Text("+\(m, specifier: "%.2f") mult").foregroundStyle(Theme.mult) }
                            if let x = line.xmult, x != 1 { Text("x\(x, specifier: "%.2f")").foregroundStyle(Theme.mult) }
                        }
                        .font(Theme.font(lineFont)).monospacedDigit()
                        .frame(height: lineH)
                        .transition(.move(edge: .leading).combined(with: .opacity))
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)
                .padding(.top, 8)
                Divider().overlay(Theme.panelEdge)
                HStack(spacing: 8) {
                    pill(num(chips), Theme.chips)
                    Text("x").font(Theme.font(28)).foregroundStyle(Theme.inkDim)
                    pill(String(format: "%.2f", mult), Theme.mult)
                    Spacer()
                    if model.revealDone {
                        let onFire = r.total >= v.target && r.total > 0
                        // A hand that wins the board: the total on an ember
                        // pill, flames licking up from behind it.
                        Text(onFire ? num(r.total) : "= \(num(r.total))").font(Theme.font(30, .bold)).inkShadow(3)
                            .padding(.horizontal, onFire ? 14 : 0).padding(.vertical, onFire ? 2 : 0)
                            .background {
                                if onFire {
                                    PixelRect(radius: 8).fill(LinearGradient(colors: [Color(hex: 0xe8772e), Theme.bad], startPoint: .top, endPoint: .bottom))
                                }
                            }
                            .background(alignment: .bottom) { if onFire { ScoreFire().frame(height: 86) } }
                            .transition(.scale(scale: 1.25).combined(with: .opacity))
                    }
                }
                .frame(height: 50)
                Text("\(v.boardName) \(num(boardShown)) / \(num(v.target))").font(Theme.font(17))
                ProgressBar(fraction: boardShown / max(1, v.target),
                            color: v.score >= v.target && model.revealDone ? Theme.good : Theme.brass, height: 12)
                HStack {
                    Spacer()
                    if model.revealDone {
                        GameButton(next, pulse: true) { model.continueAfterHand() }.frame(width: 220)
                    } else {
                        Text("tap to skip").font(Theme.font(14)).foregroundStyle(Theme.inkFaint).frame(height: 44)
                    }
                }
            }
            .padding(.horizontal, 30).padding(.vertical, 18)
            .foregroundStyle(Theme.ink)
        }
        .frame(width: 580, height: panelH)
        .animation(.spring(duration: 0.3), value: model.revealShown)
        .animation(.spring(duration: 0.3), value: model.revealDone)
        .contentShape(Rectangle())
        .onTapGesture { _ = model.skip() }
    }

    private func pill(_ text: String, _ color: Color) -> some View {
        Text(text).font(Theme.font(28, .bold)).monospacedDigit().contentTransition(.numericText())
            .padding(.horizontal, 12).padding(.vertical, 2)
            .background(PixelRect(radius: 8).fill(color))
    }
}

/// Board won: the payout, itemised, and the way into the club. Like a
/// cash-out, the rows come in one by one with dollar pips, and the total
/// counts up a dollar at a time (the sidebar's money with it). A tap on the
/// panel skips to the end.
struct BoardWonPanel: View {
    @Environment(GameModel.self) private var model
    @State private var shown = 0
    @State private var counted = 0
    @State private var skipped = false

    var body: some View {
        if let v = model.view, let p = v.payout {
            panel(v, p)
                .task { await countUp(v, p) }
                .onDisappear { model.moneyShown = nil }
        }
    }

    private func rows(_ p: PayoutV) -> [(String, Int)] {
        var rows: [(String, Int)] = [("Board", p.board), ("Unused hands", p.unused), ("Interest", p.interest)]
        if p.relics > 0 { rows.append(("Relics", p.relics)) }
        if p.boss > 0 { rows.append(("Boss beaten", p.boss)) }
        return rows
    }

    private func countUp(_ v: RunView, _ p: PayoutV) async {
        let list = rows(p)
        let start = v.money - p.total
        let pace = 1 / max(0.5, model.speed)
        func wait(_ s: Double) async { try? await Task.sleep(for: .seconds(s * pace)) }
        model.moneyShown = start
        await wait(0.45)
        while shown < list.count && !skipped {
            shown += 1
            let amount = list[shown - 1].1
            model.audio.play("tick", pitch: amount > 0 ? 1.1 : 0.85, volume: 0.6)
            await wait(amount > 0 ? 0.3 : 0.2)
        }
        while counted < p.total && !skipped {
            counted += 1
            model.moneyShown = start + counted
            model.audio.play("coin", pitch: Float(0.9 + min(0.6, Double(counted) * 0.05)), volume: 0.5)
            await wait(max(0.07, 0.26 - Double(counted) * 0.025))
        }
        finish(p)
    }

    private func finish(_ p: PayoutV) {
        skipped = true
        shown = rows(p).count
        counted = p.total
        model.moneyShown = nil
    }

    private func panel(_ v: RunView, _ p: PayoutV) -> some View {
        let rows = rows(p)
        return Panel(edge: Theme.brass) {
            VStack(alignment: .leading, spacing: 10) {
                Text("\(v.boardName) won").font(Theme.font(28, .bold)).foregroundStyle(Theme.good).inkShadow()
                Text(v.board == v.boardsPerTable
                     ? (v.table >= v.tables && !v.endless ? "That was the last \(v.words.table.lowercased())." : "\(v.words.table) \(v.table) of \(v.tables) cleared. Next: \(v.words.table.lowercased()) \(v.table + 1).")
                     : "\(v.words.table) \(v.table) of \(v.tables) · next: \(v.tableBoards.first { $0.board == v.board + 1 }?.name ?? "Board \(v.board + 1)")")
                    .font(Theme.font(16)).foregroundStyle(Theme.brass)
                Text("\(num(v.score)) scored against a target of \(num(v.target))").font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                VStack(spacing: 4) {
                    ForEach(Array(rows.enumerated()), id: \.element.0) { i, row in
                        HStack {
                            Text(row.0)
                            Spacer()
                            HStack(spacing: 3) {
                                ForEach(0..<min(row.1, 10), id: \.self) { _ in
                                    PixelRect(radius: 2).fill(Theme.brass).frame(width: 8, height: 8)
                                }
                            }
                            Text("$\(row.1)").foregroundStyle(row.1 > 0 ? Theme.brass : Theme.inkFaint)
                        }
                        .opacity(i < shown ? 1 : 0)
                        .offset(x: i < shown ? 0 : -12)
                        .animation(.easeOut(duration: 0.15), value: shown)
                    }
                    Divider().overlay(Theme.panelEdge)
                    HStack { Text("Total").bold(); Spacer(); Text("$\(counted)").bold().foregroundStyle(Theme.brass).contentTransition(.numericText()) }.font(Theme.font(20))
                }
                .font(Theme.font(17))
                .padding(.top, 10)
                HStack { Spacer(); GameButton("Enter the club", pulse: skipped, sound: nil) { finish(p); model.enterShop() }.frame(width: 200) }
                    .padding(.top, 10)
            }
            .padding(.horizontal, 30).padding(.vertical, 18)
            .foregroundStyle(Theme.ink)
        }
        .contentShape(Rectangle())
        .onTapGesture { if !skipped { finish(p) } }
        .frame(width: 460)
    }
}

struct EndingPanel: View {
    @Environment(GameModel.self) private var model
    let victory: Bool

    var body: some View {
        if let v = model.view { panel(v) }
    }

    private func panel(_ v: RunView) -> some View {
        let s = v.stats
        let rows: [(String, String)] = [
            ("\(v.words.hands.capitalized) played", "\(s.hands)"), ("Made", "\(s.made)"), ("Best \(v.words.hand)", num(s.best)),
            ("Total scored", num(s.total)), ("Ploys used", "\(s.ploysUsed)"), ("Deck", v.deckName), ("Seed", v.seed)
        ]
        return Panel(edge: victory ? Theme.brass : Theme.bad) {
            VStack(alignment: .leading, spacing: 10) {
                Text(victory ? "You beat the club!" : "Out of \(v.words.hands)")
                    .font(Theme.font(44, .bold)).foregroundStyle(victory ? Theme.brass : Theme.bad).inkShadow(4)
                Text(victory ? "You beat all \(v.tables) \(v.words.table.lowercased())s of \(v.title)."
                     : "Fell on \(v.boardName) of \(v.words.table.lowercased()) \(v.table), \(num(max(0, v.target - v.score))) short.")
                    .font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                VStack(spacing: 4) {
                    ForEach(rows, id: \.0) { r in HStack { Text(r.0); Spacer(); Text(r.1).foregroundStyle(Theme.brass) } }
                }
                .font(Theme.font(17)).padding(.top, 10)
                Button { model.shareLog() } label: {
                    Text("Share the game log").underline().font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .trailing)
                HStack {
                    GameButton("Main menu", style: .plain) { model.toMenu() }.frame(width: 160)
                    Spacer()
                    if victory, !v.endless {
                        GameButton("Keep going", style: .ploy) { model.goEndless() }.frame(width: 150)
                    }
                    GameButton("New run", pulse: true) { model.start(v.game, resume: false) }.frame(width: 160)
                }
                .padding(.top, 14)
            }
            .padding(.horizontal, 30).padding(.vertical, 20)
            .foregroundStyle(Theme.ink)
        }
        .frame(width: 540)
    }
}

/// Flames behind a hand's total when that one hand beats the board's goal.
struct ScoreFire: View {
    /// Little pixel flames spread behind the total, flickering in steps, as
    /// on the web: red at the base, then orange, then brass at the tips.
    var body: some View {
        TimelineView(.animation(minimumInterval: 0.12)) { tl in
            let t = Int(tl.date.timeIntervalSinceReferenceDate / 0.12)
            HStack(alignment: .bottom, spacing: 0) {
                ForEach(0..<4, id: \.self) { i in
                    // Tips rise above the pill; each flickers on its own beat.
                    let h = 62.0 + Double((t + i * 2) % 3) * 6 + (i == 1 || i == 2 ? 8 : 0)
                    LinearGradient(stops: [
                        .init(color: Theme.goldLight, location: 0), .init(color: Theme.brass, location: 0.3),
                        .init(color: Color(hex: 0xe8772e), location: 0.3), .init(color: Color(hex: 0xe8772e), location: 0.62),
                        .init(color: Theme.bad, location: 0.62), .init(color: Theme.bad, location: 1)
                    ], startPoint: .top, endPoint: .bottom)
                        .frame(width: 13, height: h)
                        .clipShape(Flame())
                    if i < 3 { Spacer(minLength: 2) }
                }
            }
            .frame(height: 86, alignment: .bottom)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .padding(.horizontal, 6)
            .opacity(0.95)
        }
        .allowsHitTesting(false)
    }
}

/// A flame: a broad tongue, a point at the top and straight sides.
struct Flame: Shape {
    func path(in r: CGRect) -> Path {
        Path { p in
            p.move(to: CGPoint(x: r.midX, y: r.minY))
            p.addLine(to: CGPoint(x: r.minX + r.width * 0.85, y: r.minY + r.height * 0.14))
            p.addLine(to: CGPoint(x: r.maxX, y: r.minY + r.height * 0.3))
            p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX, y: r.minY + r.height * 0.3))
            p.addLine(to: CGPoint(x: r.minX + r.width * 0.15, y: r.minY + r.height * 0.14))
            p.closeSubpath()
        }
    }
}
