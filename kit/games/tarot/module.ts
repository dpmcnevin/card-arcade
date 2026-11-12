// French Tarot, as a cardkit roguelike: you're South, at a table of four.
// Each hand: one round of bids; whoever bids highest takes and plays alone
// against the other three. Take it yourself and make your contract, or
// defend with the other two and set the taker. Your side's card points
// score chips; making a contract (or setting one) and its margin add more,
// and a Garde or better multiplies it. Taking and going down scores nothing.
// 8 tables x 3 boards x 3 hands (Tarot hands are long: eighteen tricks).

import * as cards from '../../src/core/rules/cards.ts';
import * as T from './rules.ts';
import * as ai from './ai.ts';
import * as R from '../../src/run/run.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { Bid, TarotHand } from './rules.ts';
import type { GameModule, Line, RelicDef, Run, UpgradeDef } from '../../src/run/run.ts';
import { settled, fateOfMine } from '../../src/run/settle.ts';
import { goals, findCard, playedCards, aiUntil } from '../../src/run/helpers.ts';

export type TarotAction = { t: 'bid'; bid: Bid | 0 } | { t: 'aside'; cards: string[] } | { t: 'play'; card: string } | { t: 'playOut' };

/** What relics see about a hand. */
export interface TarotCtx {
	/** You took. */
	taker: boolean;
	contract: Bid;
	/** The taker made the contract. */
	made: boolean;
	/** By how many points the contract was made or missed. */
	margin: number;
	/** Your side won the hand (you took and made it, or defended and set it). */
	won: boolean;
	/** Points your side ended with, and how many oudlers and kings among them. */
	sidePoints: number;
	sideOudlers: number;
	sideKings: number;
	/** Tricks you won yourself, as taker or defender. */
	tricks: number;
	/** Tricks you won by trumping a suit that was led. */
	trumpWins: number;
	/** Tricks you won with the 21. */
	wins21: number;
	/** Your side took the last trick with the Petit in it. */
	petitAuBout: boolean;
	/** Trumps you held once play began. */
	trumpsHeld: number;
	/** You held the Excuse and kept it. */
	keptExcuse: boolean;
	/** The dog you took held an oudler. */
	dogOudler: boolean;
	/** The real game's score for you (the taker's x3). */
	gamePoints: number;
	handsThisBoard: number;
}

const TABLE_BASE = [160, 280, 440, 640, 900, 1220, 1650, 2200];
const BOARD_SCALE = [1, 1.25, 1.55];
/** A Garde or better multiplies the hand. */
const CONTRACT_X = [1, 1, 1.5, 2, 2.5];

/** A fresh deal; if everyone passes, the next dealer deals again. */
function newDeal(run: Run<TarotHand>) {
	run.ext.dealer = run.ext.dealer ? cards.nextSeat(run.ext.dealer) : cards.WEST;
	run.hand = T.deal(run.rng, run.ext.dealer, run.pack);
	R.homing(run, run.hand.hands, T.PLAYER);
	run.phase = R.PHASE.PRE;
}

/** Let the AI seats bid (and an AI taker set aside) until it's your say or
 *  play begins. Everyone passing deals again. */
function runBids(run: Run<TarotHand>, stepwise = false) {
	let guard = 0;
	for (;;) {
		const h = run.hand;
		if (++guard > 200) throw new Error('tarot: bidding stuck');
		if (T.allPassed(h)) {
			newDeal(run);
			continue;
		}
		if (h.stage === 'bid') {
			if (h.turn === T.PLAYER) return;
			T.bid(h, h.turn, ai.chooseBid(h, h.turn));
			continue;
		}
		if (h.stage === 'dog') {
			if (h.taker === T.PLAYER) return;
			T.setAside(h, ai.chooseAside(h.hands[h.taker!]));
			continue;
		}
		run.phase = R.PHASE.PLAY;
		if (!stepwise) runPlay(run);
		return;
	}
}

function runPlay(run: Run<TarotHand>) {
	const h = run.hand;
	aiUntil(() => h.complete || h.turn === T.PLAYER, () => void T.play(h, h.turn, ai.chooseCard(h, h.turn)), 100, 'tarot: play');
}

