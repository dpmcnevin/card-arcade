import SwiftUI
import Observation

/// The app's controller: which game, its run, every action, the pacing of
/// the other seats, sound cues and saving. Mirrors the web arcade's
/// controller (arcade/src/lib/app.svelte.ts). All rules live in the kit;
/// this decides what the player sees, when, and what it sounds like.
@Observable
@MainActor
final class GameModel {
    enum Screen { case menu, run }

    struct Toast: Equatable {
        let text: String
        let color: Color
        let id = UUID()
    }

    struct Burst: Identifiable {
        let id = UUID()
        let x: Double, y: Double
        let colors: [Color]
        let count: Int
        let speed: Double
        let life: Double
        let size: Double
        let start: Date
        let seed: UInt64
    }

    static let speedRange = 0.5...3.0
    static let revealStep = 0.3

    let engine: GameEngine
    let art: PixelArt
    let audio = AudioPlayer()
    /// Every game, for the menu.
    let games: [GameInfo]
    /// The build's kit commit, for the menu.
    let engineVersion: String

    private(set) var view: RunView?
    var screen: Screen = .menu
    /// The game picked on the menu.
    var selected: String = UserDefaults.standard.string(forKey: "selected") ?? "hearts" {
        didSet { UserDefaults.standard.set(selected, forKey: "selected") }
    }
    var layout = TableLayout.make(height: 720)

    // Overlays.
    var showHelp = false
    var showCollection = false
    var showDeck = false
    var showLastTrick = false
    /// The table overview (boards, goals, the boss). Play waits behind it.
    var showOverview = false {
        didSet { if !showOverview, let v = view { seen = boardKey(v); pump() } }
    }
    /// A relic, seal, ploy or upgrade being read from the sidebar.
    var inspect: InfoCard?
    /// Shop slot of an edition, seal or pack item waiting for a card.
    var pickerSlot: Int?
    /// A card that asks a question before it's played (Whist 22's Fool).
    var asking: String?
    /// While the board-won panel counts up its payout: the money shown.
    var moneyShown: Int?

    /// Cards picked in your hand for the step before play (codes).
    var picked: [String] = []
    /// Your own order for your hand (card keys), for the rest of the deal.
    var handOrder: [String] = []
    /// Bumped on each new deal, so card views are re-keyed and dealt in.
    private(set) var deal = 0
    /// The other seats are playing: the player waits.
    private(set) var busy = false
    /// The last finished trick already swept to its winner.
    private(set) var swept: String?
    /// A finished trick sliding to whoever took it.
    private(set) var sweeping = false
    /// Holding the last trick of a hand: the score panel waits.
    private(set) var holding = false
    /// The score count-up.
    private(set) var revealShown = 0
    private(set) var revealDone = false
    private(set) var toast: Toast?
    private(set) var bursts: [Burst] = []
    private(set) var shakeUntil = Date.distantPast
    private(set) var shakeAmount = 0.0
    var hovered: String?
    /// The board whose overview was last dismissed.
    private var seen = ""

    // Settings, remembered between launches.
    var music: Bool { didSet { UserDefaults.standard.set(music, forKey: "music"); audio.musicEnabled = music } }
    var sfx: Bool { didSet { UserDefaults.standard.set(sfx, forKey: "sfx"); audio.sfxEnabled = sfx } }
    var fourColor: Bool { didSet { UserDefaults.standard.set(fourColor, forKey: "fourColor") } }
    var speed: Double { didSet { UserDefaults.standard.set(speed, forKey: "speed") } }
    var sortByRank: Bool { didSet { UserDefaults.standard.set(sortByRank, forKey: "sortByRank") } }
    /// The starting deck picked for each game.
    var decks: [String: String] = (UserDefaults.standard.dictionary(forKey: "decks") as? [String: String]) ?? [:] {
        didSet { UserDefaults.standard.set(decks, forKey: "decks") }
    }

    private var pumping: Task<Void, Never>?
    private var hurry: CheckedContinuation<Void, Never>?
    private var lastHand = -1
    private var streak = 0
    private var runId = ""

