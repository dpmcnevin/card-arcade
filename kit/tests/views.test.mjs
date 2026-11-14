// Every game's shared view (the web arcade and the iPad app draw from it)
// builds at every step of real runs, and its prompt for the step before play
// is there exactly when the player has a choice to make, offering what the
// rules allow: the bot's move is always one of its choices (or a pick).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/run/run.ts';
import { apply, replay, undo } from '../src/run/save.ts';
import { playRun } from '../tools/bot.ts';
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

test('debug actions are recorded and replay to the same run', async () => {
	const { replay } = await import('../src/run/save.ts');
	const run = R.newRun(hearts, 'DEBUG-1');
	const save = { version: 1, game: 'hearts', seed: 'DEBUG-1', actions: [] };
	const go = (a) => {
		const r = apply(run, a);
		if (!(Array.isArray(r) && r[0] === false)) save.actions.push(a);
		return r;
	};
	go({ t: 'debug', op: 'money', n: 100 });
	go({ t: 'debug', op: 'relic', key: hearts.relics[0].key });
	go({ t: 'debug', op: 'ploy', key: 'windfall' });
	go({ t: 'debug', op: 'hand' });
	go({ t: 'debug', op: 'win' });
	assert.equal(run.phase, R.PHASE.WON);
	assert.equal(run.ext.debugged, true);
	assert.deepEqual(go({ t: 'debug', op: 'relic', key: 'nope' }), [false, 'no such relic']);
	const again = replay(hearts, save);
	assert.equal(again.money, run.money);
	assert.equal(again.phase, run.phase);
	assert.equal(again.relics.length, 1);
	assert.deepEqual(again.ploys, ['windfall']);
});

test('the animated card editions score as they say', async () => {
	const C = await import('../src/run/content.ts');
	const run = R.newRun(hearts, 'EDITIONS-1');
	const card = run.pack[0];
	const score = (edition, p) => {
		run.mods = {};
		R.setMod(run, card, { edition });
		return R.pipeline(run, { title: 't', made: true, lines: [{ label: 'base', chips: 100 }], ctx: {}, levels: [], played: [{ card, mine: true, wonByUs: true, winning: false, ...p }] });
	};
	assert.equal(score('molten', { winning: true }).mult, 1.75);
	assert.equal(score('molten', { winning: false }).mult, 1);
	assert.equal(score('frost', { wonByUs: false }).mult, 3);
	assert.equal(score('frost', { wonByUs: true }).mult, 1);
	assert.equal(score('neon', {}).money, 1);
	const s1 = score('static', {}).chips, s2 = score('static', {}).chips;
	assert.ok(s1 >= 100 && s1 <= 150, 'static adds 0 to 50');
	assert.equal(s1, s2, 'static is the same on a replay');
	assert.equal(score('static', { mine: false }).chips, 100, 'only your own cards');
	const total = Object.values(C.CARD_EDITIONS).reduce((n, e) => n + e.weight, 0);
	assert.ok(Math.abs(total - 1) < 1e-9, 'edition weights add to 1');
});

test('the Wild Deck: every card enhanced, no x mult editions, higher goals', async () => {
	const C = await import('../src/run/content.ts');
	for (const [m, scale] of [[hearts, 3.5], [whist22, 1.25]]) {
		const run = R.newRun(m, 'WILD-1', { deck: 'wild' });
		const plain = R.newRun(m, 'WILD-1', { deck: 'basic' });
		assert.ok(run.pack.every((c) => R.mod(run, c).edition), `${m.id}: every card has an edition`);
		assert.ok(run.pack.every((c) => !C.CARD_EDITIONS[R.mod(run, c).edition].effect.xmult && R.mod(run, c).edition !== 'molten'), `${m.id}: no x mult editions`);
		assert.equal(run.target, Math.round(plain.target * scale), `${m.id}: the goal is x${scale}`);
	}
});

for (const [module, steps] of [[tarot, 260], [hearts, 220], [whist22, 220]]) {
	test(`the AI tape: a ${module.id} save replays the same with or without it, and after an Undo`, () => {
		const { run, save } = playRun(module, 'tape-1', steps);
		assert.ok(save.tape.length > 10, 'the thinking-ahead AI recorded its choices');
		// (Hearts keeps a function in its state: compare what JSON keeps.)
		const state = (r) => JSON.stringify({ hand: r.hand, stats: r.stats, money: r.money, board: r.board });
		const withTape = replay(module, JSON.parse(JSON.stringify(save)));
		const without = replay(module, { ...save, tape: undefined });
		assert.equal(state(withTape), state(run));
		assert.equal(state(without), state(run));
		assert.equal(withTape.ext.tapeAt, withTape.ext.tape.length, 'the replay read the tape to its end');
		// A tape entry that no longer fits is thought through again.
		const bad = { ...save, tape: save.tape.map((c, i) => (i === 3 ? 'zz' : c)) };
		assert.equal(state(replay(module, bad)), state(run));
		const back = undo(save);
		if (back) assert.equal(state(replay(module, back)), state(replay(module, { ...back, tape: undefined })));
	});
}
