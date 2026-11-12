// Whist 22, as a cardkit roguelike: you're South at a table of four, playing
// the Tarot trumps and the Fool. Each hand is one round (5, 4, 3, 2, 1, 2, 3,
// 4 cards, then 5 again, around and around the run). Bid exactly how many
// tricks you'll take, then take exactly that: a made bid scores, more for
// bigger bids; a clean zero and the blind one-card round have their own
// bonuses. Off by one scores a quarter; further off, nothing. 8 tables x 3
// boards x 3 rounds.

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
	/** You took the first trick. */
	firstTrick: boolean;
	/** You played the Fool as 0 (to duck). */
	foolLow: boolean;
	/** The table's bids added up to more, or fewer, than the cards dealt. */
	bidsOver: boolean;
	bidsUnder: boolean;
	/** Rounds made in a row, and on this board, counting this one. */
	streak: number;
	boardMade: number;
	/** Made only because Hedge forgave being off by one. */
	hedged: boolean;
	/** Tricks where every card played was under 6 (a Fool played as 0 counts). */
	pennyTricks: number;
	/** All such tricks this run (Penny Ante's mult). */
	penniesThisRun: number;
	handsThisBoard: number;
	/** Tricks you won with a trump ranked 15-20, or 10-14. */
	highWins: number;
	midWins: number;
	/** You took every trick in the round. */
	wonAll: boolean;
	/** You used a ploy (Second Sight, Hedge or Loophole) this round. */
	usedPloy: boolean;
	/** You used Second Sight this round. */
	usedSpy: boolean;
	/** The cards dealt went up, or down, from last round. */
	rising: boolean;
	falling: boolean;
	/** Relics you hold, and how many carry an edition. */
	relicCount: number;
	editionCount: number;
	/** Your money right now. */
	money: number;
	/** Rounds you've made this run, counting this one. */
	totalMade: number;
}

