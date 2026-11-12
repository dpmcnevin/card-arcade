// Whist 22, as a cardkit roguelike: you're South at a table of four, playing
// the Tarot trumps and the Fool. Each hand is one round (5, 4, 3, 2, 1, 2, 3,
// 4, 5 cards, around and around the run). Bid exactly how many tricks you'll
// take, then take exactly that: a made bid scores, more for bigger bids; a
// clean zero and the blind one-card round have their own bonuses. Miss, and
// the round scores nothing. 8 tables x 3 boards x 3 rounds.

import * as cards from '../../src/core/rules/cards.ts';
import * as W from './rules.ts';
import * as ai from './ai.ts';
import * as R from '../../src/run/run.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { WhistHand } from './rules.ts';
import type { GameModule, Line, RelicDef, Run, UpgradeDef } from '../../src/run/run.ts';
import { settled } from '../../src/run/settle.ts';
import { goals, findCard, playedCards, aiUntil } from '../../src/run/helpers.ts';

export type WhistAction = { t: 'bid'; bid: number } | { t: 'play'; card: string; fool?: number } | { t: 'playOut' };

/** What relics see about a round. */
export interface WhistCtx {
	size: number;
	bid: number;
	tricks: number;
	made: boolean;
	blind: boolean;
	youDealt: boolean;
	/** Tricks you won with the Fool, with the 21, with a card under 10. */
	foolWins: number;
	wins21: number;
	lowWins: number;
	/** You took the last trick. */
	lastTrick: boolean;
	/** Other seats that missed their bids. */
	othersMissed: number;
	handsThisBoard: number;
}

const TABLE_BASE = [70, 110, 160, 220, 300, 400, 520, 680];
const BOARD_SCALE = [1, 1.25, 1.55];

function runBids(run: Run<WhistHand>, stepwise = false) {
	const h = run.hand;
	let guard = 0;
	while (h.stage === 'bid' && h.turn !== W.PLAYER) {
		if (++guard > 10) throw new Error('whist22: bidding stuck');
		W.bid(h, h.turn, ai.chooseBid(h, h.turn));
	}
	if (h.stage === 'play') {
		run.phase = R.PHASE.PLAY;
		if (!stepwise) runPlay(run);
	}
}

function runPlay(run: Run<WhistHand>) {
	const h = run.hand;
	aiUntil(() => h.complete || h.turn === W.PLAYER, () => void aiStep(h), 40, 'whist22: play');
}

function aiStep(h: WhistHand) {
	const m = ai.chooseCard(h, h.turn);
	return W.play(h, h.turn, m.card, m.fool);
}

function ctx(run: Run<WhistHand>): WhistCtx {
	const h = run.hand;
	const mine = h.tricks.filter((t) => t.winner === W.PLAYER).map((t) => t.plays.find((p) => p.seat === W.PLAYER)!);
	return {
		size: h.size,
		bid: h.bids[W.PLAYER]!,
		tricks: h.won[W.PLAYER],
		made: W.madeBid(h, W.PLAYER),
		blind: h.blind,
		youDealt: h.dealer === W.PLAYER,
		foolWins: mine.filter((p) => W.isFool(p.card)).length,
		wins21: mine.filter((p) => p.card.rank === 21).length,
		lowWins: mine.filter((p) => !W.isFool(p.card) && p.card.rank < 10).length,
		lastTrick: h.tricks.at(-1)?.winner === W.PLAYER,
		othersMissed: [1, 2, 4].filter((s) => !W.madeBid(h, s)).length,
		handsThisBoard: run.module.handsPerBoard - run.handsLeft + 1
	};
}

const RELICS: RelicDef<WhistCtx>[] = [
	{ key: 'fools_gold', name: 'Fool’s Gold', rarity: 1, cost: 4, icon: 'wildcard', text: '+60 chips when you win a trick with the Fool', score: (c) => (c.foolWins ? { chips: 60 * c.foolWins } : null) },
	{ key: 'the_world', name: 'The World', rarity: 1, cost: 4, icon: 'ace_of_spades', text: '+40 chips for each trick you win with the 21', score: (c) => (c.wins21 ? { chips: 40 * c.wins21 } : null) },
	{ key: 'low_road', name: 'Low Road', rarity: 1, cost: 5, icon: 'low_ball', text: '+30 chips for each trick you win with a card under 10', score: (c) => (c.lowWins ? { chips: 30 * c.lowWins } : null) },
	{ key: 'crowd_pleaser', name: 'Crowd Pleaser', rarity: 1, cost: 5, icon: 'ensemble', text: '+20 chips for each other player who misses their bid', score: (c) => (c.othersMissed ? { chips: 20 * c.othersMissed } : null) },
	{ key: 'greedy', name: 'Greedy', rarity: 2, cost: 6, icon: 'high_stakes', text: '+1 mult for each trick you bid, when you make it', score: (c) => (c.made && c.bid ? { mult: c.bid } : null) },
	{ key: 'last_word', name: 'Last Word', rarity: 2, cost: 5, icon: 'endplay', text: '+2 mult when you take the last trick and make your bid', score: (c) => (c.made && c.lastTrick ? { mult: 2 } : null) },
	{ key: 'big_round', name: 'Big Round', rarity: 2, cost: 6, icon: 'nine_card_fit', text: '+50 chips on five-card rounds you make', score: (c) => (c.made && c.size === 5 ? { chips: 50 } : null) },
	{ key: 'house_edge', name: 'House Edge', rarity: 2, cost: 6, icon: 'underdog', text: 'x1.5 mult on rounds you deal and make', score: (c) => (c.made && c.youDealt ? { xmult: 1.5 } : null) },
	{ key: 'clean_slate', name: 'Clean Slate', rarity: 3, cost: 8, icon: 'clean_slate', text: 'x2 mult when you bid zero and make it', score: (c) => (c.made && c.bid === 0 ? { xmult: 2 } : null) },
	{ key: 'third_eye', name: 'Third Eye', rarity: 3, cost: 8, icon: 'card_counter', text: 'x3 mult on one-card rounds you make', score: (c) => (c.made && c.blind ? { xmult: 3 } : null) }
];

