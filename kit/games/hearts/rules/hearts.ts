// The rules of Hearts: passing, legal plays, tricks and points.
//
// Four players, no partners. You sit South. Each hand: everyone passes three
// cards (left, right, across, or not at all, in rotation), the lowest club
// leads (normally the two), players follow suit if they can, and the
// highest card of the led suit wins the trick. Every heart taken costs a
// point and the queen of spades costs thirteen, unless one player takes
// every point: shooting the moon.
//
// The pack can change over a run (cards burned, copied, promoted, recolored),
// so nothing here assumes a standard 52: hands are the pack split four ways,
// any leftover cards form a kitty that goes to the winner of the first trick
// (a real Hearts variant), and the moon means taking every point in the pack.
//
// Standard rules otherwise: no points on the first trick unless a hand holds
// nothing else, and hearts can't be led until they're broken: by a heart
// being played, or by someone taking the queen of spades (a common house
// rule), or when the leader holds only hearts.

import * as cards from '../../../src/core/rules/cards.ts';
import type { Card, Hand, Hands } from '../../../src/core/rules/cards.ts';
import type { RNG } from '../../../src/core/rules/rng.ts';

export const { CLUBS, DIAMONDS, HEARTS, SPADES, NORTH, EAST, SOUTH, WEST } = cards;

/** Seat names for Hearts (no dummy, no partners). You are South. */
export const SEAT_NAMES: Record<number, string> = { 1: 'North', 2: 'East', 3: 'South', 4: 'West' };
export const PLAYER = cards.SOUTH;

/** Points in a standard pack. */
export const TOTAL_POINTS = 26;

export type PassDir = 'left' | 'right' | 'across' | 'hold';
export const PASS_ROTATION: PassDir[] = ['left', 'right', 'across', 'hold'];

/** How many points a card carries. Seals can change this; see game/seals.ts. */
export type PointsFn = (c: Card) => number;

export function isQueenOfSpades(c: Card): boolean {
	return c.suit === SPADES && c.rank === 12;
}

/** Penalty points a card carries under the standard rules. */
export function points(c: Card): number {
	if (c.suit === HEARTS) return 1;
	if (isQueenOfSpades(c)) return 13;
	return 0;
}

export function pointsIn(list: Card[], pts: PointsFn = points): number {
	let n = 0;
	for (const c of list) n += pts(c);
	return n;
}

/** Who receives a seat's passed cards. Seats run clockwise N, E, S, W. */
export function passTarget(seat: number, dir: PassDir): number {
	if (dir === 'left') return cards.nextSeat(seat);
	if (dir === 'across') return cards.partner(seat);
	if (dir === 'right') return cards.nextSeat(cards.nextSeat(cards.nextSeat(seat)));
	return seat;
}

/** Who passes to a seat in a given direction. */
export function passSource(seat: number, dir: PassDir): number {
	const opposite: Record<PassDir, PassDir> = { left: 'right', right: 'left', across: 'across', hold: 'hold' };
	return passTarget(seat, opposite[dir]);
}

/**
 * Deal a pack: shuffle it, give each seat an equal share, and leave any
 * remainder as the kitty. Every deal gets fresh card objects carrying the
 * pack card's id, so a card can be tracked across a hand.
 */
export function dealPack(rng: RNG, pack: Card[]): { hands: Hands; kitty: Card[] } {
	const deck = rng.shuffle(pack.map((c) => ({ suit: c.suit, rank: c.rank, id: c.id })));
	const per = Math.floor(deck.length / 4);
	const hands: Hands = [[], [], [], [], []];
	let i = 0;
	for (let seat = 1; seat <= 4; seat++) {
		for (let n = 0; n < per; n++) hands[seat].push(deck[i++]);
		cards.sortHand(hands[seat]);
	}
	return { hands, kitty: deck.slice(i) };
}

/**
 * Exchange the passed cards. `passes[seat]` is the cards that seat gives
 * away. Returns, for each seat, the cards it received.
 */
export function applyPasses(hands: Hands, passes: Card[][], dir: PassDir): Card[][] {
	const received: Card[][] = [[], [], [], [], []];
	if (dir === 'hold') return received;
	for (let seat = 1; seat <= 4; seat++) {
		for (const c of passes[seat]) {
			if (!cards.removeCard(hands[seat], c)) throw new Error('pass: card not in hand');
		}
	}
	for (let seat = 1; seat <= 4; seat++) {
		const to = passTarget(seat, dir);
		for (const c of passes[seat]) {
			hands[to].push(c);
			received[to].push(c);
		}
	}
	for (let seat = 1; seat <= 4; seat++) cards.sortHand(hands[seat]);
	return received;
}

