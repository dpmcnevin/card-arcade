import SwiftUI

/// The game's chunky button: a drop shadow, a lighter top lip, a gentle bob
/// when it's the obvious next step, and a click.
struct GameButton: View {
    @Environment(GameModel.self) private var model
    enum Style { case brass, plain, ploy }
    enum Size { case small, medium, large }

    let title: String
    var style: Style = .brass
    var size: Size = .medium
    var enabled = true
    var pulse = false
    var sound: String? = "button"
    let action: () -> Void

    init(_ title: String, style: Style = .brass, size: Size = .medium, enabled: Bool = true, pulse: Bool = false,
         sound: String? = "button", action: @escaping () -> Void) {
        self.title = title
        self.style = style
        self.size = size
        self.enabled = enabled
        self.pulse = pulse
        self.sound = sound
        self.action = action
    }

    var body: some View {
        Button {
            guard enabled else { return }
            if let sound { model.audio.play(sound, jitter: 0.03) }
            action()
        } label: {
            Text(title)
                .font(Theme.font(size == .small ? 15 : size == .large ? 21 : 20, .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(enabled ? (style == .brass ? Theme.bg : Theme.ink) : Theme.inkFaint)
                .frame(maxWidth: .infinity)
                .frame(height: size == .small ? 34 : size == .large ? 48 : 44)
                .background(
                    PixelRect(radius: 8)
                        .fill(enabled ? fill : Theme.panelEdge)
                        .overlay(alignment: .top) {
                            if enabled { PixelRect(radius: 2).fill(.white.opacity(0.18)).frame(height: 3).padding(.horizontal, 3).padding(.top, 2) }
                        }
                        .shadow(color: .black.opacity(0.35), radius: 0, x: 2, y: 5)
                )
        }
        .buttonStyle(PressStyle())
        .modifier(Bob(on: pulse && enabled))
    }

    private var fill: Color {
        switch style {
        case .brass: Theme.brass
        case .plain: Theme.panelEdge
        case .ploy: Theme.ploy
        }
    }
}

/// A little hop now and then, for a button asking to be pressed.
struct Bob: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        if on {
            // A hop on each glint, then still (not a bob every frame).
            content.phaseAnimator([0.0, -4.0, 0.0], trigger: Glint.shared.tick) { content, y in
                content.offset(y: y)
            } animation: { y in y < 0 ? .easeOut(duration: 0.14) : .spring(duration: 0.35, bounce: 0.5) }
        } else {
            content
        }
    }
}

struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.offset(y: configuration.isPressed ? 3 : 0).brightness(configuration.isPressed ? -0.05 : 0)
    }
}

/// A rounded panel over the table.
struct Panel<Content: View>: View {
    var edge: Color = Theme.brassDim
    @ViewBuilder let content: Content

    var body: some View {
        content
            .background(PixelRect(radius: 10).fill(Theme.panel).shadow(color: .black.opacity(0.35), radius: 0, x: 4, y: 6))
            .overlay(PixelRect(radius: 10).stroke(edge, lineWidth: 2))
    }
}

/// A relic or upgrade icon, or a seal, in pixel art.
struct Icon: View {
    @Environment(GameModel.self) private var model
    let key: String
    var scale = 2.0
    var body: some View {
        PixelImage(image: model.art.icon(key)).frame(width: 18 * scale, height: 18 * scale)
    }
}

struct SealBadge: View {
    @Environment(GameModel.self) private var model
    let seal: SealV
    var size = 28.0
    var body: some View {
        PixelImage(image: model.art.seal(seal)).frame(width: size, height: size)
            .shadow(color: .black.opacity(0.35), radius: 0, x: 1, y: 2)
    }
}

/// Green baize with a slow art deco sunburst rising from below the table.
/// Confetti, computed from each burst's start time (no per-frame state).
struct Particles: View {
    @Environment(GameModel.self) private var model

    var body: some View {
        // Nothing in the air: no layer at all, so nothing redraws.
        if model.particlesLive { live }
    }

