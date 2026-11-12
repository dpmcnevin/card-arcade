// The shared systems, through a real game: enhanced cards, relic editions,
// bundles, skipping boards, decks, bosses and endless.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/run/run.ts';
import { newRng } from '../src/core/rules/rng.ts';
import * as cards from '../src/core/rules/cards.ts';
import { hearts } from '../games/hearts/module.ts';
import { euchre } from '../games/euchre/module.ts';
import { bridge } from '../games/bridge/module.ts';

/** Play the current hand out with the bot. */
function playHand(run, rng = newRng('x')) {
	while (run.phase === 'pre' || run.phase === 'play') R.act(run, run.module.bot(run, rng));
}

test('packs: each game deals from its own pack, with ids', () => {
	assert.equal(R.newRun(hearts, 'P').pack.length, 52);
	assert.equal(R.newRun(bridge, 'P').pack.length, 52);
	const e = R.newRun(euchre, 'P');
	assert.equal(e.pack.length, 24);
	assert.ok(e.pack.every((c) => c.id > 0 && c.rank >= 9));
});

test('card editions score when you play the card; seals pay and wear off nothing', () => {
	const run = R.newRun(hearts, 'ED');
	for (const c of run.pack) R.setMod(run, c, { edition: 'etched', seal: 'gilded' });
	playHand(run);
	const lines = run.result.lines.map((l) => l.label);
	assert.equal(lines.filter((l) => l.startsWith('Etched ')).length, 13, 'one per card you played');
	assert.ok(run.result.money > 0 || run.result.lines.every((l) => !l.label.startsWith('Gilded')), 'gilded pays on tricks you win');
});

test('relic editions add every hand; Phantom takes no slot', () => {
	const run = R.newRun(euchre, 'RE');
	const def = euchre.relics[0];
	run.relics.push(R.instantiate(def, 'lacquered'), R.instantiate(euchre.relics[1], 'phantom'));
	assert.equal(R.relicSlotsUsed(run), 1);
	playHand(run);
	if (run.result.made) assert.ok(run.result.lines.some((l) => l.label === `Lacquered ${def.name}` && l.mult === 0.5));
});

test('bundles open to three choices; picking one takes it', () => {
	const run = R.newRun(bridge, 'BU', { money: 99 });
	run.phase = 'won';
	R.enterShop(run);
	run.shop.items[0] = { kind: 'bundle', def: { key: 'relic', name: 'Relic Bundle', text: '', cost: 6, icon: 'bundle_relic', weight: 1 }, name: 'Relic Bundle', cost: 6 };
	assert.ok(R.buy(run, 0)[0]);
	assert.equal(run.opening.options.length, 3);
	assert.equal(R.canBuy(run, 1)[0], false, 'open it first');
	assert.ok(R.pick(run, 1)[0]);
	assert.equal(run.relics.length, 1);
	assert.equal(run.opening, null);
});

test('skipping a board takes its tag and goes straight to the next', () => {
	const run = R.newRun(euchre, 'SK');
	const tag = R.skipTag(run);
	assert.ok(tag);
	const money = run.money;
	assert.ok(R.skipBoard(run)[0]);
	assert.equal(run.board, 2);
	assert.equal(run.stats.boardsSkipped, 1);
	if (tag === 'cash') assert.equal(run.money, money + 8);
	// Never the boss board.
	R.skipBoard(run);
	assert.equal(run.board, 3);
	assert.equal(R.skipTag(run), null);
});

test('decks change the start; a game adds its own (Burned)', () => {
	assert.equal(R.newRun(hearts, 'D', { deck: 'burned' }).pack.length, 51);
	assert.equal(R.newRun(bridge, 'D', { deck: 'gilded' }).money, 10);
	const royal = R.newRun(euchre, 'D', { deck: 'royal' });
	assert.equal(royal.pack.filter((c) => R.mod(royal, c).edition === 'etched').length, 4);
	assert.equal(R.newRun(hearts, 'D', { deck: 'schemer' }).ploys.length, 2);
});

test('bosses rule the last board of each table; endless goes on after victory', () => {
	const run = R.newRun(euchre, 'BO');
	assert.ok(run.boss, 'chosen when the table starts');
	R.skipBoard(run);
	R.skipBoard(run);
	assert.ok(R.bossActive(run));
	assert.equal(run.handsLeft, run.boss.hands ?? euchre.handsPerBoard);
	// Endless: past the last table the goals keep growing.
	assert.ok(R.goalFor(euchre, 9, 1) > R.goalFor(euchre, 8, 1));
	run.phase = 'victory';
	assert.ok(R.goEndless(run)[0]);
	assert.equal(run.phase, 'won');
	assert.ok(run.endless);
});

