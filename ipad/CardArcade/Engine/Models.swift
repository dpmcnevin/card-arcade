import Foundation

// The bridge's JSON, decoded (kit/bridge/entry.ts). Field names match it.

enum Phase: String, Decodable {
    case pre, play, scored, won, shop, over, victory
}

struct Words: Decodable, Hashable {
    let table: String
    let hand: String
    let hands: String
    let chips: String
    let pre: String?
}

struct DeckInfo: Decodable, Identifiable, Hashable {
    let key: String
    let name: String
    let text: String
    let back: String
    var id: String { key }
}

struct HelpSection: Decodable, Hashable {
    let title: String
    let text: String
}

/// A game, for the menu.
struct GameInfo: Decodable, Identifiable {
    let id: String
    let title: String
    let tagline: String
    let blurb: String
    let back: String
    let words: Words
    let tables: Int
    let decks: [DeckInfo]
    let help: [HelpSection]
}

struct SealV: Decodable, Hashable {
    let key: String
    let name: String
    let text: String
    let glyph: String
    let color: String
}

struct CardV: Decodable, Hashable, Identifiable {
    let id: Int
    let suit: Int
    let rank: Int
    let code: String
    /// "suit-rank": what legal plays, picks and rings are keyed by.
    let key: String
    let name: String
    let edition: String?
    let seal: SealV?
    let trump: Bool
    let suitOrder: Int
    let rankOrder: Double

    var isRed: Bool { suit == 2 || suit == 3 }
}

struct EditionV: Decodable, Hashable {
    let key: String
    let name: String
    let text: String
}

struct BossV: Decodable, Hashable {
    let key: String
    let name: String
    let text: String
    let icon: String?
    let active: Bool
}

struct TagV: Decodable, Hashable {
    let key: String
    let name: String
    let text: String
    let icon: String
}

struct BoardInfo: Decodable, Hashable, Identifiable {
    struct Boss: Decodable, Hashable { let name: String; let text: String }
    let board: Int
    let name: String
    let goal: Double
    let hands: Int
    let reward: Int
    let boss: Boss?
    let tag: TagV?
    var id: Int { board }
}

struct RelicV: Decodable, Hashable, Identifiable {
    let slot: Int
    let key: String
    let name: String
    let rarity: Int
    let rarityName: String
    let icon: String
    let text: String
    let sell: Int
    let edition: EditionV?
    var id: Int { slot }
}

struct PloyV: Decodable, Hashable, Identifiable {
    let slot: Int
    let key: String
    let name: String
    let text: String
    let icon: String
    let canUse: Bool
    let why: String?
    var id: Int { slot }
}

struct LevelV: Decodable, Hashable, Identifiable {
    let key: String
    let name: String
    let icon: String
    let glyph: String?
    let text: String
    let level: Int
    let chips: Double
    let mult: Double
    var id: String { key }
}

struct ShopItemV: Decodable, Hashable, Identifiable {
    let slot: Int
    let kind: String
    let name: String
    let cost: Int
    let sold: Bool
    let canBuy: Bool
    let why: String?
    let needsCard: Bool
    let text: String
    let icon: String?
    let rarity: Int?
    let rarityName: String?
    let edition: EditionV?
    let glyph: String?
    let level: Int?
    let chips: Double?
    let mult: Double?
    let seal: SealV?
    let cardEdition: String?
    var id: Int { slot }
}

struct BundleOptionV: Decodable, Hashable {
    let kind: String
    let name: String
    let text: String
    let icon: String?
    let rarity: Int?
    let rarityName: String?
    let edition: EditionV?
    let card: CardV?
    let cardEdition: String?
}

struct OpeningV: Decodable, Hashable {
    let bundle: String
    let name: String
    let options: [BundleOptionV]
}

struct PayoutV: Decodable, Hashable {
    let board: Int
    let unused: Int
    let interest: Int
    let relics: Int
    let boss: Int
    let total: Int
}

struct StatsV: Decodable, Hashable {
    let hands: Int
    let made: Int
    let best: Double
    let total: Double
    let ploysUsed: Int
    let boardsSkipped: Int
}

struct LineV: Decodable, Hashable {
    let label: String
    let chips: Double?
    let mult: Double?
    let xmult: Double?
    let money: Double?
    let edition: String?
}

struct ResultV: Decodable, Hashable {
    let title: String
    let made: Bool
    let lines: [LineV]
    let chips: Double
    let mult: Double
    let total: Double
    let money: Double
}

struct SeatV: Decodable, Hashable {
    /// "N", "E", "S" or "W".
    let pos: String
    let name: String
    let cards: [CardV]
    let faceUp: Bool
    let tally: String?
    let active: Bool
    let dealer: Bool
    let playable: Bool
}

struct NoteV: Decodable, Hashable {
    let text: String
    let high: Bool?
}

struct TrickPlayV: Decodable, Hashable {
    let pos: String
    let card: CardV
    let note: NoteV?
}

struct LastTrickV: Decodable, Hashable {
    let plays: [TrickPlayV]
    let winner: String
}

struct TableV: Decodable, Hashable {
    let seats: [SeatV]
    let trick: [TrickPlayV]
    /// Card keys the player may play now.
    let legal: [String]
    let trump: Int?
    let banner: String?
    let ringed: [String]
    let hidden: [String]
    let trickDone: Bool
    let lastTrick: LastTrickV?
    let played: [String]