    private static func saveKey(_ id: String) -> String { "card-arcade.save.\(id)" }
    private static func profileKey(_ id: String) -> String { "card-arcade.profile.\(id)" }
    private static func runIdKey(_ id: String) -> String { "card-arcade.runId.\(id)" }

    init() throws {
        let engine = try GameEngine()
        self.engine = engine
        self.art = PixelArt(engine: engine)
        self.games = try engine.games()
        engineVersion = Bundle.main.url(forResource: "engine-version", withExtension: "txt")
            .flatMap { try? String(contentsOf: $0, encoding: .utf8) }?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "dev"
        let d = UserDefaults.standard
        music = d.object(forKey: "music") as? Bool ?? true
        sfx = d.object(forKey: "sfx") as? Bool ?? true
        fourColor = d.object(forKey: "fourColor") as? Bool ?? false
        speed = (d.object(forKey: "speed") as? Double ?? 1).clamped(to: Self.speedRange)
        sortByRank = d.bool(forKey: "sortByRank")
        audio.musicEnabled = music
        audio.sfxEnabled = sfx
        if !games.contains(where: { $0.id == selected }) { selected = games.first?.id ?? "hearts" }
    }

    var game: GameInfo? { games.first { $0.id == (screen == .run ? view?.game : selected) } ?? games.first { $0.id == selected } }
    func info(_ id: String) -> GameInfo? { games.first { $0.id == id } }
    func deck(for id: String) -> String { decks[id] ?? "standard" }

    /// A run of this game still going, saved.
    func hasSave(_ id: String) -> Bool {
        guard let s = UserDefaults.standard.string(forKey: Self.saveKey(id)) else { return false }
        return engine.resumable(s)
    }

    func profile(_ id: String) -> ProfileV { ProfileV.load(UserDefaults.standard.string(forKey: Self.profileKey(id))) }

    func catalog(_ id: String) -> CatalogV? { try? engine.catalog(id) }

    // MARK: - Runs

    func start(_ id: String, resume: Bool) {
        stopPump()
        var v: RunView?
        if resume, let s = UserDefaults.standard.string(forKey: Self.saveKey(id)) {
            v = try? engine.restore(s)
            runId = UserDefaults.standard.string(forKey: Self.runIdKey(id)) ?? ""
        }
        if v == nil {
            v = try? engine.newRun(game: id, deck: deck(for: id))
            runId = v.map { "\(Int(Date().timeIntervalSince1970 * 1000))-\($0.seed)" } ?? ""
            UserDefaults.standard.set(runId, forKey: Self.runIdKey(id))
        }
        guard let v else { return }
        selected = id
        view = nil
        lastHand = -1
        swept = nil
        holding = false
        sweeping = false
        apply(v)
        // Reopened on the score panel: show it counted up.
        if v.phase == .scored, let r = v.result { revealShown = r.lines.count; revealDone = true }
        screen = .run
        persist()
        audio.play("deal", volume: 0.7)
        if v.inHand && seen != boardKey(v) && freshBoard(v) { showOverview = true } else { pump() }
    }

    func toMenu() {
        stopPump()
        showOverview = false
        screen = .menu
    }

    private func boardKey(_ v: RunView) -> String { "\(v.game).\(v.table).\(v.board)" }
    private func freshBoard(_ v: RunView) -> Bool { v.score == 0 && v.handsLeft == v.handsThisBoard }

    private func persist() {
        guard let v = view else { return }
        let id = v.game
        if let s = try? engine.save() { UserDefaults.standard.set(s, forKey: Self.saveKey(id)) }
        if !runId.isEmpty {
            let old = UserDefaults.standard.string(forKey: Self.profileKey(id)) ?? ""
            if let json = try? engine.noteProfile(old, id: runId) { UserDefaults.standard.set(json, forKey: Self.profileKey(id)) }
        }
    }

    // MARK: - Applying state

    private func apply(_ v: RunView) {
        // A new deal: re-key the cards so they're dealt in, and drop picks and your order.
        if v.inHand && (v.stats.hands != lastHand || view?.inHand != true) {
            deal += 1
            handOrder = []
            picked = []
            swept = nil
            streak = 0
            dealSound(v)
        }
        lastHand = v.stats.hands
        view = v
    }