    private var live: some View {
        TimelineView(.animation) { tl in
            Canvas { g, _ in
                let now = tl.date
                for b in model.bursts {
                    let age = now.timeIntervalSince(b.start)
                    guard age < b.life * 1.3 else { continue }
                    var rng = SplitMix(seed: b.seed)
                    for _ in 0..<b.count {
                        let a = rng.next() * .pi * 2
                        let v = b.speed * (0.35 + rng.next() * 0.65)
                        let life = b.life * (0.6 + rng.next() * 0.6)
                        let size = b.size * (0.6 + rng.next() * 0.8)
                        _ = rng.next() // (was spin; kept so each burst's colors stay the same)
                        let color = b.colors[Int(rng.next() * Double(b.colors.count)) % b.colors.count]
                        guard age < life else { continue }
                        let drag = exp(-1.5 * age)
                        let x = b.x + cos(a) * v * (1 - drag) / 1.5
                        let y = b.y + (sin(a) * v - 120) * (1 - drag) / 1.5 + 0.5 * 520 * age * age
                        // Square, on the pixel grid, fading in three steps.
                        let px = Pixel.size * 2
                        let side = max(px, (size / px).rounded() * px)
                        var ctx = g
                        ctx.opacity = ((1 - age / life) * 3).rounded(.up) / 3
                        ctx.fill(Path(CGRect(x: (x / px).rounded() * px - side / 2, y: (y / px).rounded() * px - side / 2,
                                             width: side, height: side)), with: .color(color))
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

struct SplitMix {
    var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> Double {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        z ^= z >> 31
        return Double(z >> 11) / Double(1 << 53)
    }
}

/// A short message that pops in over the table.
struct ToastView: View {
    @Environment(GameModel.self) private var model
    var body: some View {
        if let t = model.toast {
            Text(t.text)
                .font(Theme.font(20))
                .foregroundStyle(t.color)
                .padding(.horizontal, 20).padding(.vertical, 10)
                .background(PixelRect(radius: 8).fill(Theme.sidebar).shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 4))
                .overlay(PixelRect(radius: 8).stroke(t.color, lineWidth: 2))
                .transition(.scale(scale: 0.6).combined(with: .opacity))
                .id(t.id)
                .position(x: model.layout.tableCX, y: 470 + model.layout.dy)
                .allowsHitTesting(false)
        }
    }
}

/// Play speed: how quickly the opponents play and the table moves on.
struct SpeedSlider: View {
    @Environment(GameModel.self) private var model
    var width = 260.0

    var body: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("Speed").foregroundStyle(Theme.inkDim)
                Spacer()
                Text(label(model.speed)).monospacedDigit().foregroundStyle(Theme.ink)
            }
            .font(Theme.font(14))
            HStack(spacing: 8) {
                PixelSprite(rows: PixelSprite.tortoise)
                PixelSlider(value: $model.speed, range: GameModel.speedRange, step: 0.25)
                PixelSprite(rows: PixelSprite.hare)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Play speed")
            .accessibilityValue(label(model.speed))
        }
        .frame(width: width)
    }

    private func label(_ s: Double) -> String {
        s == s.rounded() ? "\(Int(s))x" : String(format: "%gx", s)
    }
}

// MARK: - Relic editions

enum Edition {
    static func color(_ key: String?) -> Color {
        switch key {
        case "etched": Color(hex: 0xc9d6de)
        case "lacquered": Color(hex: 0xe8573f)
        case "prismatic": Color(hex: 0xd88cff)
        case "phantom": Color(hex: 0x9fb0ff)
        case "static": Color(hex: 0xc4c4cc)
        case "molten": Color(hex: 0xff7a2a)
        case "frost": Color(hex: 0x8fd8ff)
        case "neon": Color(hex: 0xff4fd8)
        default: Theme.inkDim
        }
    }
}

/// The look of an edition over a card or relic icon: a moving sheen of
/// engraved silver, a red gloss, a drifting rainbow foil, TV static, glowing
/// magma, frost and sparkles, a buzzing neon tube, or a pale ghost (Phantom).
/// As on the web.
struct EditionShine: ViewModifier {
    let edition: String?

    func body(content: Content) -> some View {
        switch edition {
        case nil:
            content
        case "phantom":
            content
                .saturation(0.15)
                .opacity(0.55)
                .background(content.colorMultiply(Edition.color("phantom")).opacity(0.8).offset(x: Pixel.size, y: Pixel.size))
        case let e?:
            content.overlay {
                EditionSheen(edition: e).mask(content).allowsHitTesting(false)
            }
        }
    }
}

/// A clock the decorations share: it ticks every few seconds, and each
/// edition, pulsing button and relic burst plays one short flourish on the
/// tick (staggered, so they don't all go at once) and then holds still. So
/// nothing animates between ticks, and the screen isn't redrawn every frame
/// for decoration while you're choosing a card.
@Observable @MainActor
final class Glint {
    static let shared = Glint()
    private(set) var tick = 0
    private init() {
        Task { @MainActor [weak self] in
            while true {
                try? await Task.sleep(for: .seconds(3.2))
                self?.tick += 1
            }
        }
    }
}

/// An edition's layer. It holds still, and on each glint plays one short
/// flourish: a shine sweeps across (etched, lacquered, prismatic, whose foil
/// shifts too), the snow jumps (static), the magma swells (molten), the
/// sparkles twinkle (frost), the tube flickers (neon).
struct EditionSheen: View {
    let edition: String
    /// 0 to 1 through a flourish; 0 at rest.
    @State private var t = 0.0
    /// Flourishes so far (the static snow frame, the foil's shift).
    @State private var n = 0
    /// This card's delay after the tick, so cards glint one after another.
    @State private var stagger = Double.random(in: 0..<2.4)
    /// Only every other tick or so, at random: a hand doesn't glint in lockstep.
    @State private var everyOther = Bool.random()

    var body: some View {
        GeometryReader { geo in
            layers(geo.size)
        }
        .onChange(of: Glint.shared.tick) { _, tick in
            guard tick % 2 == (everyOther ? 1 : 0) else { return }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(stagger))
                n += 1
                t = 0
                withAnimation(.easeInOut(duration: duration)) { t = 1 }
                try? await Task.sleep(for: .seconds(duration))
                var quiet = Transaction()
                quiet.disablesAnimations = true
                withTransaction(quiet) { t = 0 }
            }
        }
    }

    private var duration: Double {
        switch edition {
        case "molten": 1.4
        case "neon", "static": 0.25
        default: 0.9
        }
    }

    /// The sweep: a band from corner to corner as t goes 0 to 1 (off the card at rest).
    private func band(_ size: CGSize) -> some View {
        let p = t == 0 ? -1.2 : -1.2 + 2.4 * t
        return LinearGradient(
            stops: [.init(color: .clear, location: 0), .init(color: .white.opacity(0.9), location: 0.5), .init(color: .clear, location: 1)],
            // Drawn three times the card's size (centered on it), so the
            // gradient's own edges, where the band would be cut off, never show.
            startPoint: UnitPoint(x: 1.15 / 3, y: 1.15 / 3), endPoint: UnitPoint(x: 1.85 / 3, y: 1.85 / 3))
            .frame(width: size.width * 3, height: size.height * 3)
            .offset(x: p * size.width - size.width, y: p * size.height - size.height)
    }

    /// Up and back down through a flourish (0 at either end, 1 midway).
    private var swell: Double { sin(.pi * t) }

    @ViewBuilder
    private func layers(_ size: CGSize) -> some View {
        switch edition {
        case "etched":
            ZStack {
                Color(hex: 0xc9d6de).opacity(0.35).blendMode(.color)
                band(size).blendMode(.screen)
            }
        case "lacquered":
            ZStack {
                Color(hex: 0xe8573f).opacity(0.3).blendMode(.overlay)
                band(size).blendMode(.screen)
            }
        case "static":
            // Faint TV snow and scanlines, still; a glint jumps the snow to a new frame.
            ZStack(alignment: .topLeading) {
                if let img = StaticArt.frames[n % StaticArt.frames.count] {
                    Image(decorative: img, scale: 1).resizable().interpolation(.none)
                        .frame(width: Double(StaticArt.cells) * 3, height: Double(StaticArt.cells) * 3)
                        .opacity(t > 0 ? 0.32 : 0.2).blendMode(.overlay)
                }
                if let lines = StaticArt.scanlines {
                    Image(decorative: lines, scale: 1).resizable().interpolation(.none)
                        .frame(width: size.width, height: Double(StaticArt.cells) * 3 + 6)
                        .offset(y: Double(n % 3) * -2)
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            .clipped()
        case "molten":
            // Magma glowing; a glint swells it like a wave of heat.
            ZStack {
                RadialGradient(colors: [Color(hex: 0xff5a14), .clear], center: UnitPoint(x: 0.3, y: 0.75), startRadius: 0, endRadius: 60)
                RadialGradient(colors: [Color(hex: 0xffaa28), .clear], center: UnitPoint(x: 0.75, y: 0.25), startRadius: 0, endRadius: 50)
                LinearGradient(colors: [Color(hex: 0xff781e).opacity(0.4), Color(hex: 0xc81e0a).opacity(0.6)], startPoint: .top, endPoint: .bottom)
            }
            .scaleEffect(1 + 0.08 * swell)
            .opacity(0.6 + 0.3 * swell)
            .blendMode(.multiply)
        case "frost":
            // A cold tint and still sparkles; a glint makes them twinkle.
            ZStack {
                LinearGradient(colors: [Color(red: 0.59, green: 0.8, blue: 1), Color(red: 0.84, green: 0.93, blue: 1), Color(red: 0.55, green: 0.76, blue: 1)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .opacity(0.75).blendMode(.multiply)
                ForEach(Array([(0.18, 0.22), (0.72, 0.14), (0.56, 0.48), (0.28, 0.7), (0.82, 0.78), (0.44, 0.9)].enumerated()), id: \.offset) { i, p in
                    Circle().fill(.white)
                        .frame(width: i % 2 == 0 ? 4 : 3, height: i % 2 == 0 ? 4 : 3)
                        .shadow(color: Color(red: 0.27, green: 0.63, blue: 1), radius: 2)
                        .scaleEffect(1 + 0.8 * swell * (i % 2 == 0 ? 1 : 0.6))
                        .position(x: size.width * p.0, y: size.height * p.1)
                        .opacity(0.55 + 0.45 * swell)
                }
            }
        case "neon":
            // A glowing tube round the card, steady; a glint makes it buzz and dip.
            ZStack {
                Rectangle().strokeBorder(Color(hex: 0xff4fd8), lineWidth: 2)
                Rectangle().strokeBorder(Color(hex: 0x4fe7ff).opacity(0.55), lineWidth: 2).padding(2)
                Rectangle().strokeBorder(Color(hex: 0xff4fd8).opacity(0.6), lineWidth: 6).blur(radius: 5)
            }
            .opacity(t > 0 && t < 1 ? 0.3 : 1)
        default: // prismatic: a rainbow foil that shifts a little, with a shine, on each glint
            let w = max(size.width, size.height) * 3
            ZStack {
                LinearGradient(colors: Array(repeating: [Color.red, .orange, .yellow, .green, .cyan, .purple], count: 4).flatMap { $0 } + [.red],
                               startPoint: .leading, endPoint: .trailing)
                    .frame(width: w * 2, height: w)
                    .rotationEffect(.degrees(20))
                    // Each glint slides it a sixth of a rainbow (one rainbow is w/2 wide).
                    .offset(x: w / 4 - (Double(n % 6) + t - (t > 0 ? 1 : 0)) * w / 12)
                    .frame(width: size.width, height: size.height)
                    .opacity(0.6).blendMode(.overlay)
                band(size).opacity(0.7).blendMode(.screen)
            }
        }
    }
}

/// Static's snow (a few frames, drawn once) and its scanlines.
@MainActor
enum StaticArt {
    /// Snow cells on a side; each cell is 3 points.
    static let cells = 64
    static let frames: [CGImage?] = (0..<6).map { f in
        Pixel.image(width: cells, height: cells) { ctx in
            var rng = SplitMix(seed: UInt64(f + 1) &* 7919)
            for y in 0..<cells {
                for x in 0..<cells {
                    ctx.setFillColor(gray: rng.next(), alpha: 1)
                    ctx.fill(CGRect(x: x, y: y, width: 1, height: 1))
                }
            }
        }
    }
    /// Dark lines 2 points tall every 6, drawn at one pixel per point.
    static let scanlines: CGImage? = Pixel.image(width: 1, height: cells * 3 + 6) { ctx in
        ctx.setFillColor(gray: 0, alpha: 0.08)
        for y in stride(from: 0, to: cells * 3 + 6, by: 6) { ctx.fill(CGRect(x: 0, y: y, width: 1, height: 2)) }
    }
}

/// A small colored label naming an edition.
struct EditionTag: View {
    let edition: EditionV
    var size = 12.0
    var body: some View {
        Text(edition.name.uppercased())
            .font(Theme.font(size, .bold)).kerning(1)
            .foregroundStyle(Edition.color(edition.key))
    }
}

/// The card beside the sidebar that explains a tapped relic, seal or
/// upgrade. Tap anywhere to close.
struct InfoCardView: View {
    @Environment(GameModel.self) private var model
    let info: InfoCard

    var body: some View {
        let L = model.layout
        ZStack(alignment: .topLeading) {
            Color.black.opacity(0.001).onTapGesture { model.inspect = nil }
            Panel(edge: info.color) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(info.kind.uppercased()).font(Theme.font(11, .bold)).kerning(1).foregroundStyle(info.color)
                    Text(info.title).font(Theme.font(22, .bold)).inkShadow()
                    Text(info.text).font(Theme.font(16)).foregroundStyle(Theme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if let note = info.note {
                        Text(note).font(Theme.font(14)).foregroundStyle(Theme.inkDim)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let slot = info.sellSlot, let r = model.view?.relics.first(where: { $0.slot == slot }), model.view?.phase == .shop {
                        GameButton("Sell for $\(r.sell)", style: .plain, size: .small, sound: nil) {
                            model.inspect = nil
                            model.sell(slot)
                        }
                        .padding(.top, 4)
                    }
                    if let slot = info.ploySlot, let p = model.view?.ploys.first(where: { $0.slot == slot }) {
                        GameButton("Use \(p.name)", size: .small, enabled: p.canUse, sound: nil) {
                            model.inspect = nil
                            model.usePloy(slot)
                        }
                        .padding(.top, 4)
                    }
                }
                .padding(14)
                .frame(width: 300, alignment: .leading)
                .foregroundStyle(Theme.ink)
            }
            .fixedSize()
            .position(x: L.sidebar.width + 166, y: min(max(info.y, 90), L.H - 90))
            .onTapGesture { model.inspect = nil }
        }
        .frame(width: L.W, height: L.H)
    }
}

struct ProgressBar: View {
    let fraction: Double
    let color: Color
    var height = 10.0
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                PixelRect(radius: 4).fill(Theme.bg)
                PixelRect(radius: 4).fill(color).frame(width: g.size.width * min(1, max(0, fraction)))
            }
        }
        .frame(height: height)
    }
}

/// Lays children out in rows, wrapping.
struct FlowRow: Layout {
    var spacing = 8.0
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 240
        var x = 0.0, y = 0.0, row = 0.0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 { x = 0; y += row + 4; row = 0 }
            x += size.width + spacing
            row = max(row, size.height)
        }
        return CGSize(width: width, height: y + row)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row = 0.0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX { x = bounds.minX; y += row + 4; row = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            row = max(row, size.height)
        }
    }
}


extension Array {
    /// The array in pieces of at most `n`, in order.
    func chunked(_ n: Int) -> [[Element]] {
        stride(from: 0, to: count, by: n).map { Array(self[$0..<Swift.min($0 + n, count)]) }
    }
}