const TABLE_BASE = [70, 120, 180, 260, 370, 510, 690, 920];
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
	// The Fixer: a relic that forgives being off by one, like Hedge, for free.
	const hedge = !!h.hedge || R.hasRule(run, 'auto_hedge');
	return {
		size: h.size,
		bid: h.bids[W.PLAYER]!,
		tricks: h.won[W.PLAYER],
		made: W.madeBid(h, W.PLAYER) || (hedge && Math.abs(h.won[W.PLAYER] - h.bids[W.PLAYER]!) === 1),
		hedged: !W.madeBid(h, W.PLAYER) && hedge && Math.abs(h.won[W.PLAYER] - h.bids[W.PLAYER]!) === 1,
		blind: h.blind,
		youDealt: h.dealer === W.PLAYER,
		foolWins: mine.filter((p) => W.isFool(p.card)).length,
		wins21: mine.filter((p) => p.card.rank === 21).length,
		lowWins: mine.filter((p) => !W.isFool(p.card) && p.card.rank < 10).length,
		highWins: mine.filter((p) => !W.isFool(p.card) && p.card.rank >= 15 && p.card.rank < 21).length,
		midWins: mine.filter((p) => !W.isFool(p.card) && p.card.rank >= 10 && p.card.rank < 15).length,
		lastTrick: h.tricks.at(-1)?.winner === W.PLAYER,
		othersMissed: [1, 2, 4].filter((s) => !W.madeBid(h, s)).length,
		firstTrick: h.tricks[0]?.winner === W.PLAYER,
		foolLow: h.tricks.some((t) => t.plays.some((p) => p.seat === W.PLAYER && W.isFool(p.card) && p.value === 0)),
		pennyTricks: h.tricks.filter((t) => t.plays.every((p) => p.value < 6)).length,
		penniesThisRun: 0,
		bidsOver: W.bidTotal(h) > h.size,
		bidsUnder: W.bidTotal(h) < h.size,
		streak: 0,
		boardMade: 0,
		handsThisBoard: run.module.handsPerBoard - run.handsLeft + 1,
		wonAll: h.won[W.PLAYER] === h.size,
		usedPloy: !!h.spy || !!h.hedge || h.loophole === W.PLAYER,
		usedSpy: !!h.spy,
		rising: run.ext.prevSize !== undefined && h.size > run.ext.prevSize,
		falling: run.ext.prevSize !== undefined && h.size < run.ext.prevSize,
		relicCount: run.relics.length,
		editionCount: run.relics.filter((r) => r.edition).length,
		money: run.money,
		totalMade: 0
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
	{
		key: 'penny_ante', name: 'Penny Ante', rarity: 2, cost: 6, icon: 'low_ball', text: 'Gains +1 mult for good each trick where every card played is under 6',
		describe: (r) => `Gains +1 mult for good each trick where every card played is under 6 (now +${r.state.pennies ?? 0})`,
		score: (c) => (c.penniesThisRun ? { mult: c.penniesThisRun } : null),
		onHandEnd: (c, r) => void (r.state.pennies = c.penniesThisRun)
	},
	{ key: 'first_blood', name: 'First Blood', rarity: 1, cost: 4, icon: 'lead_out_of_turn', text: '+30 chips when you take the first trick and make your bid', score: (c) => (c.made && c.firstTrick ? { chips: 30 } : null) },
	{ key: 'overbooked', name: 'Overbooked', rarity: 1, cost: 4, icon: 'double_down', text: '+40 chips when the bids add up to more than the cards dealt and you make yours', score: (c) => (c.made && c.bidsOver ? { chips: 40 } : null) },
	{ key: 'short_change', name: 'Short Change', rarity: 1, cost: 4, icon: 'tip_jar', text: '+40 chips when the bids add up to fewer than the cards dealt and you make yours', score: (c) => (c.made && c.bidsUnder ? { chips: 40 } : null) },
	{
		key: 'hot_streak', name: 'Hot Streak', rarity: 2, cost: 6, icon: 'slow_burn', text: '+0.5 mult for each round in a row you have made your bid',
		describe: (r) => `+0.5 mult for each round in a row you have made your bid (now ${r.state.streak ?? 0} in a row)`,
		score: (c) => (c.made && c.streak ? { mult: 0.5 * c.streak } : null),
		onHandEnd: (c, r) => void (r.state.streak = c.streak)
	},
	{ key: 'fools_errand', name: 'Fool’s Errand', rarity: 2, cost: 6, icon: 'ploy_fall_guy', text: '+2 mult when you play the Fool as 0 and make your bid', score: (c) => (c.made && c.foolLow ? { mult: 2 } : null) },
	{ key: 'the_hermit', name: 'The Hermit', rarity: 2, cost: 7, icon: 'wallflower', text: 'x2 mult when you are the only one to make your bid', score: (c) => (c.made && c.othersMissed === 3 ? { xmult: 2 } : null) },
	{ key: 'the_emperor', name: 'The Emperor', rarity: 3, cost: 8, icon: 'crown_jewels', text: '+1 mult for each round you have made on this board', score: (c) => (c.made && c.boardMade ? { mult: c.boardMade } : null) },
	{ key: 'the_chariot', name: 'The Chariot', rarity: 3, cost: 9, icon: 'slam_hunter', text: 'x2 mult when you bid 3 or more and make it', score: (c) => (c.made && c.bid >= 3 ? { xmult: 2 } : null) },
	{ key: 'third_eye', name: 'Third Eye', rarity: 3, cost: 8, icon: 'card_counter', text: 'x3 mult on one-card rounds you make', score: (c) => (c.made && c.blind ? { xmult: 3 } : null) },

	// ---------------------------------------------------------------- common
	{ key: 'bold_bid', name: 'Bold Bid', rarity: 1, cost: 5, icon: 'bold_bidding', text: '+25 chips when you bid 4 or more and make it', score: (c) => (c.made && c.bid >= 4 ? { chips: 25 } : null) },
	{ key: 'safe_bet', name: 'Safe Bet', rarity: 1, cost: 4, icon: 'safety_net', text: '+20 chips when you bid 1 and make it', score: (c) => (c.made && c.bid === 1 ? { chips: 20 } : null) },
	{ key: 'honour_roll', name: 'Honour Roll', rarity: 1, cost: 5, icon: 'honour_roll', text: '+25 chips for each trick you win with a trump 15 or higher, short of the 21', score: (c) => (c.highWins ? { chips: 25 * c.highWins } : null) },
	{ key: 'minor_nobility', name: 'Minor Nobility', rarity: 1, cost: 4, icon: 'minor_nobility', text: '+15 chips for each trick you win with a trump 10 to 14', score: (c) => (c.midWins ? { chips: 15 * c.midWins } : null) },
	{ key: 'duckling', name: 'Duckling', rarity: 1, cost: 4, icon: 'duck_hunter', text: '+50 chips on two-card rounds you make', score: (c) => (c.made && c.size === 2 ? { chips: 50 } : null) },
	{ key: 'threes_company', name: 'Three’s Company', rarity: 1, cost: 4, icon: 'flat_hand', text: '+50 chips on three-card rounds you make', score: (c) => (c.made && c.size === 3 ? { chips: 50 } : null) },
	{ key: 'four_square', name: 'Four Square', rarity: 1, cost: 4, icon: 'club_sandwich', text: '+50 chips on four-card rounds you make', score: (c) => (c.made && c.size === 4 ? { chips: 50 } : null) },
	{ key: 'clean_sweep', name: 'Clean Sweep', rarity: 1, cost: 5, icon: 'clean_sweep', text: '+70 chips when you take every trick in the round', score: (c) => (c.made && c.wonAll && c.size > 1 ? { chips: 70 } : null) },
	{ key: 'tailwind', name: 'Tailwind', rarity: 1, cost: 4, icon: 'tailwind', text: '+40 chips on rounds you make where more cards were dealt than last round', score: (c) => (c.made && c.rising ? { chips: 40 } : null) },
	{ key: 'cold_feet', name: 'Cold Feet', rarity: 1, cost: 4, icon: 'cold_feet', text: '+40 chips on rounds you make where fewer cards were dealt than last round', score: (c) => (c.made && c.falling ? { chips: 40 } : null) },

	// -------------------------------------------------------------- uncommon
	{ key: 'insurance', name: 'Insurance', rarity: 2, cost: 6, icon: 'insurance', text: '+3 mult when Hedge forgives you', score: (c) => (c.hedged ? { mult: 3 } : null) },
	{ key: 'coup', name: 'Coup', rarity: 2, cost: 6, icon: 'coup', text: '+2 mult when you win the first trick with the Fool', score: (c) => (c.firstTrick && c.foolWins ? { mult: 2 } : null) },
	{ key: 'the_void', name: 'The Void', rarity: 2, cost: 7, icon: 'the_void', text: 'x1.5 mult when you bid zero, the bids add up exactly, and you make it', score: (c) => (c.made && c.bid === 0 && !c.bidsOver && !c.bidsUnder ? { xmult: 1.5 } : null) },
	{ key: 'rubber_baron', name: 'Rubber Baron', rarity: 2, cost: 6, icon: 'rubber_baron', text: 'Earn $3 extra each time you win a board', onBoardWin: () => ({ money: 3 }) },
	{ key: 'interest_rate', name: 'Interest Rate', rarity: 2, cost: 7, icon: 'interest_rate', text: 'Interest can reach $8 a hand instead of $5', interestCap: 8 },
	{ key: 'bargain_bin', name: 'Bargain Bin', rarity: 2, cost: 6, icon: 'bargain_bin', text: 'Rerolls cost $1 less, and the first in each club is free', bargain: true },
	{ key: 'table_talk', name: 'Table Talk', rarity: 2, cost: 6, icon: 'table_talk', text: '+2 mult on rounds where you use a ploy', score: (c) => (c.usedPloy ? { mult: 2 } : null) },
	{ key: 'doubled_down', name: 'Doubled Down', rarity: 2, cost: 7, icon: 'doubled_down', text: 'x1.4 mult when the bids add up to more than the cards dealt and you make yours', score: (c) => (c.made && c.bidsOver ? { xmult: 1.4 } : null) },
	{ key: 'partners_trust', name: 'Partner’s Trust', rarity: 2, cost: 6, icon: 'partners_trust', text: '+0.5 mult for each other player who makes their bid', score: (c) => (3 - c.othersMissed ? { mult: 0.5 * (3 - c.othersMissed) } : null) },
	{ key: 'backbone', name: 'Backbone', rarity: 2, cost: 7, icon: 'strong_partner', text: '+0.3 mult for each trick you win, when you make your bid', score: (c) => (c.made && c.tricks ? { mult: 0.3 * c.tricks } : null) },

	// ------------------------------------------------------------------ rare
	{ key: 'grand_design', name: 'Grand Design', rarity: 3, cost: 8, icon: 'grand_design', text: 'x2 mult when you bid zero on a five-card round and make it', score: (c) => (c.made && c.bid === 0 && c.size === 5 ? { xmult: 2 } : null) },
	{ key: 'vienna_coup', name: 'Vienna Coup', rarity: 3, cost: 9, icon: 'vienna_coup', text: 'x1.2 mult for each trick you win with the Fool', score: (c) => (c.foolWins ? { xmult: 1.2 ** c.foolWins } : null) },
	{ key: 'trump_coup', name: 'Trump Coup', rarity: 3, cost: 9, icon: 'trump_coup', text: 'x3 mult when you make your bid blind and no one else makes theirs', score: (c) => (c.made && c.blind && c.othersMissed === 3 ? { xmult: 3 } : null) },
	{ key: 'the_squeeze', name: 'The Squeeze', rarity: 3, cost: 8, icon: 'the_squeeze', text: 'x1.5 mult when the bids add up to more than the cards dealt and you make yours', score: (c) => (c.made && c.bidsOver ? { xmult: 1.5 } : null) },
	{ key: 'kibitzer', name: 'Kibitzer', rarity: 3, cost: 8, icon: 'kibitzer', text: 'x1.5 mult on rounds where you use Second Sight', score: (c) => (c.usedSpy ? { xmult: 1.5 } : null) },
	{ key: 'gallery', name: 'Gallery', rarity: 3, cost: 8, icon: 'gallery', text: '+0.5 mult for each of your relics with an edition', score: (c) => (c.editionCount ? { mult: 0.5 * c.editionCount } : null) },
	{ key: 'gilded_cage', name: 'Gilded Cage', rarity: 3, cost: 9, icon: 'gilded_cage', text: '+0.4 mult for each relic you hold', score: (c) => (c.relicCount ? { mult: 0.4 * c.relicCount } : null) },
	{ key: 'purist', name: 'Purist', rarity: 3, cost: 8, icon: 'purist', text: 'x2 mult when you make your bid without winning a trick with the Fool', score: (c) => (c.made && !c.foolWins ? { xmult: 2 } : null) },

	// ------------------------------------------------------------- legendary
	{
		key: 'master_points', name: 'Master Points', rarity: 4, cost: 12, icon: 'master_points', text: '+0.3 mult for each round you have made this run',
		score: (c) => (c.totalMade ? { mult: 0.3 * c.totalMade } : null)
	},
	{
		key: 'life_master', name: 'Life Master', rarity: 4, cost: 12, icon: 'life_master', text: 'Gains x0.02 mult for every trick you win, for the rest of the run',
		describe: (r) => `Gains x0.02 mult for every trick you win, for the rest of the run (now x${(1 + (r.state.x ?? 0)).toFixed(2)})`,
		onHandEnd: (c, r) => void (r.state.x = (r.state.x ?? 0) + 0.02 * c.tricks),
		score: (_c, r) => ((r.state.x ?? 0) > 0 ? { xmult: 1 + r.state.x } : null)
	},
	{ key: 'slam_dunk', name: 'Grand Slam', rarity: 4, cost: 13, icon: 'slam_dunk', text: 'x3 mult when you bid every card dealt and make it', score: (c) => (c.made && c.bid === c.size && c.size > 1 ? { xmult: 3 } : null) },
	{ key: 'kings_ransom', name: 'King’s Ransom', rarity: 4, cost: 11, icon: 'kings_ransom', text: 'x1.1 mult for every $10 you have', score: (c) => (c.money >= 10 ? { xmult: 1.1 ** Math.floor(c.money / 10) } : null) },
	{ key: 'the_fixer', name: 'The Fixer', rarity: 4, cost: 10, icon: 'the_fixer', text: 'Being off by one trick always counts as making your bid', rule: 'auto_hedge' }
];

