// Euchre, as a cardkit roguelike: you're South, partnered with North,
// against East and West. Each hand: call trump (or pass), play five tricks.
// Your side scores 25 chips a trick; making trump and marching, euchring
// the other side, or a lone march add to it. Called trump and got euchred:
// the hand scores nothing. 8 tables x 3 boards x 4 hands.

import * as cards from '../../src/core/rules/cards.ts';
import * as E from './rules.ts';
import * as ai from './ai.ts';
import * as R from '../../src/run/run.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { EuchreHand } from './rules.ts';
import type { GameModule, Line, RelicDef, Run, UpgradeDef } from '../../src/run/run.ts';

export type EuchreAction = { t: 'call'; suit: number; alone?: boolean } | { t: 'pass' } | { t: 'play'; card: string } | { t: 'playOut' };

/** What relics see about a hand. */
export interface EuchreCtx {
	trump: number;
	/** Your side made trump. */
	makers: boolean;
	/** You (not partner) made trump. */
	youCalled: boolean;
	alone: boolean;
	/** Trump was named in round 2 (not the upcard's suit). */
	second: boolean;
	youDealt: boolean;
	/** Tricks your side, you and partner took. */
	tricks: number;
	yours: number;
	partners: number;
	march: boolean;
	/** You defended and euchred them. */
	euchredThem: boolean;
	/** Trumps you held once trump was made. */
	trumpsHeld: number;
	/** Tricks you won with the right bower, the left bower, an off-suit ace. */
	rightWins: number;
	leftWins: number;
	aceWins: number;
	/** Your side took the last trick. */
	lastTrick: boolean;
	/** Game points by the real rules: [your side, theirs]. */
	points: [number, number];
	marchesThisRun: number;
	handsThisBoard: number;
}

const TABLE_BASE = [100, 175, 280, 410, 580, 800, 1100, 1480];
const BOARD_SCALE = [1, 1.25, 1.55];
const PER_TRICK = 25;
const round10 = (n: number) => Math.round(n / 10) * 10;
const findCard = (hand: Card[], code: string) => hand.find((c) => cards.code(c) === code);

/** Let the AI seats call until it's your call or trump is made. */
function runCalls(run: Run<EuchreHand>, stepwise = false) {
	const h = run.hand;
	let guard = 0;
	while (h.trump === null && h.turn !== E.PLAYER) {
		if (++guard > 20) throw new Error('euchre: calls stuck');
		const c = ai.call(h, h.turn);
		if (c.suit !== null) E.makeTrump(h, h.turn, c.suit, c.alone, ai.discard);
		else E.pass(h, h.turn);
	}
	if (h.trump !== null) {
		run.phase = R.PHASE.PLAY;
		if (!stepwise) runPlay(run);
	}
}

/** Let the AI seats play until it's your turn or the hand is over. */
function runPlay(run: Run<EuchreHand>) {
	const h = run.hand;
	let guard = 0;
	while (!h.complete && h.turn !== E.PLAYER) {
		if (++guard > 40) throw new Error('euchre: play stuck');
		E.play(h, h.turn, ai.chooseCard(h, h.turn));
	}
}

function ctx(run: Run<EuchreHand>): EuchreCtx {
	const h = run.hand;
	const trump = h.trump!;
	const wonBy = (pred: (c: Card) => boolean) => h.tricks.filter((t) => t.winner === E.PLAYER && t.plays.some((p) => p.seat === E.PLAYER && pred(p.card))).length;
	const tricks = E.tricksFor(h, E.PLAYER);
	const makers = E.sameSide(h.maker!, E.PLAYER);
	return {
		trump,
		makers,
		youCalled: h.maker === E.PLAYER,
		alone: h.alone,
		second: h.second,
		youDealt: h.dealer === E.PLAYER,
		tricks,
		yours: h.tricks.filter((t) => t.winner === E.PLAYER).length,
		partners: h.tricks.filter((t) => t.winner === E.PARTNER).length,
		march: makers && tricks === 5,
		euchredThem: !makers && tricks >= 3,
		trumpsHeld: h.start[E.PLAYER].filter((c) => E.isTrump(c, trump)).length,
		rightWins: wonBy((c) => E.isRight(c, trump)),
		leftWins: wonBy((c) => E.isLeft(c, trump)),
		aceWins: wonBy((c) => c.rank === 14 && !E.isTrump(c, trump)),
		lastTrick: E.sameSide(h.tricks[4].winner, E.PLAYER),
		points: E.points(h),
		marchesThisRun: run.ext.marches ?? 0,
		handsThisBoard: run.module.handsPerBoard - run.handsLeft + 1
	};
}

