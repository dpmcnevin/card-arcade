import SwiftUI

/// The arcade's front room: a tile per game, and the picked game's page with
/// its starting decks, a run to continue or start, its help and collection.
struct MenuView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        @Bindable var model = model
        let L = model.layout
        let g = model.info(model.selected) ?? model.games[0]
        VStack(spacing: 18 + L.dy * 0.1) {
            VStack(spacing: 2) {
                Text("CARD ARCADE").font(Theme.font(64, .bold)).kerning(4).foregroundStyle(Theme.brass).inkShadow(5)
                Text("Card roguelikes in one style: five games, one club").font(Theme.font(18)).foregroundStyle(Theme.inkDim)
            }
            .padding(.top, 24 + L.dy * 0.2)

            HStack(spacing: 16) {
                ForEach(model.games) { game in tile(game, selected: game.id == g.id) }
            }

            page(g)
                .frame(width: 1100)

            Spacer(minLength: 0)
            HStack(spacing: 22) {
                toggle("Music", $model.music)
                toggle("Sound", $model.sfx)
                toggle("Four colors", $model.fourColor)
                SpeedSlider(width: 260)
                Spacer()
                Text("v\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "") · \(model.engineVersion)")
                    .font(Theme.font(13)).foregroundStyle(Theme.inkFaint)
            }
            .frame(width: 1100)
            .padding(.bottom, 20)
        }
        .foregroundStyle(Theme.ink)
        .frame(width: L.W, height: L.H)
        .background(Felt())
    }

    private func tile(_ game: GameInfo, selected: Bool) -> some View {
        Button {
            model.audio.play("select")
            model.selected = game.id
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    ForEach(0..<3, id: \.self) { i in
                        PixelImage(image: model.art.back(game.back))
                            .frame(width: 60, height: 84)
                            .rotationEffect(.degrees(Double(i - 1) * 12), anchor: .bottom)
                            .offset(x: Double(i - 1) * 14)
                            .shadow(color: .black.opacity(0.35), radius: 0, x: 2, y: 3)
                    }
                }
                .frame(height: 100)
                Text(game.title).font(Theme.font(22, .bold)).lineLimit(1).minimumScaleFactor(0.7)
                    .foregroundStyle(selected ? Theme.brass : Theme.ink)
                Text(game.tagline).font(Theme.font(13)).foregroundStyle(Theme.inkDim)
                    .multilineTextAlignment(.center).lineLimit(2).frame(height: 34, alignment: .top)
                if model.hasSave(game.id) {
                    Text("RUN IN PROGRESS").font(Theme.font(11, .bold)).kerning(1).foregroundStyle(Theme.good)
                } else {
                    Text(" ").font(Theme.font(11))
                }
            }
            .padding(12)
            .frame(width: 204, height: 236)
            .background(PixelRect(radius: 10).fill(selected ? Theme.panel : Theme.sidebar.opacity(0.85))
                .shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: selected ? 8 : 5))
            .overlay(PixelRect(radius: 10).stroke(selected ? Theme.brass : Theme.panelEdge, lineWidth: selected ? 3 : 2))
            .offset(y: selected ? -6 : 0)
        }
        .buttonStyle(PressStyle())
        .animation(.spring(duration: 0.25), value: selected)
    }

    private func page(_ g: GameInfo) -> some View {
        let saved = model.hasSave(g.id)
        let deck = model.deck(for: g.id)
        let p = model.profile(g.id)
        return Panel(edge: Theme.brassDim) {
            HStack(alignment: .top, spacing: 26) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(g.title).font(Theme.font(34, .bold)).foregroundStyle(Theme.brass).inkShadow(3)
                    Text(g.blurb).font(Theme.font(17)).foregroundStyle(Theme.inkDim).fixedSize(horizontal: false, vertical: true)
                    Text("\(g.tables) \(g.words.table.lowercased())s · runs \(p.runs) · wins \(p.wins)\(p.bestTable > 0 ? " · best \(g.words.table.lowercased()) \(p.bestTable)" : "")")
                        .font(Theme.font(14)).foregroundStyle(Theme.inkFaint)
                    Spacer(minLength: 0)
                    HStack(spacing: 10) {
                        if saved {
                            GameButton("Continue", pulse: true) { model.start(g.id, resume: true) }.frame(width: 170)
                            GameButton("New run", style: .plain) { model.start(g.id, resume: false) }.frame(width: 150)
                        } else {
                            GameButton("New run", pulse: true) { model.start(g.id, resume: false) }.frame(width: 170)
                        }
                        GameButton("How to play", style: .plain) { model.showHelp = true }.frame(width: 150)
                        GameButton("Collection", style: .plain) { model.showCollection = true }.frame(width: 150)
                    }
                }
                .frame(width: 560, alignment: .leading)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Starting deck\(saved ? " (for a new run)" : "")").font(Theme.font(15)).foregroundStyle(Theme.inkDim)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(108), spacing: 8), count: 4), alignment: .leading, spacing: 8) {
                        ForEach(g.decks) { d in
                            Button {
                                model.audio.play("select")
                                model.decks[g.id] = d.key
                            } label: {
                                VStack(spacing: 3) {
                                    PixelImage(image: model.art.back(d.back)).frame(width: 40, height: 56)
                                    Text(d.name.replacingOccurrences(of: " Deck", with: "")).font(Theme.font(13)).lineLimit(1).minimumScaleFactor(0.7)
                                        .foregroundStyle(d.key == deck ? Theme.brass : Theme.ink)
                                }
                                .frame(width: 108, height: 84)
                                .background(PixelRect(radius: 6).fill(d.key == deck ? Theme.bg : .clear))
                                .overlay(PixelRect(radius: 6).stroke(d.key == deck ? Theme.brass : .clear, lineWidth: 2))
                            }
                            .buttonStyle(PressStyle())
                        }
                    }
                    Text(g.decks.first { $0.key == deck }?.text ?? "").font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 26).padding(.vertical, 20)
            .frame(height: 300, alignment: .top)
        }
    }

    private func toggle(_ label: String, _ on: Binding<Bool>) -> some View {
        Button {
            on.wrappedValue.toggle()
            model.audio.play("select")
        } label: {
            HStack(spacing: 6) {
                Rectangle().fill(on.wrappedValue ? Theme.brass : Theme.panelEdge).frame(width: 14, height: 14)
                Text(label).font(Theme.font(16)).foregroundStyle(on.wrappedValue ? Theme.ink : Theme.inkDim)
            }
        }
        .buttonStyle(.plain)
    }
}