export interface Played {
	seat: number;
	card: Card;
}

export interface Trick {
	index: number;
	leader: number;
	ledSuit: number;
	plays: Played[];
	winner: number;
	winningCard: Card;
	/** Points in the trick (including the kitty, on the first trick). */
	points: number;
	/** The kitty, which goes with the first trick. */
	kitty: Card[];
}

export interface HandState {
	hands: Hands;
	turn: number;
	leader: number;
	trick: Played[];
	ledSuit: number | null;
	tricks: Trick[];
	heartsBroken: boolean;
	/** Cards each seat has won. */
	taken: Card[][];
	/** Revealed voids, per seat then suit, for the AI. */
	voids: Record<number, boolean>[];
	played: Played[];
	complete: boolean;
	/** Tricks in this hand (the hand size). */
	handSize: number;
	/** Face-down leftovers, won with the first trick. */
	kitty: Card[];
	/** The card that must open the hand. */
	firstLead: Card;
	/** Every card in play this hand (hands plus kitty), for counting. */
	pack: Card[];
	/** Points per card for this hand. */
	pts: PointsFn;
	/** Total points in the pack. */
	totalPoints: number;
	/** A seat whose first cards of the hand may ignore follow-suit (a relic),
	 *  and how many of those cards are left. */
	wildSeat?: number;
	wildLeft?: number;
	/** Seats going for the moon this hand (opponents with a strong hand). */
	moonSeats?: number[];
}

/** The card that opens the hand: the lowest club, else the lowest card. */
export function firstLeadCard(hands: Hands): { seat: number; card: Card } {
	let best: { seat: number; card: Card } | null = null;
	const better = (c: Card, b: Card) => {
		const cc = c.suit === CLUBS,
			bc = b.suit === CLUBS;
		if (cc !== bc) return cc;
		if (c.rank !== b.rank) return c.rank < b.rank;
		return c.suit < b.suit;
	};
	for (let seat = 1; seat <= 4; seat++) {
		for (const c of hands[seat]) if (!best || better(c, best.card)) best = { seat, card: c };
	}
	if (!best) throw new Error('no cards dealt');
	return best;
}

export function newHand(hands: Hands, opts: { kitty?: Card[]; pts?: PointsFn } = {}): HandState {
	const kitty = opts.kitty ?? [];
	const pts = opts.pts ?? points;
	const first = firstLeadCard(hands);
	const copy: Hands = [[], ...[1, 2, 3, 4].map((s) => cards.copyHand(hands[s]))];
	const pack = [...copy.slice(1).flat(), ...kitty];
	return {
		hands: copy,
		turn: first.seat,
		leader: first.seat,
		trick: [],
		ledSuit: null,
		tricks: [],
		heartsBroken: false,
		taken: [[], [], [], [], []],
		voids: [{}, {}, {}, {}, {}],
		played: [],
		complete: false,
		handSize: copy[1].length,
		kitty: kitty.slice(),
		firstLead: first.card,
		pack,
		pts,
		totalPoints: pointsIn(pack, pts)
	};
}

/** Cards a seat may play now. */
export function legalPlays(state: HandState, seat: number): Card[] {
	const hand = state.hands[seat];
	const firstTrick = state.tricks.length === 0;
	if (state.trick.length === 0) {
		// Leading.
		if (firstTrick && hand.includes(state.firstLead)) return [state.firstLead];
		if (!state.heartsBroken) {
			const nonHearts = hand.filter((c) => c.suit !== HEARTS);
			if (nonHearts.length > 0) return nonHearts;
		}
		return hand.slice();
	}
	// Wildcard: this seat's first card of the hand may be anything.
	if (state.wildSeat === seat && (state.wildLeft ?? 0) > 0) return hand.slice();
	const suited = cards.cardsOfSuit(hand, state.ledSuit!);
	if (suited.length > 0) return suited;
	if (firstTrick) {
		// No points on the first trick, unless there's nothing else to throw.
		const clean = hand.filter((c) => state.pts(c) <= 0);
		if (clean.length > 0) return clean;
	}
	return hand.slice();
}

export function isLegal(state: HandState, seat: number, card: Card): boolean {
	return legalPlays(state, seat).includes(card);
}

/** Highest card of the led suit wins; there are no trumps. Ties go to the first played. */
export function trickWinner(trick: Played[]): Played {
	const led = trick[0].card.suit;
	let best = trick[0];
	for (const p of trick) if (p.card.suit === led && p.card.rank > best.card.rank) best = p;
	return best;
}