    func seat(_ pos: String) -> SeatV? { seats.first { $0.pos == pos } }
    /// The finished trick showing, as a key (to know when it's been swept).
    var trickKey: String? {
        guard let t = lastTrick else { return nil }
        return t.plays.map(\.card.key).joined(separator: ",")
    }
}

struct HandInfoV: Decodable, Hashable {
    struct Row: Decodable, Hashable { let label: String; let value: String; let hot: Bool? }
    let title: String
    let rows: [Row]
}

struct PromptV: Decodable, Hashable {
    struct Choice: Decodable, Hashable {
        let label: String
        let sub: String?
        /// The game move as JSON text, sent back as it is.
        let action: String
        let enabled: Bool
        let primary: Bool
        let star: Bool
        let note: String?
    }
    struct Pick: Decodable, Hashable {
        let count: Int
        let label: String
        /// The move, with "$picked" where the picked codes go.
        let action: String
    }
    let title: String
    let lines: [String]
    let cards: [CardV]
    let grid: Int
    let choices: [Choice]
    let pick: Pick?
    let hint: String?
}

struct CardChoiceV: Decodable, Hashable {
    let label: String
    let action: String
}

struct ScoreChipV: Decodable, Hashable {
    let text: String
    let tone: String?
    let me: Bool?
}

/// The run as the bridge sees it: everything the screens draw.
struct RunView: Decodable {
    let game: String
    let title: String
    let words: Words
    let seed: String
    let deck: String
    let deckName: String
    let back: String
    let phase: Phase
    let table: Int
    let tables: Int
    let board: Int
    let boardsPerTable: Int
    let boardName: String
    let target: Double
    let score: Double
    let money: Int
    let handsLeft: Int
    let handsThisBoard: Int
    let endless: Bool
    let aiToMove: Bool
    let boss: BossV?
    let jinxed: String?
    let tableBoards: [BoardInfo]
    let skipTag: TagV?
    let relics: [RelicV]
    let relicSlots: Int
    let relicSlotsUsed: Int
    let ploys: [PloyV]
    let ploySlots: Int
    let levels: [LevelV]
    let spotlight: Bool
    let interest: Int
    let rerollCost: Int
    let shop: [ShopItemV]?
    let opening: OpeningV?
    let payout: PayoutV?
    let stats: StatsV
    let pack: [CardV]
    let tableView: TableV?
    let handInfo: HandInfoV?
    let prompt: PromptV?
    let pickCount: Int
    let cardChoices: [String: [CardChoiceV]]
    let canPlayOut: Bool
    let canClaim: Bool
    let result: ResultV?
    let scoreLine: String?
    let scoreChips: [ScoreChipV]?

    var isLive: Bool { phase != .over && phase != .victory }
    var inHand: Bool { phase == .pre || phase == .play }
}

struct CueV: Decodable {
    let toast: String?
    let tone: String?
    let sound: String?
    let shake: Double?
}

struct ActResult: Decodable {
    let ok: Bool
    let error: String?
    let phaseChanged: Bool?
    let undone: Bool?
    let cue: CueV?
    let view: RunView
}

struct StepResult: Decodable {
    /// "trick", "card", or nil.
    let step: String?
    let phaseChanged: Bool
    let cue: CueV?
    let view: RunView
}

struct CatalogV: Decodable {
    struct Relic: Decodable, Identifiable { let key, name, text: String; let rarity: Int; let rarityName: String; let cost: Int; let icon: String; var id: String { key } }
    struct Ploy: Decodable, Identifiable { let key, name, text: String; let cost: Int; let icon: String; var id: String { key } }
    struct Boss: Decodable, Identifiable { let key, name, text: String; let icon: String?; let tier: Int; var id: String { key } }
    struct Edition: Decodable, Identifiable { let key, name, text: String; let cost: Int; var id: String { key } }
    struct Upgrade: Decodable, Identifiable { let key, name, text, icon: String; let glyph: String?; let chips, mult: Double; var id: String { key } }
    let relics: [Relic]
    let ploys: [Ploy]
    let bosses: [Boss]
    let decks: [DeckInfo]
    let seals: [SealV]
    let cardEditions: [Edition]
    let relicEditions: [Edition]
    let upgrades: [Upgrade]
    let counterNames: [String: String]
}

/// A game's record across runs (kit profile.ts).
struct ProfileV: Decodable {
    struct Record: Decodable, Identifiable {
        let id: String
        let seed: String
        let deck: String
        let started: Double
        let ended: Double?
        let result: String
        let table: Int
        let board: Int
        let bestHand: Double
        let hands: Int
    }
    let runs: Int
    let wins: Int
    let bestTable: Int
    let bestHand: Double
    let handsPlayed: Int
    let relicsFound: [String]
    let bossesBeaten: [String]
    let counters: [String: Double]
    let history: [Record]

    static let empty = ProfileV(runs: 0, wins: 0, bestTable: 0, bestHand: 0, handsPlayed: 0, relicsFound: [], bossesBeaten: [], counters: [:], history: [])

    static func load(_ json: String?) -> ProfileV {
        guard let json, let p = try? JSONDecoder().decode(ProfileV.self, from: Data(json.utf8)) else { return .empty }
        return p
    }
}