    private func dealSound(_ v: RunView) {
        let n = v.tableView?.seats.reduce(0) { $0 + $1.cards.count } ?? 0
        let every = max(1, n / 8)
        Task { [weak self] in
            for i in stride(from: 0, to: n, by: every) {
                _ = i
                self?.audio.play("deal", pitch: 1.1, volume: 0.4, jitter: 0.06)
                try? await Task.sleep(for: .seconds(0.7 / Double(max(1, n / every))))
            }
        }
    }

    /// Send a run action. Returns whether it went through.
    @discardableResult
    func act(_ json: String) -> Bool {
        guard let v0 = view else { return false }
        let before = v0.phase
        guard let r = try? engine.act(json) else { return false }
        if !r.ok {
            flash(r.error ?? "Can't do that now", Theme.bad)
            audio.play("trick_lose", volume: 0.4)
            return false
        }
        if r.undone == true {
            deal += 1
            swept = nil
            view = r.view
            persist()
            audio.play("flip")
            flash("Taken back", Theme.good)
            return true
        }
        apply(r.view)
        persist()
        if let c = r.cue { cue(c) }
        if r.view.phase != before { phaseCue(r.view.phase) }
        pump()
        return true
    }

    /// A game move (JSON text).
    func move(_ json: String) {
        guard !busy, view?.phase == .pre || view?.phase == .play else { return }
        if act(Act.game(json)) { audio.play("card_play", jitter: 0.08) }
    }

    // MARK: - The other seats

    private func stopPump() {
        pumping?.cancel()
        pumping = nil
        hurry?.resume()
        hurry = nil
        busy = false
    }