function ctx(run: Run<TarotHand>): TarotCtx {
	const h = run.hand;
	const o = T.outcome(h);
	const taker = h.taker === T.PLAYER;
	const ours = (s: number) => T.sideOf(h, s) === T.sideOf(h, T.PLAYER);
	const sideCards = [1, 2, 3, 4].filter(ours).flatMap((s) => h.won[s]);
	const takerHalf = o.takerHalf;
	const sideHalf = taker ? takerHalf : 182 - takerHalf;
	const myWins = h.tricks.filter((t) => t.winner === T.PLAYER);
	const winningCard = (t: T.Trick) => t.plays.find((p) => p.seat === t.winner)!.card;
	const started = h.start[T.PLAYER];
	const excuseTrick = h.tricks.find((t) => t.plays.some((p) => p.seat === T.PLAYER && T.isExcuse(p.card)));
	return {
		taker,
		contract: h.contract!,
		made: o.made,
		margin: o.margin,
		won: taker ? o.made : !o.made,
		sidePoints: Math.round(sideHalf / 2),
		sideOudlers: (taker && h.contract !== 4 ? [...sideCards, ...h.aside] : sideCards).filter(T.isOudler).length,
		sideKings: (taker && h.contract !== 4 ? [...sideCards, ...h.aside] : sideCards).filter(T.isKing).length,
		tricks: myWins.length,
		trumpWins: myWins.filter((t) => t.led !== null && t.led !== T.TRUMPS && T.isTrump(winningCard(t))).length,
		wins21: myWins.filter((t) => { const c = winningCard(t); return T.isTrump(c) && c.rank === 21; }).length,
		petitAuBout: o.petitAuBout !== null && o.petitAuBout === T.sideOf(h, T.PLAYER),
		trumpsHeld: started.filter(T.isTrump).length,
		keptExcuse: !!excuseTrick && excuseTrick !== h.tricks.at(-1),
		dogOudler: taker && h.shownDog.some(T.isOudler),
		gamePoints: taker ? o.score * 3 : -o.score,
		handsThisBoard: run.module.handsPerBoard - run.handsLeft + 1
	};
}

const RELICS: RelicDef<TarotCtx>[] = [
	{ key: 'oudler_hunter', name: 'Oudler Hunter', rarity: 1, cost: 4, icon: 'crown_jewels', text: '+30 chips for each oudler your side ends with', score: (c) => (c.sideOudlers ? { chips: 30 * c.sideOudlers } : null) },
	{ key: 'kings_ransom', name: 'King’s Ransom', rarity: 1, cost: 4, icon: 'kings_ransom', text: '+15 chips for each king your side ends with', score: (c) => (c.sideKings ? { chips: 15 * c.sideKings } : null) },
	{ key: 'the_fool', name: 'The Fool', rarity: 1, cost: 4, icon: 'wildcard', text: '+40 chips when you hold the Excuse and keep it', score: (c) => (c.keptExcuse ? { chips: 40 } : null) },
	{ key: 'cutter', name: 'The Cutter', rarity: 1, cost: 5, icon: 'the_ruffer', text: '+12 chips for each trick you win by trumping a suit', score: (c) => (c.trumpWins ? { chips: 12 * c.trumpWins } : null) },
	{ key: 'point_man', name: 'Point Man', rarity: 1, cost: 5, icon: 'master_points', text: '+1 mult for every 10 points your side ends with', score: (c) => (c.sidePoints >= 10 ? { mult: Math.floor(c.sidePoints / 10) } : null) },
	{ key: 'twenty_one', name: 'The World', rarity: 2, cost: 6, icon: 'ace_of_spades', text: '+50 chips for each trick you win with the 21', score: (c) => (c.wins21 ? { chips: 50 * c.wins21 } : null) },
	{ key: 'bold_taker', name: 'Bold Taker', rarity: 2, cost: 6, icon: 'bold_bidding', text: '+2 mult on every hand you take', score: (c) => (c.taker ? { mult: 2 } : null) },
	{ key: 'poignee', name: 'Poignée', rarity: 2, cost: 6, icon: 'nine_card_fit', text: '+3 mult when you hold ten or more trumps', score: (c) => (c.trumpsHeld >= 10 ? { mult: 3 } : null) },
	{ key: 'bodyguard', name: 'Bodyguard', rarity: 2, cost: 6, icon: 'bodyguard', text: '+0.5 mult for each trick you win as a defender', score: (c) => (!c.taker && c.tricks ? { mult: 0.5 * c.tricks } : null) },
	{ key: 'dog_days', name: 'Dog Days', rarity: 2, cost: 5, icon: 'gallery', text: '+40 chips when the dog you take holds an oudler', score: (c) => (c.dogOudler ? { chips: 40 } : null) },
	{ key: 'squeaker', name: 'Squeaker', rarity: 2, cost: 7, icon: 'safety_net', text: 'x2 mult when your side wins by 3 points or fewer', score: (c) => (c.won && c.margin <= 3 ? { xmult: 2 } : null) },
	{ key: 'petit_au_bout', name: 'Petit au Bout', rarity: 3, cost: 8, icon: 'endplay', text: 'x2 mult when your side takes the last trick with the Petit', score: (c) => (c.petitAuBout ? { xmult: 2 } : null) },
	{ key: 'high_guard', name: 'High Guard', rarity: 3, cost: 9, icon: 'high_stakes', text: 'x1.5 mult when you make a Garde sans or Garde contre', score: (c) => (c.taker && c.made && c.contract >= 3 ? { xmult: 1.5 } : null) }
];