const UPGRADES: UpgradeDef[] = [
	{ key: 'exact', name: 'Exact', icon: 'safety_net', text: 'Level up rounds where you make your bid', chips: 20, mult: 0.5 },
	{ key: 'nil', name: 'Nil', icon: 'clean_slate', text: 'Level up rounds where you bid zero and make it', chips: 25, mult: 0.6 },
	{ key: 'blind', name: 'Blind', icon: 'card_counter', text: 'Level up one-card rounds you make', chips: 40, mult: 1 }
];

export const whist22: GameModule<WhistHand, WhistAction, WhistCtx> = {
	id: 'whist22',
	title: 'Twenty-Two',
	tagline: 'a Whist 22 roguelike',
	words: { table: 'Table', hand: 'round', hands: 'rounds', chips: 'chips', pre: 'Bid' },
	tables: 8,
	boardsPerTable: 3,
	handsPerBoard: 3,
	startMoney: 6,
	goal: goals(TABLE_BASE, BOARD_SCALE),
	boardName: (run) => (run.board === 3 ? 'High Board' : `Board ${run.board}`),
	deal(run) {
		const i = (run.ext.round = run.ext.round === undefined ? 0 : (run.ext.round + 1) % W.ROUNDS.length);
		run.ext.dealer = run.ext.dealer ? cards.nextSeat(run.ext.dealer) : cards.WEST;
		run.hand = W.deal(run.rng, run.ext.dealer, W.ROUNDS[i], run.pack);
		R.homing(run, run.hand.hands, W.PLAYER, [run.hand.undealt]);
		run.phase = R.PHASE.PRE;
		runBids(run);
		return { hand: run.hand, phase: run.hand.stage === 'bid' ? 'pre' : 'play' };
	},
	act(run, a, opts) {
		const h = run.hand;
		const stepwise = !!opts?.stepwise;
		if (a.t === 'bid') {
			if (run.phase !== R.PHASE.PRE || h.turn !== W.PLAYER) throw new Error('whist22: not your bid');
			W.bid(h, W.PLAYER, a.bid);
			runBids(run, stepwise);
		} else if (a.t === 'play') {
			if (h.stage !== 'play' || h.turn !== W.PLAYER) throw new Error('whist22: not your turn');
			const card = findCard(h.hands[W.PLAYER], a.card);
			if (!card) throw new Error('whist22: not your card');
			W.play(h, W.PLAYER, card, a.fool);
			if (!stepwise) runPlay(run);
		} else {
			while (!h.complete) aiStep(h);
		}
	},
	swapHand: {
		can: (run) => (run.phase === R.PHASE.PRE && run.hand.stage === 'bid' && run.hand.turn === W.PLAYER ? [true] : [false, 'only at your bid']),
		swap: (run) => {
			const hs = run.hand.hands;
			[hs[W.PLAYER], hs[cards.WEST]] = [hs[cards.WEST], hs[W.PLAYER]];
		}
	},
	redeal(run) {
		// The same round size again, dealt by you.
		run.ext.round = ((run.ext.round ?? 0) + W.ROUNDS.length - 1) % W.ROUNDS.length;
		run.ext.dealer = cards.EAST;
		return whist22.deal(run);
	},
	handOver: (run) => run.hand.complete,
	untouched: (run) => run.hand.tricks.length === 0,
	settled(run) {
		const h = run.hand as WhistHand;
		if (h.stage !== 'play' || h.complete || h.tricks.length === 0) return false;
		// The Fool is two moves: as 0 and as 22.
		type Move = Card & { fool?: number };
		return settled(h, {
			clone: (s) => ({ ...s, hands: s.hands.map((x) => x.slice()), trick: s.trick.slice(), tricks: s.tricks.slice(), won: s.won.slice() }),
			over: (s) => s.complete,
			turn: (s) => s.turn,
			legal: (s, seat) => s.hands[seat].flatMap((c): Move[] => (W.isFool(c) ? [Object.assign(Object.create(c), { fool: 0 }), Object.assign(Object.create(c), { fool: 22 })] : [c])),
			play: (s, seat, c) => {
				const m = c as Move;
				const real = W.isFool(m) ? s.hands[seat].find(W.isFool)! : m;
				W.play(s, seat, real, m.fool);
			},
			outcome: (s) => `${s.won.join(',')}|${s.tricks.filter((t) => t.winner === W.PLAYER).map((t) => t.plays.find((p) => p.seat === W.PLAYER)!.value).sort().join(',')}|${s.tricks.at(-1)!.winner}`
		});
	},
	aiToMove: (run) => run.hand.stage === 'play' && !run.hand.complete && run.hand.turn !== W.PLAYER,
	stepAI: (run) => (aiStep(run.hand) ? 'trick' : 'card'),
	score(run) {
		const c = ctx(run);
		const lines: Line[] = [];
		const levels: string[] = [];
		const word = (n: number) => `${n} trick${n === 1 ? '' : 's'}`;
		if (!c.made) {
			return { title: `Missed: bid ${c.bid}, took ${c.tricks}`, made: false, lines: [{ label: `Bid ${word(c.bid)}, took ${c.tricks}`, chips: 0 }], ctx: c, levels };
		}
		run.ext.made = (run.ext.made ?? 0) + 1;
		lines.push({ label: `Made ${word(c.bid)} exactly`, chips: 40 + 30 * c.bid });
		levels.push('exact');
		let title = c.bid === 0 ? 'A clean zero' : `Made ${c.bid}`;
		if (c.bid === 0) {
			lines.push({ label: 'Nothing taken, as promised', chips: 20 * c.size });
			levels.push('nil');
		}
		if (c.blind) {
			title = 'Read the table!';
			lines.push({ label: 'Blind, on your forehead', chips: 60 });
			levels.push('blind');
		}
		const played = playedCards(run.hand.tricks, (s) => s === W.PLAYER, (s) => s === W.PLAYER);
		return { title, made: true, lines, ctx: c, levels, played };
	},
	newPack: W.newDeck,
	// Homing would hand you the Fool (or the 21) every round: too easy here.
	noSeals: ['homing'],
	relics: RELICS,
	upgrades: UPGRADES,
	ploys: [
		{
			key: 'loophole', name: 'Loophole', text: 'When you deal, your bid may make the bids add up this round', cost: 3, icon: 'lead_out_of_turn',
			when: [R.PHASE.PRE],
			canUse: (run) => {
				const h = run.hand as WhistHand;
				if (h.stage !== 'bid' || h.turn !== W.PLAYER) return [false, 'only when it’s your bid'];
				if (h.dealer !== W.PLAYER) return [false, 'only when you deal'];
				if (h.loophole === W.PLAYER) return [false, 'already open'];
				return [true];
			},
			use: (run) => void ((run.hand as WhistHand).loophole = W.PLAYER)
		}
	],
	bosses: [
		{ key: 'cold_deck', name: 'The Cold Deck', text: 'x0.75 mult on every round', tier: 1, score: () => ({ label: 'The Cold Deck', xmult: 0.75 }) },
		{ key: 'miser', name: 'The Miser', text: 'Zero bids score half', tier: 1, score: (c) => (c.bid === 0 ? { label: 'The Miser', xmult: 0.5 } : null) },
		{ key: 'short_table', name: 'The Short Table', text: 'Only two rounds on this board', tier: 2, hands: 2 },
		{ key: 'jester', name: 'The Jester', text: '-50 chips for each trick you win with the Fool', tier: 2, score: (c) => (c.foolWins ? { label: 'The Jester', chips: -50 * c.foolWins } : null) },
		{ key: 'perfectionist', name: 'The Perfectionist', text: 'x0.6 mult unless you take the last trick', tier: 3, score: (c) => (!c.lastTrick ? { label: 'The Perfectionist', xmult: 0.6 } : null) }
	],
	counters: (run) => ({ made: run.ext.made ?? 0 }),
	counterNames: { made: 'Bids made' },
	describeHand(run) {
		const h = run.hand;
		return `${h.size}-card round · bid ${h.bids[W.PLAYER]}, took ${h.won[W.PLAYER]}`;
	},
	bot(run) {
		const h = run.hand;
		if (run.phase === R.PHASE.PRE) return { t: 'bid', bid: ai.chooseBid(h, W.PLAYER) };
		const m = ai.chooseCard(h, W.PLAYER);
		return { t: 'play', card: cards.code(m.card), fool: m.fool };
	}
};
