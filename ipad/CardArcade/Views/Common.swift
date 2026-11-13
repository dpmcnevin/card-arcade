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
        .phaseAnimator([1.5, -1.5]) { content, y in
            content.offset(y: pulse && enabled ? y : 0)
        } animation: { _ in .easeInOut(duration: 0.78) }
    }

    private var fill: Color {
        switch style {
        case .brass: Theme.brass
        case .plain: Theme.panelEdge
        case .ploy: Theme.ploy
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
        default: Theme.inkDim
        }
    }
}

/// The look of a relic edition over its icon: a moving sheen of engraved
/// silver, a red gloss, a turning rainbow, or a pale see-through ghost.
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
        default:
            TimelineView(.animation) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate
                content.overlay {
                    sheen(t).mask(content).allowsHitTesting(false)
                }
            }
        }
    }

    @ViewBuilder
    private func sheen(_ t: Double) -> some View {
        // A band sweeping corner to corner every couple of seconds.
        let p = (t * 0.55).truncatingRemainder(dividingBy: 1) * 2.4 - 0.7
        let band = LinearGradient(
            stops: [.init(color: .clear, location: 0), .init(color: .white.opacity(0.9), location: 0.5), .init(color: .clear, location: 1)],
            startPoint: UnitPoint(x: p - 0.35, y: p - 0.35), endPoint: UnitPoint(x: p + 0.35, y: p + 0.35))
        switch edition {
        case "etched":
            ZStack {
                Color(hex: 0xc9d6de).opacity(0.35).blendMode(.color)
                band.blendMode(.screen)
            }
        case "lacquered":
            ZStack {
                Color(hex: 0xe8573f).opacity(0.3).blendMode(.overlay)
                band.blendMode(.screen)
            }
        default: // prismatic
            ZStack {
                AngularGradient(colors: [.red, .orange, .yellow, .green, .cyan, .blue, .purple, .red],
                                center: .center, angle: .degrees(t * 120))
                    .opacity(0.65).blendMode(.overlay)
                band.opacity(0.7).blendMode(.screen)
            }
        }
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