const UPGRADES: UpgradeDef[] = [
	{ key: 'taker', name: 'Taker', icon: 'bold_bidding', text: 'Level up hands where you take and make it', chips: 25, mult: 0.6 },
	{ key: 'set', name: 'Set', icon: 'the_squeeze', text: 'Level up hands where you defend and set the taker', chips: 30, mult: 0.8 },
	{ key: 'petit', name: 'Petit', icon: 'endplay', text: 'Level up hands where your side brings the Petit home last', chips: 40, mult: 1 }
];

export const tarot: GameModule<TarotHand, TarotAction, TarotCtx> = {
	id: 'tarot',
	title: 'Petit au Bout',
	tagline: 'a French Tarot roguelike',
	words: { table: 'Table', hand: 'hand', hands: 'hands', chips: 'chips', pre: 'Bid' },
	tables: 8,
	boardsPerTable: 3,
	handsPerBoard: 3,
	startMoney: 6,
	goal: goals(TABLE_BASE, BOARD_SCALE),
	boardName: (run) => (run.board === 3 ? 'Grand Board' : `Board ${run.board}`),
	deal(run) {
		newDeal(run);
		runBids(run);
		return { hand: run.hand, phase: run.phase === R.PHASE.PRE ? 'pre' : 'play' };
	},
	act(run, a, opts) {
		const h = run.hand;
		const stepwise = !!opts?.stepwise;
		if (a.t === 'bid') {
			if (run.phase !== R.PHASE.PRE || h.stage !== 'bid' || h.turn !== T.PLAYER) throw new Error('tarot: not your bid');
			T.bid(h, T.PLAYER, a.bid);
			runBids(run, stepwise);
		} else if (a.t === 'aside') {
			if (h.stage !== 'dog' || h.taker !== T.PLAYER) throw new Error('tarot: nothing to set aside');
			const hand = h.hands[T.PLAYER];
			const picked = a.cards.map((code) => {
				const c = findCard(hand, code);
				if (!c) throw new Error('tarot: not your card');
				return c;
			});
			T.setAside(h, picked);
			runBids(run, stepwise);
		} else if (a.t === 'play') {
			if (h.stage !== 'play' || h.turn !== T.PLAYER) throw new Error('tarot: not your turn');
			const card = findCard(h.hands[T.PLAYER], a.card);
			if (!card) throw new Error('tarot: not your card');
			T.play(h, T.PLAYER, card);
			if (!stepwise) runPlay(run);
		} else {
			while (!h.complete) T.play(h, h.turn, ai.chooseCard(h, h.turn));
		}
	},
	redeal(run) {
		run.ext.dealer = cards.EAST;
		return tarot.deal(run);
	},
	handOver: (run) => run.hand.complete,
	untouched: (run) => run.hand.tricks.length === 0,
	settled(run) {
		const h = run.hand as TarotHand;
		if (h.stage !== 'play' || h.complete || h.tricks.length === 0) return false;
		const ours = (s: TarotHand) => (x: number) => T.sideOf(s, x) === T.sideOf(s, T.PLAYER);
		return settled(h, {
			clone: (s) => ({ ...s, hands: s.hands.map((x) => x.slice()), trick: s.trick.slice(), tricks: s.tricks.slice(), won: s.won.map((x) => x.slice()) }),
			over: (s) => s.complete,
			turn: (s) => s.turn,
			legal: (s, seat) => T.legalPlays(s, seat),
			play: (s, seat, c) => void T.play(s, seat, c),
			outcome: (s) => {
				const o = T.outcome(s);
				return `${o.takerHalf}|${o.petitAuBout}|${s.tricks.filter((t) => t.winner === T.PLAYER).length}|${fateOfMine(s.tricks, (x) => x === T.PLAYER, ours(s))}`;
			}
		});
	},
	aiToMove: (run) => run.hand.stage === 'play' && !run.hand.complete && run.hand.turn !== T.PLAYER,
	stepAI: (run) => (T.play(run.hand, run.hand.turn, ai.chooseCard(run.hand, run.hand.turn)) ? 'trick' : 'card'),
	score(run) {
		const c = ctx(run);
		const h = run.hand;
		const bidName = T.BIDS[c.contract - 1].name;
		const lines: Line[] = [];
		const levels: string[] = [];
		if (c.taker && !c.made) {
			return { title: `Down by ${c.margin}`, made: false, lines: [{ label: `${bidName}: ${c.sidePoints} of ${T.NEEDED[c.sideOudlers]} points`, chips: 0 }], ctx: c, levels, detail: c.gamePoints };
		}
		lines.push({ label: `${c.sidePoints} card points for your side`, chips: 2 * c.sidePoints });
		let title: string;
		if (c.taker) {
			title = `Made ${bidName}`;
			lines.push({ label: `Made by ${c.margin}`, chips: 40 + 6 * c.margin });
			levels.push('taker');
			run.ext.takes = (run.ext.takes ?? 0) + 1;
		} else if (!c.made) {
			title = 'You set the taker!';
			lines.push({ label: `${ai.seatName(h.taker!)} down by ${c.margin}`, chips: 40 + 6 * c.margin });
			levels.push('set');
			run.ext.sets = (run.ext.sets ?? 0) + 1;
		} else title = `${ai.seatName(h.taker!)} made ${bidName}`;
		if (c.won && CONTRACT_X[c.contract] > 1) lines.push({ label: bidName, xmult: CONTRACT_X[c.contract] });
		if (c.petitAuBout) {
			lines.push({ label: 'Petit au bout', chips: 40 });
			levels.push('petit');
		}
		const handful = c.trumpsHeld >= 15 ? 40 : c.trumpsHeld >= 13 ? 30 : c.trumpsHeld >= 10 ? 20 : 0;
		if (handful) lines.push({ label: `Poignée: ${c.trumpsHeld} trumps`, chips: handful });
		const ours = (s: number) => T.sideOf(h, s) === T.sideOf(h, T.PLAYER);
		const played = playedCards(h.tricks, (s) => s === T.PLAYER, ours);
		return { title, made: true, lines, ctx: c, levels, played, detail: c.gamePoints };
	},
	newPack: T.newDeck,
	relics: RELICS,
	upgrades: UPGRADES,
	bosses: [
		{ key: 'cold_deck', name: 'The Cold Deck', text: 'x0.75 mult on every hand', tier: 1, score: () => ({ label: 'The Cold Deck', xmult: 0.75 }) },
		{ key: 'kingslayer', name: 'The Kingslayer', text: '-20 chips for each king your side ends with', tier: 1, score: (c) => (c.sideKings ? { label: 'The Kingslayer', chips: -20 * c.sideKings } : null) },
		{ key: 'short_table', name: 'The Short Table', text: 'Only two hands on this board', tier: 2, hands: 2 },
		{ key: 'usurer', name: 'The Usurer', text: 'Hands you defend score half', tier: 2, score: (c) => (!c.taker ? { label: 'The Usurer: defending', xmult: 0.5 } : null) },
		{ key: 'the_guard', name: 'The Guard', text: 'x0.6 mult unless the contract is a Garde or better', tier: 3, score: (c) => (c.contract < 2 ? { label: 'The Guard', xmult: 0.6 } : null) }
	],
	counters: (run) => ({ takes: run.ext.takes ?? 0, sets: run.ext.sets ?? 0 }),
	counterNames: { takes: 'Contracts made', sets: 'Takers set' },
	describeHand(run) {
		const h = run.hand;
		const o = T.outcome(h);
		return `${ai.seatName(h.taker!)} took a ${T.BIDS[h.contract! - 1].name} · ${o.made ? 'made' : 'down'} by ${o.margin}`;
	},
	bot(run, rng) {
		const h = run.hand;
		if (run.phase === R.PHASE.PRE) {
			if (h.stage === 'dog') return { t: 'aside', cards: ai.chooseAside(h.hands[T.PLAYER]).map(cards.code) };
			return { t: 'bid', bid: ai.chooseBid(h, T.PLAYER, rng.next() < 0.3 ? 4 : 0) };
		}
		return { t: 'play', card: cards.code(ai.chooseCard(h, T.PLAYER)) };
	}
};