import { buildLog } from '../src/run/gamelog.ts';
import { emptyProfile, noteRun } from '../src/run/profile.ts';
import { playRun } from '../tools/bot.ts';

test('the profile and game log work for any game', () => {
	for (const m of [hearts, bridge, euchre]) {
		const { run, save } = playRun(m, 'LOG' + m.id);
		const p = noteRun(emptyProfile(), run, 'r1');
		noteRun(p, run, 'r1');
		assert.equal(p.runs, 1, 'idempotent');
		assert.equal(p.handsPlayed, run.stats.hands);
		assert.ok(Object.keys(p.counters).length > 0, 'the game counts its own things');
		const log = buildLog(m, save);
		assert.ok(log.includes('save: {'), 'ends with the save');
		assert.ok(log.split('\n').filter((l) => l.startsWith(`-- ${m.words.hand}`)).length === run.stats.hands, 'one entry per hand');
	}
});

import { PACK_OPS, recolorDef } from '../src/run/content.ts';

test('pack items change the pack, only in games that allow it', () => {
	const run = R.newRun(hearts, 'PK', { money: 99 });
	run.phase = 'won';
	R.enterShop(run);
	const two = run.pack.find((c) => c.rank === 2 && c.suit === 1);
	run.shop.items[0] = { kind: 'pack', def: PACK_OPS.copy, name: 'Copy', cost: 4 };
	assert.ok(R.buy(run, 0, two.id)[0]);
	assert.equal(run.pack.length, 53);
	run.shop.items[1] = { kind: 'pack', def: recolorDef(3), name: 'Recolor', cost: 3 };
	assert.ok(R.buy(run, 1, two.id)[0]);
	assert.equal(run.pack.find((c) => c.id === two.id).suit, 3);
	assert.equal(R.canApplyPack(R.newRun(bridge, 'PK'), PACK_OPS.burn, two)[0], false, 'Bridge keeps its 52');
});

test('Hearts ploys: Umbrella, Fall Guy, Second Pass', () => {
	const run = R.newRun(hearts, 'PL');
	run.ploys = ['second_pass'];
	assert.ok(R.usePloy(run, 0)[0]);
	const dir = run.hand.passDir;
	R.act(run, { t: 'pass', cards: run.hand.dealt[3].slice(0, 3).map((c) => `${'23456789TJQKA'[c.rank - 2]}${'CDHS'[c.suit - 1]}`.replace('T', '10')) });
	assert.equal(run.phase, 'pre', 'a second pass');
	assert.notEqual(run.hand.passDir, dir);
	run.ploys = ['umbrella'];
	assert.ok(R.usePloy(run, 0)[0]);
	assert.ok(run.hand.umbrella);
});

test('relic flags: interest cap, bargain rerolls, extra slot; the Jinx', () => {
	const run = R.newRun(hearts, 'FL', { money: 60 });
	const def = (k) => hearts.relics.find((d) => d.key === k);
	run.relics.push(R.instantiate(def('interest_rate')), R.instantiate(def('collectors_album')), R.instantiate(def('bargain_bin')));
	assert.equal(R.interest(run), 8);
	assert.equal(R.relicSlots(run), 6);
	assert.equal(R.relicSlotsUsed(run), 2);
	run.phase = 'won';
	R.enterShop(run);
	assert.equal(run.rerollCost, 0, 'first reroll free');
	R.reroll(run);
	assert.equal(run.rerollCost, 4);
	const j = R.newRun(hearts, 'JX');
	j.relics.push(R.instantiate(def('interest_rate')));
	j.boss = hearts.bosses.find((b) => b.key === 'jinx');
	R.skipBoard(j);
	R.skipBoard(j);
	assert.equal(j.jinxed, 'interest_rate');
	assert.equal(R.activeRelics(j).length, 0);
});

import { apply, undo, replay } from '../src/run/save.ts';