const UPGRADES: UpgradeDef[] = [
	{ key: 'exact', name: 'Exact', icon: 'safety_net', text: 'Level up rounds where you make your bid', chips: 20, mult: 0.5 },
	{ key: 'nil', name: 'Nil', icon: 'clean_slate', text: 'Level up rounds where you bid zero and make it', chips: 20, mult: 0.4 },
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
		// The Auctioneer: East deals, so you bid first, with nothing to go on.
		if (R.bossIs(run, 'auctioneer')) run.ext.dealer = cards.EAST;
		run.hand = W.deal(run.rng, run.ext.dealer, W.ROUNDS[i], run.pack);
		// The Tyrant: no zero bids from you.
		if (R.bossIs(run, 'tyrant')) run.hand.minBid = { seat: W.PLAYER, min: 1 };
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
		// Rounds made in a row, and on this board (Hot Streak, The Emperor).
		const boardKey = `${run.table}.${run.board}`;
		if (run.ext.boardKey !== boardKey) (run.ext.boardKey = boardKey), (run.ext.boardMade = 0);
		run.ext.streak = c.made ? (run.ext.streak ?? 0) + 1 : 0;
		if (c.made) run.ext.boardMade = (run.ext.boardMade ?? 0) + 1;
		c.streak = run.ext.streak;
		run.ext.pennies = (run.ext.pennies ?? 0) + c.pennyTricks;
		c.penniesThisRun = run.ext.pennies;
		c.boardMade = run.ext.boardMade;
		run.ext.prevSize = c.size;
		const lines: Line[] = [];
		const levels: string[] = [];
		const word = (n: number) => `${n} trick${n === 1 ? '' : 's'}`;
		// What the bid is worth made: more for every trick promised.
		const worth = 40 + 40 * c.bid;
		if (!c.made) {
			// Off by one: a quarter of it, so one bad round isn't the whole board.
			if (Math.abs(c.tricks - c.bid) === 1) {
				return { title: `So close: bid ${c.bid}, took ${c.tricks}`, made: true, lines: [{ label: `Off by one: a quarter of ${worth}`, chips: Math.round(worth / 4) }], ctx: c, levels };
			}
			return { title: `Missed: bid ${c.bid}, took ${c.tricks}`, made: false, lines: [{ label: `Bid ${word(c.bid)}, took ${c.tricks}`, chips: 0 }], ctx: c, levels };
		}
		run.ext.made = (run.ext.made ?? 0) + 1;
		c.totalMade = run.ext.made;
		lines.push({ label: `Made ${word(c.bid)} exactly`, chips: worth });
		levels.push('exact');
		let title = c.hedged ? `Hedged: bid ${c.bid}, took ${c.tricks}` : c.bid === 0 ? 'A clean zero' : `Made ${c.bid}`;
		if (c.bid === 0) {
			lines.push({ label: 'Nothing taken, as promised', chips: 10 * c.size });
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
	decks: [
		{
			key: 'jester', name: 'Jester’s Deck', text: 'The Fool starts Prismatic, the 21 Etched', back: 'burned',
			apply: (run) => run.pack.forEach((c) => (W.isFool(c) ? R.setMod(run, c, { edition: 'prismatic' }) : c.rank === 21 ? R.setMod(run, c, { edition: 'etched' }) : null))
		}
	],
	relics: RELICS,
	upgrades: UPGRADES,
	ploys: [
		{
			key: 'second_sight', name: 'Second Sight', text: 'See everyone’s cards for the rest of this round', cost: 3, icon: 'ploy_spyglass',
			when: [R.PHASE.PRE, R.PHASE.PLAY],
			canUse: (run) => ((run.hand as WhistHand).spy ? [false, 'already seeing'] : [true]),
			use: (run) => void ((run.hand as WhistHand).spy = true)
		},
		{
			key: 'hedge', name: 'Hedge', text: 'This round, being off by one trick counts as making your bid', cost: 4, icon: 'ploy_umbrella',
			when: [R.PHASE.PRE, R.PHASE.PLAY],
			canUse: (run) => ((run.hand as WhistHand).hedge ? [false, 'already hedged'] : [true]),
			use: (run) => void ((run.hand as WhistHand).hedge = true)
		},
		{
			key: 'fools_bargain', name: 'Fool’s Bargain', text: 'Take the Fool from whoever holds it, giving them your lowest card', cost: 4, icon: 'wildcard',
			when: [R.PHASE.PRE],
			canUse: (run) => {
				const h = run.hand as WhistHand;
				if (h.hands[W.PLAYER].some(W.isFool)) return [false, 'you hold it already'];
				if (![1, 2, 4].some((s) => h.hands[s].some(W.isFool))) return [false, 'no one was dealt it this round'];
				return [true];
			},
			use: (run) => {
				const h = run.hand as WhistHand;
				const holder = [1, 2, 4].find((s) => h.hands[s].some(W.isFool))!;
				const mine = h.hands[W.PLAYER];
				const fool = h.hands[holder].find(W.isFool)!;
				const low = mine.reduce((a, b) => (b.rank < a.rank ? b : a));
				h.hands[holder].splice(h.hands[holder].indexOf(fool), 1, low);
				mine.splice(mine.indexOf(low), 1, fool);
			}
		},
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
		{ key: 'auctioneer', name: 'The Auctioneer', text: 'You bid first every round', tier: 1 },
		{ key: 'tyrant', name: 'The Tyrant', text: 'You can’t bid zero', tier: 2 },
		{ key: 'fog_bids', name: 'The Fog', text: 'The other bids stay hidden until the round is over', tier: 2 },
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
