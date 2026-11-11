# cardkit

A kit for card roguelikes in one style, so a new game is mostly its rules.

```
kit/src/core    cards, RNG, pixel art (faces, backs, icons), sound synthesis
kit/src/run     the generic run: tables x boards x hands, goals, money and
                interest, the club (relics, upgrades, ploys), chips x mult
                scoring, saves as seed + actions
kit/games/*     one GameModule per game: bridge, hearts, euchre
arcade/         a web shell that plays every module (game picker, sidebar,
                score panel, club, endings), with a small adapter per game
```

## Adding a game

1. **Rules** (`kit/games/<game>/rules.ts`): deal, legal plays, play a card,
   who won the trick. Plain functions over plain data, using `core/rules/cards.ts`.
2. **AI** (`ai.ts`): the other seats' calls and plays.
3. **Module** (`module.ts`), a `GameModule`:
   - `deal(run)`: deal a hand; return `'pre'` if the player has a step before
     play (pass, bid, call trump), else `'play'`.
   - `act(run, action)`: the game's own actions (`{ t: 'play', card }` and any
     pre-play ones). Run the AI seats afterwards until it's the player's turn.
   - `handOver(run)` and `score(run)`: the base score lines, which upgrades
     the hand levels, and a context object your relics read.
   - `relics`, `upgrades`, optional `ploys` (the kit adds Encore, Spotlight
     and Windfall to every game), `goal(table, board)`, the words it uses.
   - `bot(run, rng)`: a sensible move for the player, for autoplay and tests.
     Draw randomness from `rng` only, so saves replay exactly.
4. **Test**: add it to `tests/runs.test.mjs`; the bot plays whole runs and
   checks they finish and replay exactly. `tools/bot.ts` doubles as a
   balance check for the goal curve.
5. **Arcade** (`arcade/src/lib/games/<game>.ts`): a `GameUI` with `view(run)`
   (seats, the trick, legal cards, trumps, a banner) and the pre-play panel
   component. Add it to `games/index.ts`.

Euchre took about 460 lines of rules, AI and module (content included) and a
120-line arcade adapter; everything else came from the kit.

## Not in the kit yet

- Hooks for relics that change the rules (Shoot the Moon's Half Moon, Wildcard),
  and for bosses, seals and card editions; the Hearts module leaves those out.
- Pacing and animation of AI plays: modules play the AI seats at once, and the
  arcade shows the last finished trick.
- Sound, portrait layout, and the iPad app.
