// Every game's shared view (the web arcade and the iPad app draw from it)
// builds at every step of real runs, and its prompt for the step before play
// is there exactly when the player has a choice to make, offering what the
// rules allow: the bot's move is always one of its choices (or a pick).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/run/run.ts';
import { apply } from '../src/run/save.ts';
import { newRng } from '../src/core/rules/rng.ts';
import { hearts } from '../games/hearts/module.ts';
import { bridge } from '../games/bridge/module.ts';
import { euchre } from '../games/euchre/module.ts';
import { tarot } from '../games/tarot/module.ts';
import { whist22 } from '../games/whist22/module.ts';
import { heartsView } from '../games/hearts/view.ts';
import { bridgeView } from '../games/bridge/view.ts';
import { euchreView } from '../games/euchre/view.ts';
import { tarotView } from '../games/tarot/view.ts';
import { whist22View } from '../games/whist22/view.ts';

const GAMES = [
	[hearts, heartsView],
	[bridge, bridgeView],
	[euchre, euchreView],
	[tarot, tarotView],
	[whist22, whist22View]
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const [m, v] of GAMES) {
	test(`${m.id}: the shared view builds, and the prompt offers what the rules allow`, () => {
		let prompts = 0;
		for (let i = 0; i < 3; i++) {
			const run = R.newRun(m, `VIEW-${m.id}-${i}`);
			const rng = newRng(`view-${m.id}-${i}`);
			for (let step = 0; step < 3000; step++) {
				const p = run.phase;
				if (p === R.PHASE.OVER || p === R.PHASE.VICTORY) break;
				if (p === R.PHASE.PRE || p === R.PHASE.PLAY) {
					const tv = v.view(run);
					assert.ok(Array.isArray(tv.seats) && tv.seats.length === 4, 'four seats');
					v.handInfo?.(run);
					const a = m.bot(run, rng);
					if (p === R.PHASE.PRE) {
						const pr = v.prompt(run);
						assert.ok(pr, `${m.id}: a prompt for the step before play`);
						prompts++;
						if (pr.pick) {
							assert.ok(a.cards && a.cards.length === pr.pick.count, `${m.id}: the pick is ${pr.pick.count} cards`);
							assert.equal(v.checkPick?.(run, a.cards) ?? null, null, `${m.id}: the bot's pick is allowed`);
						} else {
							const offered = pr.choices.filter((c) => c.enabled !== false).map((c) => c.action);
							assert.ok(offered.some((o) => same(o, a)), `${m.id}: the bot's ${JSON.stringify(a)} is among the choices`);
						}
					} else assert.equal(v.prompt?.(run) ?? null, null, `${m.id}: no prompt while playing`);
					apply(run, { t: 'game', a });
				} else if (p === R.PHASE.SCORED) {
					v.scoreLine?.(run);
					v.scoreChips?.(run);
					apply(run, { t: 'next' });
				} else if (p === R.PHASE.WON) apply(run, { t: 'shop' });
				else if (p === R.PHASE.SHOP) apply(run, { t: 'leave' });
				else break;
			}
		}
		if (m !== hearts || prompts) assert.ok(prompts > 0, `${m.id}: prompts were seen`);
	});
}