    /// A pause the player can cut short with a tap.
    private func pause(_ seconds: Double) async {
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
            hurry = c
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(seconds))
                guard let self, let h = self.hurry else { return }
                self.hurry = nil
                h.resume()
            }
        }
    }

    /// Hurry the other seats or a held trick along. True if there was anything to hurry.
    @discardableResult
    func skip() -> Bool {
        if let h = hurry {
            hurry = nil
            h.resume()
            return true
        }
        if view?.phase == .scored && !revealDone && !holding {
            completeReveal()
            return true
        }
        return false
    }

    /// Play the AI seats' cards one at a time, holding each finished trick
    /// long enough to see who took it (the last one too, before the score).
    func pump() {
        guard pumping == nil, screen == .run, !showOverview, view != nil else { return }
        pumping = Task { [weak self] in
            guard let self else { return }
            self.busy = true
            defer {
                self.busy = false
                self.pumping = nil
            }
            for _ in 0..<120 {
                guard !Task.isCancelled, let v = self.view, let tv = v.tableView else { break }
                let done = tv.trickDone && self.swept != tv.trickKey
                if v.phase != .play {
                    if done && v.phase == .scored {
                        self.holding = true
                        await self.pause(0.85 / self.speed)
                        await self.sweep()
                        self.holding = false
                        self.startReveal()
                    }
                    break
                }
                if !v.aiToMove {
                    // Your lead next (you took it): still sweep the trick to you.
                    if done {
                        await self.pause(0.75 / self.speed)
                        if !Task.isCancelled { await self.sweep() }
                    }
                    break
                }
                if done {
                    await self.pause(0.75 / self.speed)
                    await self.sweep()
                } else {
                    await self.pause(0.43 / self.speed)
                }
                guard !Task.isCancelled, let r = try? self.engine.stepAI() else { break }
                let before = self.view?.phase
                self.apply(r.view)
                self.audio.play(r.step == "trick" ? "trick_win" : "card_play", volume: r.step == "trick" ? 0.6 : 1, jitter: 0.08)
                if let c = r.cue { self.cue(c) }
                if r.view.phase != before { self.phaseCue(r.view.phase) }
                self.persist()
            }
        }
    }

    private func sweep() async {
        guard let tv = view?.tableView, let t = tv.lastTrick else { return }
        let mine = t.winner == "S" || (t.winner == "N" && tv.seat("N")?.playable == true)
        if mine { streak += 1 } else { streak = 0 }
        withAnimation(.easeIn(duration: 0.3 / speed)) { sweeping = true }
        audio.play("deal", pitch: 0.85, volume: 0.5)
        try? await Task.sleep(for: .seconds(0.32 / speed))
        swept = tv.trickKey
        sweeping = false
    }

    // MARK: - Your hand

    /// Your hand in display order: by suit (each low to high) or by rank,
    /// then any order you've set by dragging.
    func ordered(_ cards: [CardV]) -> [CardV] {
        if !handOrder.isEmpty && cards.allSatisfy({ handOrder.contains($0.key) }) {
            return cards.sorted { (handOrder.firstIndex(of: $0.key) ?? 0) < (handOrder.firstIndex(of: $1.key) ?? 0) }
        }
        return cards.sorted { a, b in
            if sortByRank { return a.rankOrder != b.rankOrder ? a.rankOrder < b.rankOrder : a.suitOrder < b.suitOrder }
            return a.suitOrder != b.suitOrder ? a.suitOrder < b.suitOrder : a.rankOrder < b.rankOrder
        }
    }

    func resort(byRank: Bool) {
        sortByRank = byRank
        handOrder = []
        audio.play("card_play", volume: 0.5, jitter: 0.1)
    }

    func reorder(_ key: String, to index: Int, in cards: [CardV]) {
        var keys = ordered(cards).map(\.key)
        guard let from = keys.firstIndex(of: key) else { return }
        keys.remove(at: from)
        keys.insert(key, at: max(0, min(keys.count, index)))
        handOrder = keys
        audio.play("card_play", volume: 0.5, jitter: 0.1)
    }

    func isLegal(_ c: CardV) -> Bool {
        guard let v = view, v.phase == .play, !busy, let tv = v.tableView else { return false }
        return tv.legal.contains(c.key)
    }

    /// A tap on a card in your hand (or a seat you play).
    func tap(_ c: CardV) {
        if skip() { return }
        guard let v = view else { return }
        if v.phase == .pre, v.pickCount > 0 {
            if let i = picked.firstIndex(of: c.code) { picked.remove(at: i) }
            else if picked.count < v.pickCount { picked.append(c.code) }
            else { audio.play("trick_lose", volume: 0.4); return }
            audio.play("select", pitch: 0.9 + Float(picked.count) * 0.08)
            return
        }
        play(c)
    }

    func play(_ c: CardV) {
        showLastTrick = false
        guard let v = view, isLegal(c) else { return }
        if v.cardChoices[c.code] != nil {
            asking = c.code
            audio.play("select")
            return
        }
        move(Act.json(["t": "play", "card": c.code]))
    }

    /// The answer to a card's question (the Fool: 0 or 22).
    func answer(_ choice: CardChoiceV) {
        asking = nil
        move(choice.action)
    }

    /// The pick is done: send it.
    func commitPick() {
        guard let v = view, let p = v.prompt?.pick, picked.count == p.count else { return }
        if let why = engine.checkPick(picked) {
            flash(why, Theme.bad)
            audio.play("trick_lose", volume: 0.4)
            return
        }
        let codes = String(decoding: try! JSONSerialization.data(withJSONObject: picked), as: UTF8.self)
        let move = p.action.replacingOccurrences(of: "\"$picked\"", with: codes)
        picked = []
        self.move(move)
        audio.play("reroll", volume: 0.7)
    }

    func playOut() {
        guard view?.canPlayOut == true, !busy else { return }
        move("{\"t\":\"playOut\"}")
        audio.play("reroll")
    }

    // MARK: - Cues and phases

    private func cue(_ c: CueV) {
        if let s = c.sound { audio.play(s) }
        if let k = c.shake { shake(k) }
        if let t = c.toast { flash(t, c.tone == "good" ? Theme.good : c.tone == "bad" ? Theme.bad : Theme.ink) }
    }

    private func phaseCue(_ phase: Phase) {
        showLastTrick = false
        asking = nil
        let L = layout
        switch phase {
        case .scored:
            // Wait for the last trick to be swept before counting up.
            if !(view?.tableView?.trickDone ?? false) || swept == view?.tableView?.trickKey { startReveal() } else { revealShown = 0; revealDone = false }
        case .won:
            audio.play("board_won")
            burst(L.tableCX, 260, count: 60, colors: Theme.confetti, speed: 420, life: 1.4, size: 9)
        case .over:
            audio.play("game_over")
        case .victory:
            audio.play("board_won")
            for i in 0..<4 {
                burst(L.tableCX + Double(i - 2) * 200 + 100, 200, count: 50, colors: Theme.confetti, speed: 460, life: 1.8, size: 10)
            }
        case .pre, .play:
            if let v = view, freshBoard(v), seen != boardKey(v) { showOverview = true }
        default:
            break
        }
    }

    private var revealing = false

    private func startReveal() {
        guard !revealing else { return }
        revealShown = 0
        revealDone = false
        revealing = true
        Task { [weak self] in
            defer { self?.revealing = false }
            while let self, !self.revealDone, let r = self.view?.result, self.view?.phase == .scored {
                try? await Task.sleep(for: .seconds(Self.revealStep / self.speed))
                if self.revealDone { return }
                if self.revealShown < r.lines.count {
                    self.revealShown += 1
                    let line = r.lines[self.revealShown - 1]
                    if line.edition != nil {
                        self.audio.play("doubled", pitch: 1.1 + 0.03 * Float(self.revealShown))
                        self.shake(2)
                    } else if line.mult != nil || (line.xmult.map { $0 != 1 } ?? false) {
                        self.audio.play("mult", pitch: 1 + 0.04 * Float(self.revealShown))
                        self.shake(2.5)
                    } else {
                        self.audio.play("tick", pitch: 1 + 0.06 * Float(self.revealShown))
                    }
                } else {
                    self.completeReveal()
                }
            }
        }
    }

    private func completeReveal() {
        guard !revealDone, let r = view?.result else { return }
        revealShown = r.lines.count
        revealDone = true
        if r.total > 0 {
            audio.play("total")
            audio.play("made")
            let strength = min(14, 3 + log10(max(10, r.total)) * 2.4)
            shake(strength)
            burst(layout.tableCX + 150, 420 + layout.dy, count: 18 + Int(strength * 2), colors: Theme.confetti, speed: 320, life: 1, size: 8)
        } else {
            audio.play("down")
        }
    }

    func continueAfterHand() {
        guard view?.phase == .scored, !holding else { return }
        if !revealDone { return completeReveal() }
        act(Act.next)
        audio.play("deal", volume: 0.7)
    }

    // MARK: - The club

    func enterShop() {
        guard view?.phase == .won else { return }
        audio.play("coin")
        act(Act.shop)
    }

    func buy(_ item: ShopItemV) {
        guard item.canBuy else {
            flash("Can't: \(item.why ?? "not now")", Theme.bad)
            return
        }
        if item.needsCard {
            pickerSlot = item.slot
            audio.play("select")
            return
        }
        if act(Act.buy(item.slot)) {
            audio.play("coin")
            shake(3)
            let x = layout.table.minX + 120 + Double(item.slot) * (layout.table.width - 60) / 4
            burst(x, 260, count: 30, colors: Theme.confetti, speed: 300, life: 0.9, size: 7)
        }
    }

    /// Put the waiting edition, seal or pack item on a card.
    func pickCard(_ cardId: Int) {
        guard let slot = pickerSlot else { return }
        if let why = engine.canApply(slot: slot, cardId: cardId) {
            flash("Can't: \(why)", Theme.bad)
            audio.play("trick_lose", volume: 0.5)
            return
        }
        pickerSlot = nil
        if act(Act.buy(slot, card: cardId)) {
            audio.play("coin")
            shake(3)
        }
    }

    func sell(_ slot: Int) {
        if act(Act.sell(slot)) { audio.play("sell") }
    }

    func reroll() {
        guard let v = view, v.money >= v.rerollCost else { return }
        if act(Act.reroll) { audio.play("reroll") }
    }

    func leaveShop() {
        act(Act.leave)
        audio.play("deal", volume: 0.7)
    }

    func pickBundle(_ index: Int) {
        if act(Act.pick(index)) { audio.play(index < 0 ? "select" : "coin") }
    }

    func usePloy(_ slot: Int) {
        guard let p = view?.ploys.first(where: { $0.slot == slot }) else { return }
        guard p.canUse else { flash("Can't: \(p.why ?? "not now")", Theme.bad); return }
        if act(Act.ploy(slot)) {
            audio.play(p.key == "windfall" ? "coin" : "ploy", pitch: 1.1)
            if p.key != "undo" { flash("\(p.name)!", Theme.ploy) }
            picked = []
        }
    }

    func skipBoard() {
        guard let tag = view?.skipTag else { return }
        if act(Act.skip) {
            audio.play("coin")
            flash("Skipped: \(tag.name)", Theme.ploy)
            showOverview = false
        }
    }

    func goEndless() {
        if act(Act.endless) {
            audio.play("coin")
            flash("Endless: the goals keep growing", Theme.ploy)
        }
    }

    /// Share a text log of this run, from the system share sheet.
    func shareLog() {
        guard let v = view, let text = try? engine.gameLog(), !text.isEmpty else { return }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(v.game)-\(v.seed).txt")
        do { try text.write(to: url, atomically: true, encoding: .utf8) } catch { return }
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0 is UIWindowScene }) as? UIWindowScene,
              var top = scene.keyWindow?.rootViewController else { return }
        while let next = top.presentedViewController { top = next }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = top.view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 1, height: 1)
        sheet.popoverPresentationController?.permittedArrowDirections = []
        top.present(sheet, animated: true)
    }

    #if DEBUG
    /// Debug builds: CA_AUTOPLAY=<game> plays a run by itself (the bot's
    /// moves, paced like the AI), to watch every screen go by.
    func autoplay(_ id: String) {
        start(id, resume: false)
        showOverview = false
        Task { [weak self] in
            var n = 0
            while let self, let v = self.view, v.isLive {
                try? await Task.sleep(for: .seconds(0.5 / self.speed))
                if self.busy || self.holding { continue }
                switch v.phase {
                case .pre, .play:
                    if self.showOverview { self.showOverview = false; continue }
                    guard let a = try? self.engine.bot("auto\(n)") else { return }
                    n += 1
                    self.move(a)
                case .scored:
                    if !self.revealDone { continue }
                    self.continueAfterHand()
                case .won: self.enterShop()
                case .shop:
                    // CA_TO_SHOP: stop in the first club (layout checks), with a relic bought.
                    if ProcessInfo.processInfo.environment["CA_TO_SHOP"] != nil {
                        if let r = v.shop?.first(where: { $0.kind == "relic" && $0.canBuy }) { self.buy(r) }
                        return
                    }
                    if v.opening != nil { self.pickBundle(0) } else { self.leaveShop() }
                default: return
                }
            }
        }
    }
    #endif

    // MARK: - Effects

    func flash(_ text: String, _ color: Color) {
        let t = Toast(text: text, color: color)
        withAnimation(.spring(duration: 0.3, bounce: 0.4)) { toast = t }
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(2.4))
            guard let self, self.toast == t else { return }
            withAnimation(.easeOut(duration: 0.2)) { self.toast = nil }
        }
    }

    func shake(_ amount: Double) {
        shakeAmount = max(amount, Date() < shakeUntil ? shakeAmount : 0)
        shakeUntil = Date().addingTimeInterval(0.5)
    }

    func burst(_ x: Double, _ y: Double, count: Int, colors: [Color], speed: Double, life: Double, size: Double) {
        let now = Date()
        bursts.removeAll { now.timeIntervalSince($0.start) > $0.life * 1.3 }
        bursts.append(Burst(x: x, y: y, colors: colors, count: count, speed: speed, life: life, size: size,
                            start: now, seed: UInt64.random(in: 1...UInt64.max)))
    }
}

/// The card beside the sidebar that explains a tapped relic, seal, ploy or upgrade.
struct InfoCard: Equatable {
    let kind: String
    let title: String
    let text: String
    var note: String? = nil
    let color: Color
    let y: Double
    var ploySlot: Int? = nil
    var sellSlot: Int? = nil
}

extension Comparable {
    func clamped(to r: ClosedRange<Self>) -> Self { min(max(self, r.lowerBound), r.upperBound) }
}
