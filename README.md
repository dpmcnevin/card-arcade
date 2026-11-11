# Card Arcade

Card roguelikes in one style, on one engine. **Play at [corrupt.net/card-arcade](https://corrupt.net/card-arcade/)**, or go straight to a game:

- [Shoot the Moon](https://corrupt.net/card-arcade/hearts/), a hearts roguelike
- [Vulnerable](https://corrupt.net/card-arcade/bridge/), a contract bridge roguelike
- [Right Bower](https://corrupt.net/card-arcade/euchre/), a euchre roguelike

Each run: eight tables of three boards. Reach each board's goal within its hands, get paid, and spend it in the club on relics, upgrades, ploys, enhanced cards and bundles. The last board of every table has a boss.

## How it's built

```
kit/      the engine
  src/core   cards, RNG, pixel art (faces, backs, icons, seals), sound
  src/run    the generic run: goals, money, the club, relics, ploys,
             upgrades, enhanced cards, bosses, tags, decks, endless,
             chips x mult scoring, saves (seed + actions), profile, log
  games/     one module per game: hearts, bridge, euchre
arcade/   the web app (SvelteKit): one shell for every game, a small
          adapter per game, and a page per game
```

A game is a `GameModule`: how a hand is dealt, the player's actions, the AI, the base score and its content. Everything else comes from the kit. See [kit/README.md](kit/README.md) for adding one.

## Running it

Node 22.18 or newer.

```bash
npm install
npm run dev      # the arcade, with hot reload
npm test         # the kit's tests: every game plays whole runs and replays exactly
npm run build    # a static site in arcade/build
```

Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).

Shoot the Moon and Vulnerable started as their own games ([shoot-the-moon](https://github.com/dpmcnevin/shoot-the-moon), [vulnerable](https://github.com/dpmcnevin/vulnerable)); this is where they share an engine.