const RELICS: RelicDef<EuchreCtx>[] = [
	{ key: 'right_bower', name: 'Right Bower', rarity: 1, cost: 4, icon: 'honour_roll', text: '+40 chips for each trick you win with the right bower', score: (c) => ({ chips: 40 * c.rightWins }) },
	{ key: 'left_bower', name: 'Left Bower', rarity: 1, cost: 4, icon: 'transfer', text: '+50 chips for each trick you win with the left bower', score: (c) => ({ chips: 50 * c.leftWins }) },
	{ key: 'green_aces', name: 'Green Aces', rarity: 1, cost: 4, icon: 'ace_collector', text: '+30 chips for each trick you win with an off-suit ace', score: (c) => ({ chips: 30 * c.aceWins }) },
	{ key: 'trump_hoard', name: 'Trump Hoard', rarity: 1, cost: 5, icon: 'nine_card_fit', text: '+12 chips for each trump you held', score: (c) => ({ chips: 12 * c.trumpsHeld }) },
	{ key: 'good_partner', name: 'Good Partner', rarity: 1, cost: 5, icon: 'partners_trust', text: '+1 mult for each trick your partner wins', score: (c) => ({ mult: c.partners }) },
	{ key: 'next', name: 'Next', rarity: 2, cost: 6, icon: 'shape_shifter', text: '+2 mult when trump is named in the second round', score: (c) => (c.second ? { mult: 2 } : null) },
	{ key: 'stuck', name: 'Screw the Dealer', rarity: 2, cost: 6, icon: 'underdog', text: 'x1.5 mult on hands you deal', score: (c) => (c.youDealt ? { xmult: 1.5 } : null) },
	{ key: 'last_word', name: 'Last Word', rarity: 2, cost: 5, icon: 'endplay', text: '+3 mult when your side takes the last trick', score: (c) => (c.lastTrick ? { mult: 3 } : null) },
	{ key: 'euchre_artist', name: 'Euchre Artist', rarity: 2, cost: 7, icon: 'the_squeeze', text: 'x2 mult when you euchre them', score: (c) => (c.euchredThem ? { xmult: 2 } : null) },
	{ key: 'caller', name: 'The Caller', rarity: 2, cost: 6, icon: 'bold_bidding', text: '+60 chips when you make trump yourself and make it', score: (c) => (c.youCalled && c.tricks >= 3 ? { chips: 60 } : null) },
	{
		key: 'marching_band', name: 'Marching Band', rarity: 3, cost: 8, icon: 'clean_sweep', text: '+0.5 mult for every march this run',
		describe: (r) => `+0.5 mult for every march this run (now +${(0.5 * (r.state.marches ?? 0)).toFixed(1)})`,
		score: (c) => (c.marchesThisRun ? { mult: 0.5 * c.marchesThisRun } : null),
		onHandEnd: (c, r) => void (r.state.marches = c.marchesThisRun)
	},
	{ key: 'lone_wolf', name: 'Lone Wolf', rarity: 3, cost: 9, icon: 'high_stakes', text: 'x3 mult when you go alone and take three or more', score: (c) => (c.alone && c.youCalled && c.tricks >= 3 ? { xmult: 3 } : null) },
	{ key: 'point_man', name: 'Point Man', rarity: 1, cost: 4, icon: 'master_points', text: '+1 mult for each game point your side scores by the real rules', score: (c) => (c.points[0] ? { mult: c.points[0] } : null) }
];

const UPGRADES: UpgradeDef[] = [
	{ key: 'makers', name: 'Makers', icon: 'bold_bidding', text: 'Level up hands where your side makes trump and takes three', chips: 15, mult: 0.5 },
	{ key: 'euchre', name: 'Euchre', icon: 'the_squeeze', text: 'Level up hands where you euchre them', chips: 30, mult: 0.8 },
	{ key: 'march', name: 'March', icon: 'clean_sweep', text: 'Level up marches', chips: 40, mult: 1 }
];

