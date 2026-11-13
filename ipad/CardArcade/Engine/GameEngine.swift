import Foundation
import JavaScriptCore

/// Hosts the bundled `game-bundle.js` (the kit and every game, unmodified,
/// plus the thin bridge in kit/bridge/entry.ts) in a JSContext and exposes it
/// as a Swift API. The run lives in JavaScript; Swift sends actions and draws
/// the snapshot it gets back.
@MainActor
final class GameEngine {
    private let context: JSContext
    private let api: JSValue
    private let decoder = JSONDecoder()

    enum EngineError: Error {
        case bundleNotFound
        case javascript(String)
    }

    init() throws {
        guard let context = JSContext() else { throw EngineError.javascript("no JSContext") }
        self.context = context
        context.exceptionHandler = { _, exception in
            print("[engine] JS exception: \(exception?.toString() ?? "?")")
        }
        let log: @convention(block) (String) -> Void = { print("[js] \($0)") }
        let console = JSValue(newObjectIn: context)
        for k in ["log", "warn", "error", "info", "debug"] { console?.setObject(log, forKeyedSubscript: k as NSString) }
        context.setObject(console, forKeyedSubscript: "console" as NSString)

        guard let url = Bundle.main.url(forResource: "game-bundle", withExtension: "js") else {
            throw EngineError.bundleNotFound
        }
        context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
        if let e = context.exception { throw EngineError.javascript(e.toString() ?? "load failed") }
        guard let api = context.objectForKeyedSubscript("CardArcade"), !api.isUndefined else {
            throw EngineError.javascript("CardArcade global missing")
        }
        self.api = api
    }

    /// Call a bridge function that returns a string (JSON, mostly).
    private func call(_ name: String, _ args: [Any] = []) throws -> String {
        context.exception = nil
        let result = api.invokeMethod(name, withArguments: args)
        if let e = context.exception {
            context.exception = nil
            throw EngineError.javascript(e.toString() ?? "\(name) failed")
        }
        return result?.toString() ?? ""
    }

    private func decode<T: Decodable>(_ json: String) throws -> T {
        try decoder.decode(T.self, from: Data(json.utf8))
    }

    func games() throws -> [GameInfo] { try decode(try call("games")) }

    func newRun(game: String, deck: String) throws -> RunView { try decode(try call("newRun", [game, deck])) }

    func restore(_ save: String) throws -> RunView { try decode(try call("restore", [save])) }

    /// Does this save replay to a run still going?
    func resumable(_ save: String) -> Bool { (try? call("resumable", [save])) == "true" }

    func save() throws -> String { try call("save") }

    func view() throws -> RunView { try decode(try call("view")) }

    /// A compact text log of this run, to send for analysis.
    func gameLog() throws -> String { try call("gameLog") }

    /// A game's profile (stats and history), brought up to date with this run.
    func noteProfile(_ json: String, id: String) throws -> String { try call("noteProfile", [json, id]) }

    /// Everything in a game, for its collection page.
    func catalog(_ game: String) throws -> CatalogV { try decode(try call("catalog", [game])) }

    /// An action (save.ts's Action) as JSON.
    func act(_ json: String) throws -> ActResult { try decode(try call("act", [json])) }

    /// One AI seat plays.
    func stepAI() throws -> StepResult { try decode(try call("stepAI")) }

    /// Why these picked cards can't go (Tarot's dog), or nil if they can.
    func checkPick(_ codes: [String]) -> String? {
        let json = String(decoding: try! JSONSerialization.data(withJSONObject: codes), as: UTF8.self)
        let why = (try? call("checkPick", [json])) ?? ""
        return why.isEmpty ? nil : why
    }

    /// The bot's move now, as a game action (debug autoplay).
    func bot(_ seed: String) throws -> String { try call("bot", [seed]) }

    /// Can the pack item in a shop slot go on this card? A reason if not.
    func canApply(slot: Int, cardId: Int) -> String? {
        guard let json = try? call("canApply", [slot, cardId]),
              let arr = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [Any],
              let ok = arr.first as? Bool else { return nil }
        return ok ? nil : (arr.count > 1 ? arr[1] as? String : "not allowed")
    }

    func pixels(_ function: String, _ args: [Any]) -> PixelData? {
        guard let json = try? call(function, args) else { return nil }
        return try? decode(json)
    }
}

/// The run-level actions (save.ts), as JSON for the bridge. A game's own
/// moves come from the snapshot as JSON already (the prompt's choices) or
/// are built here (playing a card).
enum Act {
    static func json(_ dict: [String: Any]) -> String {
        String(decoding: try! JSONSerialization.data(withJSONObject: dict, options: [.sortedKeys]), as: UTF8.self)
    }
    /// Wrap a game move (JSON text) as a run action.
    static func game(_ move: String) -> String { "{\"t\":\"game\",\"a\":\(move)}" }
    static func play(_ code: String) -> String { game(json(["t": "play", "card": code])) }
    static let playOut = game("{\"t\":\"playOut\"}")
    static let next = json(["t": "next"])
    static let shop = json(["t": "shop"])
    static let leave = json(["t": "leave"])
    static let reroll = json(["t": "reroll"])
    static let skip = json(["t": "skip"])
    static let endless = json(["t": "endless"])
    static func buy(_ slot: Int, card: Int? = nil) -> String {
        var d: [String: Any] = ["t": "buy", "slot": slot]
        if let card { d["card"] = card }
        return json(d)
    }
    static func sell(_ slot: Int) -> String { json(["t": "sell", "slot": slot]) }
    static func ploy(_ slot: Int) -> String { json(["t": "ploy", "slot": slot]) }
    static func pick(_ index: Int) -> String { json(["t": "pick", "index": index]) }
}

struct PixelData: Decodable {
    let w: Int
    let h: Int
    let rgba: String
}