test('Undo takes back your last card, the other seats’ cards with it', () => {
	const rng = newRng('u');
	const run = R.newRun(euchre, 'UNDO');
	const save = { version: 1, game: 'euchre', seed: 'UNDO', actions: [] };
	const go = (a) => (save.actions.push(a), apply(run, a));
	while (run.phase === 'pre') go({ t: 'game', a: euchre.bot(run, rng) });
	run.ploys = ['undo'];
	save.actions.unshift(); // the ploy came from somewhere; give it to the replay too
	const before = run.hand.hands[3].length;
	go({ t: 'game', a: euchre.bot(run, rng) });
	assert.equal(run.hand.hands[3].length, before - 1);
	assert.ok(R.canUsePloy(run, 0)[0]);
	const back = undo(save);
	assert.ok(back);
	const again = replay(euchre, back);
	assert.equal(again.hand.hands[3].length, before, 'the card is back in your hand');
	assert.equal(again.stats.ploysUsed, 1);
});

test('the club never offers the same thing twice', () => {
	for (const m of [hearts, bridge, euchre]) {
		for (let i = 0; i < 60; i++) {
			const run = R.newRun(m, 'DUP' + i, { money: 99 });
			run.phase = 'won';
			R.enterShop(run);
			R.reroll(run);
			const keys = run.shop.items.map((it) => `${it.kind}:${it.def.key}${it.def.suit ?? ''}`);
			assert.equal(new Set(keys).size, keys.length, keys.join(', '));
		}
	}
});

test('whist22: the Loophole ploy lets the dealer make the bids add up', async () => {
	const { whist22 } = await import('../games/whist22/module.ts');
	const W = await import('../games/whist22/rules.ts');
	const { apply } = await import('../src/run/save.ts');
	// Find a run where you deal and bid last with a bid barred to you.
	for (let i = 0; i < 50; i++) {
		const run = R.newRun(whist22, `LOOP${i}`);
		const rng = newRng(`loop${i}`);
		// Play rounds with the bot until it's your deal and your bid.
		for (let k = 0; k < 40 && !(run.phase === R.PHASE.PRE && run.hand.dealer === W.PLAYER); k++) {
			if (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY) apply(run, { t: 'game', a: whist22.bot(run, rng) });
			else if (run.phase === R.PHASE.SCORED) apply(run, { t: 'next' });
			else if (run.phase === R.PHASE.WON) apply(run, { t: 'shop' });
			else if (run.phase === R.PHASE.SHOP) apply(run, { t: 'leave' });
			else break;
		}
		const h = run.hand;
		if (run.phase !== R.PHASE.PRE || h.dealer !== W.PLAYER) continue;
		const barred = W.forbidden(h, W.PLAYER);
		if (barred === null) continue;
		assert.throws(() => R.act(run, { t: 'bid', bid: barred }));
		run.ploys = ['loophole'];
		assert.deepEqual(R.canUsePloy(run, 0), [true]);
		R.usePloy(run, 0);
		assert.equal(W.forbidden(h, W.PLAYER), null);
		R.act(run, { t: 'bid', bid: barred });
		assert.equal(W.bidTotal(h), h.size, 'the bids add up');
		return;
	}
	assert.fail('no deal found where you deal with a barred bid');
});

test('Steal the Deal: every game deals the hand again, with you as the dealer where there is one', async () => {
	const { tarot } = await import('../games/tarot/module.ts');
	const { whist22 } = await import('../games/whist22/module.ts');
	for (const m of [hearts, bridge, euchre, tarot, whist22]) {
		assert.ok(R.allPloys(m).some((p) => p.key === 'steal_deal'), `${m.id} offers it`);
		const run = R.newRun(m, `STEAL-${m.id}`);
		const before = { hands: run.stats.hands, left: run.handsLeft, size: run.hand.size, pass: run.hand.passDir, redeals: run.ext.redeals ?? 0 };
		run.ploys = ['steal_deal'];
		assert.deepEqual(R.canUsePloy(run, 0), [true], `${m.id} can use it at the start`);
		R.usePloy(run, 0);
		assert.equal(run.stats.hands, before.hands, `${m.id}: not a new hand`);
		assert.equal(run.handsLeft, before.left, `${m.id}: no hand used up`);
		assert.equal(run.ext.redeals, before.redeals + 1);
		assert.ok(run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY);
		if (m === euchre || m === whist22) assert.equal(run.hand.dealer, cards.SOUTH, `${m.id}: you deal`);
		if (m === whist22) assert.equal(run.hand.size, before.size, 'the same round size');
		if (m === hearts) assert.equal(run.hand.passDir, before.pass, 'the same pass');
	}
});