export const euchre: GameModule<EuchreHand, EuchreAction, EuchreCtx> = {
	id: 'euchre',
	title: 'Right Bower',
	tagline: 'a euchre roguelike',
	words: { table: 'Table', hand: 'hand', hands: 'hands', chips: 'chips', pre: 'Call' },
	tables: 8,
	boardsPerTable: 3,
	handsPerBoard: 4,
	startMoney: 6,
	goal: (table, board) => round10(TABLE_BASE[Math.min(table, 8) - 1] * BOARD_SCALE[board - 1]),
	boardName: (run) => (run.board === 3 ? 'Big Board' : `Board ${run.board}`),
	deal(run) {
		const dealer = (run.ext.dealer = run.ext.dealer ? cards.nextSeat(run.ext.dealer) : cards.WEST);
		run.hand = E.deal(run.rng, dealer, run.pack);
		R.homing(run, run.hand.hands, E.PLAYER);
		run.phase = R.PHASE.PRE;
		runCalls(run);
		return { hand: run.hand, phase: run.hand.trump === null ? 'pre' : 'play' };
	},
	act(run, a, opts) {
		const h = run.hand;
		const stepwise = !!opts?.stepwise;
		if (a.t === 'call' || a.t === 'pass') {
			if (run.phase !== R.PHASE.PRE || h.turn !== E.PLAYER) throw new Error('euchre: not your call');
			if (a.t === 'pass') E.pass(h, E.PLAYER);
			else {
				if (h.round === 1 ? a.suit !== h.upcard.suit : a.suit === h.upcard.suit) throw new Error('euchre: you can’t name that suit now');
				E.makeTrump(h, E.PLAYER, a.suit, !!a.alone, ai.discard);
			}
			runCalls(run, stepwise);
		} else if (a.t === 'play') {
			if (h.turn !== E.PLAYER) throw new Error('euchre: not your turn');
			const card = findCard(h.hands[E.PLAYER], a.card);
			if (!card) throw new Error('euchre: not your card');
			E.play(h, E.PLAYER, card);
			if (!stepwise) runPlay(run);
		} else {
			while (!h.complete) E.play(h, h.turn, ai.chooseCard(h, h.turn));
		}
	},
	handOver: (run) => run.hand.complete,
	untouched: (run) => run.hand.tricks.length === 0,
	aiToMove: (run) => run.hand.trump !== null && !run.hand.complete && run.hand.turn !== E.PLAYER,
	stepAI: (run) => (E.play(run.hand, run.hand.turn, ai.chooseCard(run.hand, run.hand.turn)) ? 'trick' : 'card'),
	score(run) {
		const c = ctx(run);
		const name = cards.SUITS[c.trump].name.toLowerCase();
		if (c.march) run.ext.marches = (run.ext.marches ?? 0) + 1;
		c.marchesThisRun = run.ext.marches ?? 0;
		const lines: Line[] = [];
		const levels: string[] = [];
		if (c.makers && c.tricks < 3) {
			return { title: 'Euchred!', made: false, lines: [{ label: `${name} made, ${c.tricks} trick${c.tricks === 1 ? '' : 's'}: euchred`, chips: 0 }], ctx: c, levels, detail: c.points };
		}
		lines.push({ label: `${c.tricks} trick${c.tricks === 1 ? '' : 's'} taken`, chips: PER_TRICK * c.tricks });
		let title = c.makers ? `Made ${name}` : `They made ${name}`;
		if (c.makers) levels.push('makers');
		if (c.march) {
			title = 'A march!';
			lines.push({ label: 'March: all five tricks', chips: 50 });
			levels.push('march');
			if (c.alone && c.youCalled) {
				title = 'A lone march!';
				lines.push({ label: 'Alone', xmult: 2 });
			}
		}
		if (c.euchredThem) run.ext.euchres = (run.ext.euchres ?? 0) + 1;
		if (c.euchredThem) {
			title = 'You euchred them!';
			lines.push({ label: 'Euchred them', chips: 60 });
			levels.push('euchre');
		}
		const played = run.hand.tricks.flatMap((t) => t.plays.map((p) => ({ card: p.card, mine: p.seat === E.PLAYER, wonByUs: E.sameSide(t.winner, E.PLAYER), winning: p.seat === t.winner })));
		return { title, made: true, lines, ctx: c, levels, played, detail: c.points };
	},
	newPack: E.newDeck,
	relics: RELICS,
	upgrades: UPGRADES,
	bosses: [
		{ key: 'cold_deck', name: 'The Cold Deck', text: 'x0.75 mult on every hand', tier: 1, score: () => ({ label: 'The Cold Deck', xmult: 0.75 }) },
		{ key: 'bower_thief', name: 'The Bower Thief', text: '-40 chips for each trick you win with a bower', tier: 1, score: (c) => (c.rightWins + c.leftWins ? { label: 'The Bower Thief', chips: -40 * (c.rightWins + c.leftWins) } : null) },
		{ key: 'short_table', name: 'The Short Table', text: 'Only three hands on this board', tier: 2, hands: 3 },
		{ key: 'grudge', name: 'The Grudge', text: 'Hands where they make trump score half', tier: 2, score: (c) => (!c.makers ? { label: 'The Grudge: their trump', xmult: 0.5 } : null) },
		{ key: 'marcher', name: 'The Drill Sergeant', text: 'Only marches and euchres score levels; x0.6 otherwise', tier: 3, score: (c) => (!c.march && !c.euchredThem ? { label: 'The Drill Sergeant', xmult: 0.6 } : null) }
	],
	counters: (run) => ({ marches: run.ext.marches ?? 0, euchres: run.ext.euchres ?? 0 }),
	counterNames: { marches: 'Marches', euchres: 'Euchres' },
	describeHand(run) {
		const h = run.hand;
		return `${ai.seatName(h.maker!)} made ${cards.SUITS[h.trump!].name.toLowerCase()}${h.alone ? ' alone' : ''} · your side ${E.tricksFor(h, E.PLAYER)} tricks`;
	},
	bot(run) {
		const h = run.hand;
		if (run.phase === R.PHASE.PRE) {
			const c = ai.call(h, E.PLAYER);
			return c.suit === null ? { t: 'pass' } : { t: 'call', suit: c.suit, alone: c.alone };
		}
		return { t: 'play', card: cards.code(ai.chooseCard(h, E.PLAYER)) };
	}
};
