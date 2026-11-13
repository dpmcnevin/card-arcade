import AVFoundation

/// Plays the game's synthesized sounds (pre-rendered by kit/tools/render-audio.ts
/// from the same synth the web arcade uses) and its generative music: several
/// takes, shuffled, each scheduled to start exactly where the last one ends
/// so their ringing tails overlap the next take's opening.
@MainActor
final class AudioPlayer {
    private let engine = AVAudioEngine()
    private var effects: [String: AVAudioPCMBuffer] = [:]
    private var voices: [(player: AVAudioPlayerNode, speed: AVAudioUnitVarispeed)] = []
    private var nextVoice = 0
    private var musicNodes: [AVAudioPlayerNode] = []
    private var takes: [(buffer: AVAudioPCMBuffer, length: AVAudioFramePosition)] = []
    private var musicStart: AVAudioFramePosition = 0
    private var musicOn = false
    private var takeIndex = 0
    private var scheduled = 0

    var sfxEnabled = true
    var musicEnabled = true {
        didSet { musicEnabled ? startMusic() : stopMusic() }
    }

    init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        for _ in 0..<10 {
            let player = AVAudioPlayerNode(), speed = AVAudioUnitVarispeed()
            engine.attach(player)
            engine.attach(speed)
            engine.connect(player, to: speed, format: format)
            engine.connect(speed, to: engine.mainMixerNode, format: format)
            voices.append((player, speed))
        }
        let musicFormat = AVAudioFormat(standardFormatWithSampleRate: 22050, channels: 1)!
        for _ in 0..<2 {
            let node = AVAudioPlayerNode()
            engine.attach(node)
            engine.connect(node, to: engine.mainMixerNode, format: musicFormat)
            node.volume = 0.35
            musicNodes.append(node)
        }
        loadEffects()
        try? engine.start()
        Task { await loadMusic() }
    }

    private func audioURL(_ name: String, _ ext: String) -> URL? {
        Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "Audio")
            ?? Bundle.main.url(forResource: name, withExtension: ext)
    }

    private func read(_ url: URL) -> AVAudioPCMBuffer? {
        guard let file = try? AVAudioFile(forReading: url, commonFormat: .pcmFormatFloat32, interleaved: false),
              let buf = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length))
        else { return nil }
        try? file.read(into: buf)
        return buf
    }

    /// Every effect the kit renders (tools/render-audio.ts), by file name.
    private func loadEffects() {
        let dir = Bundle.main.url(forResource: "Audio", withExtension: nil)
        let files = (dir.flatMap { try? FileManager.default.contentsOfDirectory(at: $0, includingPropertiesForKeys: nil) }) ?? []
        for url in files where url.pathExtension == "wav" {
            if let buf = read(url) { effects[url.deletingPathExtension().lastPathComponent] = buf }
        }
    }

    private struct TakeInfo: Decodable { let file: String; let rate: Double; let length: Int }

    private func loadMusic() async {
        guard let url = audioURL("music", "json"), let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([TakeInfo].self, from: data) else { return }
        for info in list.shuffled() {
            let name = (info.file as NSString).deletingPathExtension
            if let u = audioURL(name, "caf"), let buf = read(u) {
                takes.append((buf, AVAudioFramePosition(info.length)))
                if takes.count == 1 && musicEnabled { startMusic() }
            }
        }
    }

    /// Play an effect. `pitch` 1 is as rendered; `jitter` adds a random spread.
    func play(_ name: String, pitch: Float = 1, volume: Float = 1, jitter: Float = 0) {
        guard sfxEnabled, let buf = effects[name] else { return }
        if !engine.isRunning { try? engine.start() }
        let v = voices[nextVoice]
        nextVoice = (nextVoice + 1) % voices.count
        var p = pitch
        if jitter > 0 { p *= 1 + Float.random(in: -jitter...jitter) }
        v.speed.rate = max(0.25, min(4, p))
        v.player.stop()
        v.player.volume = volume * 0.8
        v.player.scheduleBuffer(buf, at: nil)
        v.player.play()
    }

    private func startMusic() {
        guard musicEnabled, !musicOn, !takes.isEmpty else { return }
        if !engine.isRunning { try? engine.start() }
        musicOn = true
        musicStart = 0
        scheduled = 0
        // Start both nodes on the same host time so their sample timelines line up.
        let start = AVAudioTime(hostTime: mach_absolute_time() + AVAudioTime.hostTime(forSeconds: 0.1))
        for n in musicNodes { n.play(at: start) }
        scheduleNextTake()
        scheduleNextTake()
    }

    /// Queue the next take on alternating nodes, at the sample where the last one ends.
    private func scheduleNextTake() {
        guard musicOn, !takes.isEmpty else { return }
        let take = takes[takeIndex % takes.count]
        takeIndex += 1
        let node = musicNodes[scheduled % 2]
        let at = AVAudioTime(sampleTime: musicStart, atRate: take.buffer.format.sampleRate)
        musicStart += take.length
        scheduled += 1
        node.scheduleBuffer(take.buffer, at: at, options: []) { [weak self] in
            Task { @MainActor in self?.scheduleNextTake() }
        }
    }

    private func stopMusic() {
        musicOn = false
        for n in musicNodes { n.stop() }
    }
}
