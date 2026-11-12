// Pacing the AI one card at a time (as the arcade does) ends in exactly the
// state the module's own loop reaches, so saves replay the same.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/run/run.ts';
import { newRng } from '../src/core/rules/rng.ts';
import { bridge } from '../games/bridge/module.ts';
import { hearts } from '../games/hearts/module.ts';
import { euchre } from '../games/euchre/module.ts';
import { tarot } from '../games/tarot/module.ts';
import { whist22 } from '../games/whist22/module.ts';

for (const module of [bridge, hearts, euchre, tarot, whist22]) {
	test(`${module.id}: stepwise AI matches the instant AI`, () => {
		const a = R.newRun(module, 'STEP'),
			b = R.newRun(module, 'STEP');
		const ra = newRng('botA'),
			rb = newRng('botA');
		for (let i = 0; i < 400 && a.phase !== 'over' && a.phase !== 'victory'; i++) {
			if (a.phase === 'pre' || a.phase === 'play') {
				const act = module.bot(a, ra);
				assert.deepEqual(module.bot(b, rb), act);
				R.act(a, act);
				R.act(b, act, { stepwise: true });
				while (R.stepAI(b));
			} else if (a.phase === 'scored') {
				R.next(a);
				R.next(b);
			} else break;
			assert.equal(b.phase, a.phase);
			assert.equal(b.score, a.score);
		}
		assert.equal(b.money, a.money);
	});
}
