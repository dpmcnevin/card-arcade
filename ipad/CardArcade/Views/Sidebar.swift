import SwiftUI

/// The run's status, for any game: table and board, goal and score, this
/// hand at a glance (the game's own rows), money, levels, ploys and relics.
struct Sidebar: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        let v = model.view!
        let pending = v.phase == .scored && (model.holding || !model.revealDone) ? (v.result?.total ?? 0) : 0
        let shown = v.score - pending
        let won = v.score >= v.target
        VStack(alignment: .leading, spacing: 11) {
            VStack(alignment: .leading, spacing: 4) {
                Text(v.title.uppercased()).font(Theme.font(19, .bold)).kerning(1).foregroundStyle(Theme.brass).inkShadow()
                    .lineLimit(1).minimumScaleFactor(0.7)
                RunProgress(v: v)
                    .contentShape(Rectangle())
                    .onTapGesture { model.showOverview = true }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    stat("\(v.boardName) goal", num(v.target))
                    Spacer()
                    stat("Scored", num(shown), color: won ? Theme.good : Theme.ink, trailing: true)
                }
                ProgressBar(fraction: shown / max(1, v.target), color: won ? Theme.good : Theme.brass)
                HStack(spacing: 5) {
                    Text("\(v.words.hands.capitalized) left").font(Theme.font(13)).foregroundStyle(Theme.inkDim)
                    ForEach(0..<max(v.handsThisBoard, v.handsLeft), id: \.self) { i in
                        Rectangle().fill(i + 1 > v.handsLeft ? Theme.panelEdge : Theme.brass).frame(width: 11, height: 11)
                    }
                    Spacer()
                    Text("\(v.handsLeft)").font(Theme.font(14))
                        .foregroundStyle(v.handsLeft <= 1 && !won ? Theme.bad : Theme.ink)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(PixelRect(radius: 10).fill(Theme.panel))
            .overlay(PixelRect(radius: 10).stroke(Theme.brassDim, lineWidth: 2))
            .padding(.horizontal, -6)
            .animation(.easeOut(duration: 0.6), value: shown)

            if let h = v.handInfo {
                VStack(alignment: .leading, spacing: 3) {
                    Text(h.title).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                    ForEach(Array(h.rows.enumerated()), id: \.offset) { _, r in
                        HStack {
                            Text(r.label).foregroundStyle(Theme.inkDim)
                            Spacer()
                            Text(r.value).foregroundStyle(r.hot == true ? Theme.bad : Theme.ink)
                        }
                        .font(Theme.font(14))
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top) {
                    stat("Money", "$\(num(model.moneyShown ?? v.money))", color: Theme.brass)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Interest").font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                        Text("+$\(v.interest)").font(Theme.font(17)).foregroundStyle(Theme.inkDim)
                    }
                }
                let up = v.levels.filter { $0.level > 1 }
                let enhanced = v.pack.filter { $0.edition != nil || $0.seal != nil }.count
                Text("Deck \(v.pack.count)\(enhanced > 0 ? " · \(enhanced) enhanced" : "") · see")
                    .font(Theme.font(13)).foregroundStyle(Theme.inkFaint)
                    .contentShape(Rectangle())
                    .onTapGesture { model.showDeck = true }
                if !up.isEmpty {
                    FlowRow(spacing: 8) {
                        ForEach(up) { l in
                            HStack(spacing: 4) {
                                Icon(key: l.icon, scale: 1)
                                Text("\(l.glyph ?? l.name) \(l.level)").foregroundStyle(Theme.brass)
                            }
                            .font(Theme.font(14))
                            .contentShape(Rectangle())
                            .onTapGesture(coordinateSpace: .named("stage")) { p in
                                model.inspect = InfoCard(kind: "Level \(l.level)", title: l.name, text: l.text,
                                                         note: "Now +\(num(l.chips)) chips, +\(String(format: "%g", l.mult)) mult",
                                                         color: Theme.brass, y: p.y)
                            }
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Ploys \(v.ploys.count)/\(v.ploySlots)").font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                HStack(spacing: 6) {
                    ForEach(0..<v.ploySlots, id: \.self) { i in
                        if i < v.ploys.count {
                            let p = v.ploys[i]
                            HStack(spacing: 5) {
                                Icon(key: p.icon, scale: 1.2)
                                Text(p.name).font(Theme.font(13)).lineLimit(1).minimumScaleFactor(0.7)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 5).frame(height: 28).frame(maxWidth: .infinity)
                            .background(PixelRect(radius: 2).fill(p.canUse ? Theme.ploy.opacity(0.35) : Theme.panel))
                            .overlay(PixelRect(radius: 2).stroke(Theme.ploy, lineWidth: 2))
                            .contentShape(Rectangle())
                            .onTapGesture(coordinateSpace: .named("stage")) { pt in
                                model.inspect = InfoCard(kind: "Ploy", title: p.name, text: p.text,
                                                         note: p.canUse ? nil : "Can't use it now\(p.why.map { ": \($0)" } ?? "")",
                                                         color: Theme.ploy, y: pt.y, ploySlot: p.slot)
                            }
                        } else {
                            PixelRect(radius: 2).stroke(Theme.panelEdge, style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
                                .frame(height: 28).frame(maxWidth: .infinity)
                        }
                    }
                }
            }

            let rowH = model.layout.H < 800 ? 28.0 : 34.0
            VStack(alignment: .leading, spacing: 2) {
                Text("Relics \(v.relicSlotsUsed)/\(v.relicSlots)").font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                ForEach(0..<(v.relics.count + max(0, v.relicSlots - v.relicSlotsUsed)), id: \.self) { i in
                    if i < v.relics.count {
                        let r = v.relics[i]
                        let jinxed = v.jinxed == r.key
                        HStack(spacing: 6) {
                            Icon(key: r.icon, scale: 1.4).modifier(EditionShine(edition: r.edition?.key)).saturation(jinxed ? 0 : 1)
                            PixelRect(radius: 1).fill(Theme.rarity[min(r.rarity, Theme.rarity.count - 1)]).frame(width: 3, height: rowH - 12)
                            VStack(alignment: .leading, spacing: -1) {
                                if jinxed {
                                    Text("JINXED").font(Theme.font(10, .bold)).kerning(1).foregroundStyle(Theme.bad)
                                } else if let e = r.edition { EditionTag(edition: e, size: 10) }
                                Text(r.name).font(Theme.font(14)).lineLimit(1)
                                    .foregroundStyle(jinxed ? Theme.inkFaint : Theme.ink)
                                    .strikethrough(jinxed, color: Theme.bad)
                            }
                            Spacer(minLength: 0)
                        }
                        .frame(height: rowH)
                        .background(PixelRect(radius: 5).fill(Theme.panel))
                        .padding(.horizontal, -4)
                        .contentShape(Rectangle())
                        .onTapGesture(coordinateSpace: .named("stage")) { p in
                            var notes: [String] = []
                            if let e = r.edition { notes.append("\(e.name): \(e.text)") }
                            if jinxed { notes.append("Jinxed: does nothing this board") }
                            notes.append("Sells for $\(r.sell)")
                            model.inspect = InfoCard(kind: "\(r.rarityName) relic", title: r.name, text: r.text,
                                                     note: notes.joined(separator: "\n"), color: Theme.rarity[min(r.rarity, Theme.rarity.count - 1)],
                                                     y: p.y, sellSlot: r.slot)
                        }
                    } else {
                        PixelRect(radius: 5).fill(Theme.bg).frame(height: rowH).padding(.horizontal, -4)
                    }
                }
            }
            .frame(minHeight: 0, maxHeight: .infinity, alignment: .top)
            .clipped()
            .layoutPriority(-1)
            SpeedSlider(width: model.layout.sidebar.width - 36)
            HStack(spacing: 4) {
                Text("Seed \(v.seed) · \(v.deckName) ·").font(Theme.font(12)).foregroundStyle(Theme.inkFaint).lineLimit(1)
                Button { model.shareLog() } label: { Text("log").underline().font(Theme.font(12)).foregroundStyle(Theme.inkDim) }
                    .buttonStyle(.plain)
            }
        }
        .foregroundStyle(Theme.ink)
        .padding(.horizontal, 18).padding(.vertical, 14)
        .frame(width: model.layout.sidebar.width, height: model.layout.sidebar.height, alignment: .topLeading)
        .background(Theme.sidebar)
        .overlay(alignment: .trailing) { Rectangle().fill(Theme.brassDim).frame(width: 3) }
    }

    private func stat(_ label: String, _ value: String, color: Color = Theme.ink, trailing: Bool = false) -> some View {
        VStack(alignment: trailing ? .trailing : .leading, spacing: 0) {
            Text(label).font(Theme.font(14)).foregroundStyle(Theme.inkDim).lineLimit(1).minimumScaleFactor(0.7)
            Text(value).font(Theme.font(28, .bold)).monospacedDigit().foregroundStyle(color).inkShadow()
                .contentTransition(.numericText())
        }
    }
}

/// Where the run stands: which table, and which of its boards are won,
/// current and to come; the boss.
struct RunProgress: View {
    let v: RunView

    private var boardWon: Bool { v.phase == .won || v.phase == .shop || v.phase == .victory }

    var body: some View {
        let table = v.endless ? v.table : min(v.table, v.tables)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(v.endless ? "\(v.words.table) \(table) · endless" : "\(v.words.table) \(table) of \(v.tables)").font(Theme.font(16))
                Spacer()
                HStack(spacing: 3) {
                    ForEach(1...max(1, v.tables), id: \.self) { t in
                        let done = t < table || (t == table && boardWon && v.board == v.boardsPerTable)
                        Rectangle()
                            .fill(done ? Theme.brass : t == table ? Theme.ink : Theme.panelEdge)
                            .frame(width: 9, height: 9)
                    }
                }
            }
            HStack(spacing: 4) {
                ForEach(v.tableBoards) { b in
                    let done = b.board < v.board || (b.board == v.board && boardWon)
                    let current = b.board == v.board && !done
                    Text(b.name)
                        .font(Theme.font(12)).lineLimit(1).minimumScaleFactor(0.6)
                        .foregroundStyle(current ? Theme.bg : done ? Theme.good : Theme.inkFaint)
                        .frame(maxWidth: .infinity).frame(height: 20)
                        .background(PixelRect(radius: 4).fill(current ? Theme.brass : Theme.panel))
                        .overlay(PixelRect(radius: 4).stroke(done ? Theme.good : .clear, lineWidth: 2))
                }
            }
            if let boss = v.boss {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 6) {
                        Text(boss.active ? "BOSS NOW" : "BOSS").font(Theme.font(11, .bold)).kerning(1)
                            .foregroundStyle(boss.active ? Theme.bad : Theme.inkDim)
                        Text(boss.name).font(Theme.font(14)).foregroundStyle(boss.active ? Theme.ink : Theme.inkDim)
                    }
                    if boss.active {
                        Text(boss.text).font(Theme.font(12)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 8).padding(.vertical, 5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(PixelRect(radius: 4).fill(Theme.panel))
                .overlay(PixelRect(radius: 4).stroke(boss.active ? Theme.bad : .clear, lineWidth: 2))
            }
        }
    }
}
