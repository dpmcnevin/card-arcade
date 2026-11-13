# Card Arcade for iPad

A native SwiftUI app, landscape only and full screen, for all five games. The rules
don't live here: the kit and every game run unmodified in JavaScriptCore,
through the bridge in `kit/bridge/entry.ts`, and Swift draws the snapshot it
returns. Each game's pre-play step is drawn from its declarative prompt
(`kit/src/view/types.ts`), so one panel serves passing, bidding, calling trump
and the dog. Saves are the same seed-plus-actions as the web build's.

```bash
cd ipad && xcodegen generate && open CardArcade.xcodeproj
```

The pre-build step bundles the kit (`npm run -w kit build:bridge`) into
`Resources/game-bundle.js` and renders the audio once
(`kit/tools/render-audio.ts`). `tools/icon.ts` draws the app icon from the kit's
pixel cards.

Debug builds take two environment variables: `CA_START=<game>` opens a new run
straight at the table, and `CA_AUTOPLAY=<game>` plays a run by itself with the
bot's moves.