/** Play a card. Returns the completed trick when the fourth card lands. */
export function play(state: HandState, seat: number, card: Card): Trick | null {
	if (state.complete) throw new Error('play: hand is over');
	if (seat !== state.turn) throw new Error("play: not this seat's turn");
	if (!isLegal(state, seat, card)) throw new Error('play: illegal card');

	// A wildcard play off-suit says nothing about voids.
	const wild = state.wildSeat === seat && (state.wildLeft ?? 0) > 0;
	if (wild) state.wildLeft = state.wildLeft! - 1;
	if (state.ledSuit && card.suit !== state.ledSuit && !wild) state.voids[seat][state.ledSuit] = true;
	cards.removeCard(state.hands[seat], card);
	state.trick.push({ seat, card });
	state.played.push({ seat, card });
	if (state.trick.length === 1) state.ledSuit = card.suit;
	if (card.suit === HEARTS) state.heartsBroken = true;

	if (state.trick.length < 4) {
		state.turn = cards.nextSeat(seat);
		return null;
	}
	const win = trickWinner(state.trick);
	const kitty = state.tricks.length === 0 ? state.kitty : [];
	const done: Trick = {
		index: state.tricks.length + 1,
		leader: state.leader,
		ledSuit: state.trick[0].card.suit,
		plays: state.trick,
		winner: win.seat,
		winningCard: win.card,
		points: pointsIn(state.trick.map((p) => p.card), state.pts) + pointsIn(kitty, state.pts),
		kitty
	};
	state.tricks.push(done);
	// Taking the queen of spades breaks hearts.
	if (state.trick.some((p) => isQueenOfSpades(p.card))) state.heartsBroken = true;
	for (const p of state.trick) state.taken[win.seat].push(p.card);
	for (const c of kitty) state.taken[win.seat].push(c);
	state.trick = [];
	state.ledSuit = null;
	state.leader = win.seat;
	state.turn = win.seat;
	if (state.tricks.length >= state.handSize) state.complete = true;
	return done;
}

/** Points each seat took this hand (raw, before any moon rule). */
export function pointsTaken(state: HandState): number[] {
	return [0, 1, 2, 3, 4].map((s) => (s === 0 ? 0 : pointsIn(state.taken[s], state.pts)));
}

/** Points in the pack from cards worth something (a card can be worth less
 *  than nothing under a house rule; the moon ignores those). */
export function positiveTotal(state: HandState): number {
	let n = 0;
	for (const c of state.pack) n += Math.max(0, state.pts(c));
	return n;
}

/** The seat that took every point in the pack, if any. Cards worth less
 *  than nothing don't count either way. With standard points this is the
 *  same as comparing points taken to the pack's total. */
export function moonShooter(state: HandState): number | null {
	const total = positiveTotal(state);
	if (total <= 0) return null;
	for (let s = 1; s <= 4; s++) {
		let n = 0;
		for (const c of state.taken[s]) n += Math.max(0, state.pts(c));
		if (n === total) return s;
	}
	return null;
}

/** The seat that has taken every point so far, if any points have been
 *  taken and that seat holds all of them (a moon still in reach). */
export function moonOnCourse(state: HandState): number | null {
	const pts = pointsTaken(state);
	const total = pts.reduce((a, b) => a + b, 0);
	if (total <= 0) return null;
	for (let s = 1; s <= 4; s++) if (pts[s] === total) return s;
	return null;
}

/** Highest rank of a suit some other seat might still hold, from one seat's view. */
export function highestOutstanding(state: HandState, suit: number, known: Hand): number | null {
	const left = new Map<number, number>();
	for (const c of state.pack) if (c.suit === suit) left.set(c.rank, (left.get(c.rank) ?? 0) + 1);
	const seen = [...state.played.map((p) => p.card), ...state.trick.map((p) => p.card), ...known];
	for (const c of seen) if (c.suit === suit && left.has(c.rank)) left.set(c.rank, left.get(c.rank)! - 1);
	for (let r = 14; r >= 2; r--) if ((left.get(r) ?? 0) > 0) return r;
	return null;
}

/** How many queens of spades are still unseen from one seat's view. */
export function queensOutstanding(state: HandState, known: Hand): number {
	let n = state.pack.filter(isQueenOfSpades).length;
	n -= state.played.filter((p) => isQueenOfSpades(p.card)).length;
	n -= known.filter(isQueenOfSpades).length;
	return Math.max(0, n);
}

/** Have all the queens of spades been played? */
export function queenGone(state: HandState): boolean {
	return state.played.filter((p) => isQueenOfSpades(p.card)).length >= state.pack.filter(isQueenOfSpades).length;
}
