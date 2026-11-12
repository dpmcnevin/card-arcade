# cardkit

A kit for card roguelikes in one style, so a new game is mostly its rules.

```
kit/src/core    cards, RNG, pixel art (faces, backs, icons), sound synthesis
kit/src/run     the generic run: tables x boards x hands, goals, money and
                interest, the club (relics, upgrades, ploys), chips x mult
                scoring, saves as seed + actions
kit/games/*     one GameModule per game: hearts, bridge, euchre, tarot, whist22
arcade/         a web shell that plays every module (game picker, sidebar,
                score panel, club, endings), with a small adapter per game
```

## Adding a game

1. **Rules** (`kit/games/<game>/rules.ts`): deal, legal plays, play a card,
   who won the trick. Plain functions over plain data, using
   `core/rules/cards.ts` (52 cards, plus Tarot's 1s, knights, trumps and the
   Excuse; `seatName` for "You" and the others).
2. **AI** (`ai.ts`): the other seats' calls and plays.
3. **Module** (`module.ts`), a `GameModule`:
   - `deal(run)`: deal a hand; return `'pre'` if the player has a step before
     play (pass, bid, call trump), else `'play'`.
   - `act(run, action)`: the game's own actions (`{ t: 'play', card }` and any
     pre-play ones). Run the AI seats afterwards until it's the player's turn
     (`aiUntil` in `run/helpers.ts`), unless `stepwise`.
   - `aiToMove` and `stepAI`: one AI card at a time, so the arcade can pace them.
   - `handOver(run)` and `score(run)`: the base score lines, which upgrades
     the hand levels, a context object your relics read, and `playedCards(...)`
     for seals and card editions.
   - `relics`, `upgrades`, optional `ploys`, `bosses`, `goal` (`goals(base,
     scale)` makes the usual table), the words it uses.
   - Optional: `untouched` (no trick played yet: board skips, Steal the Deal),
     `settled` (nothing left can change the score: Claim the rest, via
     `run/settle.ts`), `redeal` (Steal the Deal).
   - `bot(run, rng)`: a sensible move for the player, for autoplay and tests.
     Draw randomness from `rng` only, so saves replay exactly.
4. **Test**: add it to `tests/runs.test.mjs` and `tests/stepwise.test.mjs`;
   the bot plays whole runs and checks they finish, replay exactly, and pace
   the same. `tools/bot.ts` doubles as a balance check for the goal curve.
5. **Arcade** (`arcade/src/lib/games/<game>.ts`): a `GameUI` with `view(run)`
   (seats, `trickView(...)` for the trick, legal cards, a banner) and the
   pre-play panel. Optional: `pick` (cards to pick before play), `rankOrder`,
   `choices` (a question before a card is played), `handInfo` and
   `scoreLine` (the sidebar and score panel), `cue` (the game's moments).
   Add it to `games/index.ts`; its page and tile come from that.

Euchre took about 460 lines of rules, AI and module (content included) and a
120-line arcade adapter; Whist 22 about 450 and 180. Everything else came from
the kit.
