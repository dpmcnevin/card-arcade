import SwiftUI

@main
struct CardArcadeApp: App {
    @State private var model: GameModel? = try? GameModel()

    var body: some Scene {
        WindowGroup {
            if let model {
                RootView()
                    .environment(model)
                    .preferredColorScheme(.dark)
                    .persistentSystemOverlays(.hidden)
                    .statusBarHidden()
                    .onAppear(perform: lockWindow)
                    #if DEBUG
                    .task {
                        let env = ProcessInfo.processInfo.environment
                        if let g = env["CA_AUTOPLAY"] { model.autoplay(g) }
                        // CA_START=<game>: a new run, straight to the table (layout checks).
                        if let g = env["CA_START"] { model.start(g, resume: false); model.showOverview = false; model.showDeck = env["CA_DECK"] != nil }
                    }
                    #endif
            } else {
                Text("The game engine failed to load.").foregroundStyle(.white)
            }
        }
    }
}

/// Landscape only and full screen. Info.plist says so, but resizable iPad
/// windows can ignore it, so ask the scene directly as well: landscape, and a
/// window that can only be the size of the screen.
@MainActor
private func lockWindow() {
    for scene in UIApplication.shared.connectedScenes {
        guard let windowScene = scene as? UIWindowScene else { continue }
        windowScene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscape)) { error in
            print("landscape request: \(error.localizedDescription)")
        }
        let b = windowScene.screen.bounds
        let size = CGSize(width: max(b.width, b.height), height: min(b.width, b.height))
        windowScene.sizeRestrictions?.minimumSize = size
        windowScene.sizeRestrictions?.maximumSize = size
    }
}

/// The stage (1280 points wide, as tall as the screen's shape needs), scaled
/// to fit, with the current screen, overlays, particles and screen shake.
struct RootView: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        GeometryReader { geo in
            let _ = fit(geo.size)
            if geo.size.width > 0 && !Self.fits(geo.size, model.layout) {
                Theme.bg
            } else {
                TimelineView(.animation(paused: Date() > model.shakeUntil)) { tl in
                    let L = model.layout
                    let scale = min(geo.size.width / L.W, geo.size.height / L.H)
                    let shaking = tl.date < model.shakeUntil
                    let k = shaking ? model.shakeAmount * model.shakeUntil.timeIntervalSince(tl.date) / 0.5 : 0
                    stage
                        .frame(width: L.W, height: L.H)
                        .coordinateSpace(.named("stage"))
                        .offset(x: shaking ? Double.random(in: -k...k) : 0, y: shaking ? Double.random(in: -k...k) : 0)
                        .scaleEffect(scale)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            }
        }
        .background(Felt().ignoresSafeArea())
        .ignoresSafeArea()
    }

    static func fits(_ size: CGSize, _ L: TableLayout) -> Bool {
        let want = TableLayout.fit(size)
        return want.W == L.W && want.H == L.H
    }

    private func fit(_ size: CGSize) {
        guard size.width > 0 else { return }
        if !Self.fits(size, model.layout) {
            DispatchQueue.main.async { model.layout = .fit(size) }
        }
    }

    @ViewBuilder
    private var stage: some View {
        let L = model.layout
        ZStack(alignment: .topLeading) {
            if model.screen == .menu || model.view == nil {
                MenuView()
                if model.showHelp, let g = model.info(model.selected) { HelpView(game: g).frame(width: L.W, height: L.H) }
                if model.showCollection, let g = model.info(model.selected) { CollectionView(game: g).frame(width: L.W, height: L.H) }
            } else if let v = model.view {
                Felt().frame(width: L.table.width, height: L.table.height).offset(x: L.table.minX)
                if v.phase == .shop {
                    ShopView().offset(x: L.table.minX)
                } else {
                    TableView()
                    Group {
                        switch v.phase {
                        case .scored where !model.holding: ScorePanel().position(x: L.tableCX, y: L.trickCY + 40)
                        case .won: BoardWonPanel().position(x: L.tableCX, y: L.trickCY + 30)
                        case .over: EndingPanel(victory: false).position(x: L.tableCX, y: L.trickCY + 40)
                        case .victory: EndingPanel(victory: true).position(x: L.tableCX, y: L.trickCY + 40)
                        default: EmptyView()
                        }
                    }
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
                    .zIndex(120)
                }
                Sidebar().zIndex(100)
                if let info = model.inspect { InfoCardView(info: info).zIndex(290).transition(.opacity) }
                if model.pickerSlot != nil { CardPickerView().frame(width: L.W, height: L.H).zIndex(300) }
                if model.showDeck { DeckView().frame(width: L.W, height: L.H).zIndex(300) }
                if v.opening != nil { BundleView().frame(width: L.W, height: L.H).zIndex(305) }
                if model.showHelp, let g = model.info(v.game) { HelpView(game: g).frame(width: L.W, height: L.H).zIndex(310) }
                if model.showOverview && v.isLive {
                    TableOverview().frame(width: L.W, height: L.H).zIndex(280)
                        .transition(.opacity)
                }
                HStack(spacing: 6) {
                    GameButton("Help", style: .plain, size: .small) { model.showHelp = true }.frame(width: 70)
                    GameButton("Menu", style: .plain, size: .small) { model.toMenu() }.frame(width: 80)
                }
                .position(x: L.W - 90, y: 24).zIndex(110)
            }
            #if DEBUG
            if ProcessInfo.processInfo.environment["CA_EDITIONS"] != nil { EditionsPreview().frame(width: L.W, height: L.H).zIndex(450) }
            #endif
            ToastView().zIndex(400)
            Particles().frame(width: L.W, height: L.H).zIndex(500)
        }
        .frame(width: L.W, height: L.H, alignment: .topLeading)
        .animation(.spring(duration: 0.32, bounce: 0.35), value: model.view?.phase)
        .animation(.spring(duration: 0.25), value: model.pickerSlot)
        .animation(.easeOut(duration: 0.2), value: model.showOverview)
    }
}
