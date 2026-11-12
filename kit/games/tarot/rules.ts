// French Tarot, four players: 78 cards (four suits of fourteen: 1-10, jack,
// knight, queen, king; 21 trumps; the Excuse). Eighteen cards each, six to
// the dog. One round of bids, each higher than the last or a pass: Prise,
// Garde, Garde sans (the dog unseen but the taker's), Garde contre (the dog
// goes to the defenders). The taker plays alone against the other three.
// After a Prise or Garde the taker takes the dog and sets six cards aside
// (no kings, no oudlers, trumps only if nothing else will do).
//
// Play: follow suit; if you can't, you must trump, and over-trump if you
// can; with no trumps, play anything. When trumps are led you must go
// higher if you can. The Excuse may be played at any time: it never wins,
// and goes back to its owner's side, who give a low card for it.
//
// Points: oudlers (trump 1, trump 21, the Excuse) and kings 4.5, queens 3.5,
// knights 2.5, jacks 1.5, everything else 0.5; 91 in all. The taker needs
// 56 with no oudlers, 51 with one, 41 with two, 36 with three. All points
// here are kept in half-points (182 in all) so the arithmetic stays exact.

import * as cards from '../../src/core/rules/cards.ts';
import type { Card, Hands } from '../../src/core/rules/cards.ts';
import type { RNG } from '../../src/core/rules/rng.ts';

export const TRUMPS = cards.TRUMPS;
export const KNIGHT = cards.KNIGHT;
export const PLAYER = cards.SOUTH;
export const SEAT_NAMES: Record<number, string> = { 1: 'North', 2: 'East', 3: 'South', 4: 'West' };
export const HAND_SIZE = 18;
export const DOG_SIZE = 6;

/** The bids, low to high, and what each multiplies the score by. */
export const BIDS = [
	{ key: 'prise', name: 'Prise', mult: 1 },
	{ key: 'garde', name: 'Garde', mult: 2 },
	{ key: 'sans', name: 'Garde sans', mult: 4 },
	{ key: 'contre', name: 'Garde contre', mult: 6 }
] as const;
/** A bid is its index in BIDS plus one (0: no bid yet). */
export type Bid = 1 | 2 | 3 | 4;

export const isTrump = (c: Card) => c.suit === TRUMPS && c.rank > 0;
export const isExcuse = (c: Card) => c.suit === TRUMPS && c.rank === 0;
export const isOudler = (c: Card) => c.suit === TRUMPS && (c.rank === 0 || c.rank === 1 || c.rank === 21);
export const isPetit = (c: Card) => c.suit === TRUMPS && c.rank === 1;
export const isKing = (c: Card) => c.suit !== TRUMPS && c.rank === 13;

/** A card's points, in half-points. */
export function halfPoints(c: Card): number {
	if (isOudler(c) || isKing(c)) return 9;
	if (c.suit === TRUMPS) return 1;
	if (c.rank === 12) return 7;
	if (c.rank === KNIGHT) return 5;
	if (c.rank === 11) return 3;
	return 1;
}
export const halfPointsIn = (list: Card[]) => list.reduce((n, c) => n + halfPoints(c), 0);

/** Order within a suit: 1-10, jack, knight, queen, king. */
export function order(c: Card): number {
	if (c.suit === TRUMPS) return c.rank;
	return c.rank === KNIGHT ? 12 : c.rank === 12 ? 13 : c.rank === 13 ? 14 : c.rank;
}

/** Points the taker needs, by how many oudlers they end with. */
export const NEEDED = [56, 51, 41, 36];

export function newDeck(): Card[] {
	const out: Card[] = [];
	for (let s = 1; s <= 4; s++) for (const r of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, KNIGHT, 12, 13]) out.push(cards.card(s, r));
	for (let r = 0; r <= 21; r++) out.push(cards.card(TRUMPS, r));
	return out;
}

export interface Played {
	seat: number;
	card: Card;
}

export interface Trick {
	plays: Played[];
	leader: number;
	winner: number;
	/** The suit that had to be followed (the first card that wasn't the Excuse). */
	led: number | null;
}

export interface TarotHand {
	dealer: number;
	hands: Hands;
	dog: Card[];
	/** Who speaks, in the bidding; then who plays. */
	turn: number;
	bids: { seat: number; bid: Bid | 0 }[];
	/** 'bid' while bidding, 'dog' while the taker sets cards aside, then 'play'. */
	stage: 'bid' | 'dog' | 'play';
	taker: number | null;
	contract: Bid | null;
	/** The cards the taker set aside (or the dog, unseen, in a Garde sans). */
	aside: Card[];
	/** The dog, face up, as it was shown (Prise and Garde). */
	shownDog: Card[];
	/** What each seat held once play began. */
	start: Hands;
	leader: number;
	trick: Played[];
	tricks: Trick[];
	/** Cards each seat won (the Excuse already sent home). */
	won: Card[][];
	complete: boolean;
}

export function deal(rng: RNG, dealer: number, pack: Card[] = newDeck()): TarotHand {
	const deck = rng.shuffle(pack.slice());
	const hands: Hands = [[], [], [], [], []];
	let k = 0;
	for (let i = 0; i < HAND_SIZE; i++) for (let s = 1; s <= 4; s++) hands[s].push(deck[k++]);
	return {
		dealer,
		hands,
		dog: deck.slice(k, k + DOG_SIZE),
		turn: cards.nextSeat(dealer),
		bids: [],
		stage: 'bid',
		taker: null,
		contract: null,
		aside: [],
		shownDog: [],
		start: [[], [], [], [], []],
		leader: cards.nextSeat(dealer),
		trick: [],
		tricks: [],
		won: [[], [], [], [], []],
		complete: false
	};
}

/** The highest bid so far (0: none). */
export const highBid = (h: TarotHand): Bid | 0 => h.bids.reduce<Bid | 0>((m, b) => (b.bid > m ? b.bid : m), 0);

/** A seat bids (higher than the last) or passes (0). After four, the
 *  highest bidder takes; if all pass, nobody does (the hand is redealt). */
export function bid(h: TarotHand, seat: number, b: Bid | 0) {
	if (h.stage !== 'bid' || seat !== h.turn) throw new Error('tarot: not that seat’s bid');
	if (b && b <= highBid(h)) throw new Error('tarot: bid higher or pass');
	h.bids.push({ seat, bid: b });
	h.turn = cards.nextSeat(seat);
	if (h.bids.length < 4) return;
	const top = highBid(h);
	if (!top) return; // all passed
	const win = h.bids.find((x) => x.bid === top)!;
	h.taker = win.seat;
	h.contract = top;
	if (top <= 2) {
		// The dog is shown and goes to the taker, who sets six aside.
		h.shownDog = h.dog.slice();
		h.hands[win.seat].push(...h.dog);
		h.dog = [];
		h.stage = 'dog';
		h.turn = win.seat;
	} else {
		// Garde sans: the dog is the taker's, unseen. Garde contre: the defenders'.
		h.aside = h.dog;
		h.dog = [];
		startPlay(h);
	}
}

export const allPassed = (h: TarotHand) => h.stage === 'bid' && h.bids.length >= 4 && !highBid(h);

/** May this card be set aside? Never kings or oudlers; trumps only if the
 *  taker has nothing else left to set aside. */
export function canSetAside(hand: Card[], c: Card, chosen: Card[] = []): boolean {
	if (isKing(c) || isOudler(c)) return false;
	if (!isTrump(c)) return true;
	const plain = hand.filter((x) => !isTrump(x) && !isKing(x) && !isOudler(x) && !chosen.includes(x));
	return plain.length === 0;
}

/** The taker sets six cards aside; play begins. */
export function setAside(h: TarotHand, picked: Card[]) {
	if (h.stage !== 'dog' || h.taker === null) throw new Error('tarot: nothing to set aside now');
	if (picked.length !== DOG_SIZE) throw new Error('tarot: set aside exactly six');
	const hand = h.hands[h.taker];
	const chosen: Card[] = [];
	for (const c of picked) {
		if (!hand.includes(c)) throw new Error('tarot: not in your hand');
		if (!canSetAside(hand, c, chosen)) throw new Error(`tarot: you can't set aside ${cards.name(c)}`);
		chosen.push(c);
	}
	for (const c of chosen) hand.splice(hand.indexOf(c), 1);
	h.aside = chosen;
	startPlay(h);
}

function startPlay(h: TarotHand) {
	h.stage = 'play';
	for (let s = 1; s <= 4; s++) h.start[s] = h.hands[s].slice();
	h.leader = cards.nextSeat(h.dealer);
	h.turn = h.leader;
}

/** The suit to follow in the current trick (null: anything goes). */
export function ledSuit(trick: Played[]): number | null {
	const first = trick.find((p) => !isExcuse(p.card));
	return first ? first.card.suit : null;
}

/** The highest trump played to a trick so far (0: none). */
const topTrump = (trick: Played[]) => trick.reduce((m, p) => (isTrump(p.card) ? Math.max(m, p.card.rank) : m), 0);

export function legalPlays(h: TarotHand, seat: number): Card[] {
	const hand = h.hands[seat];
	const led = ledSuit(h.trick);
	if (led === null) return hand.slice();
	const excuse = hand.filter(isExcuse);
	const trumpsOver = (trumps: Card[]) => {
		const top = topTrump(h.trick);
		const over = trumps.filter((c) => c.rank > top);
		return over.length ? over : trumps;
	};
	const trumps = hand.filter(isTrump);
	if (led === TRUMPS) {
		if (trumps.length) return [...trumpsOver(trumps), ...excuse];
		return hand.slice();
	}
	const follow = hand.filter((c) => c.suit === led);
	if (follow.length) return [...follow, ...excuse];
	if (trumps.length) return [...trumpsOver(trumps), ...excuse];
	return hand.slice();
}

/** Who wins a full trick: the highest trump, else the highest card of the
 *  suit led. The Excuse never wins (a trick of only the Excuse can't happen). */
export function trickWinner(trick: Played[]): Played {
	const led = ledSuit(trick);
	let best: Played | null = null;
	for (const p of trick) {
		if (isExcuse(p.card)) continue;
		const beats = (a: Card, b: Card) => (isTrump(a) ? !isTrump(b) || a.rank > b.rank : !isTrump(b) && a.suit === led && (b.suit !== led || order(a) > order(b)));
		if (!best || beats(p.card, best.card)) best = p;
	}
	return best ?? trick[0];
}

export const sideOf = (h: TarotHand, seat: number) => (seat === h.taker ? 'taker' : 'defence');

export function play(h: TarotHand, seat: number, card: Card): Trick | null {
	if (h.stage !== 'play' || h.complete) throw new Error('tarot: not playing');
	if (seat !== h.turn) throw new Error("tarot: not that seat's turn");
	if (!legalPlays(h, seat).includes(card)) throw new Error(`tarot: can't play ${cards.name(card)} now`);
	const hand = h.hands[seat];
	hand.splice(hand.indexOf(card), 1);
	h.trick.push({ seat, card });
	if (h.trick.length < 4) {
		h.turn = cards.nextSeat(seat);
		return null;
	}
	const win = trickWinner(h.trick);
	const t: Trick = { plays: h.trick, leader: h.trick[0].seat, winner: win.seat, led: ledSuit(h.trick) };
	h.tricks.push(t);
	const last = h.tricks.length === HAND_SIZE;
	for (const p of h.trick) {
		// The Excuse goes back to its owner's side (except on the last trick,
		// where it's lost to whoever wins it).
		if (isExcuse(p.card) && !last && sideOf(h, p.seat) !== sideOf(h, win.seat)) h.won[p.seat].push(p.card);
		else h.won[win.seat].push(p.card);
	}
	h.trick = [];
	h.leader = h.turn = win.seat;
	if (last) h.complete = true;
	return t;
}

/** The finished hand by the real rules. */
export interface Outcome {
	/** The taker's points (half-points), oudlers, and what they needed. */
	takerHalf: number;
	oudlers: number;
	needed: number;
	made: boolean;
	/** By how much (in points, rounded toward the taker... as the rules do: halves round up for the taker). */
	margin: number;
	/** Petit au bout: the side that took the last trick with the Petit in it, if any. */
	petitAuBout: 'taker' | 'defence' | null;
	/** Points each defender pays or is paid, before the taker's x3: positive when the taker made. */
	score: number;
}

export function outcome(h: TarotHand): Outcome {
	const taker = h.taker!;
	const contre = h.contract === 4;
	const takerCards = [...h.won[taker], ...(contre ? [] : h.aside)];
	let takerHalf = halfPointsIn(takerCards);
	// The Excuse sent home owes a low card: half a point to the trick's winner.
	for (const t of h.tricks.slice(0, -1)) {
		const ex = t.plays.find((p) => isExcuse(p.card));
		if (!ex || sideOf(h, ex.seat) === sideOf(h, t.winner)) continue;
		takerHalf += sideOf(h, ex.seat) === 'taker' ? -1 : 1;
	}
	const oudlers = takerCards.filter(isOudler).length;
	const needed = NEEDED[oudlers];
	const diff = takerHalf / 2 - needed;
	const made = diff >= 0;
	const margin = Math.ceil(Math.abs(diff));
	const lastT = h.tricks.at(-1)!;
	const petitLast = lastT.plays.some((p) => isPetit(p.card));
	const petitAuBout = petitLast ? sideOf(h, lastT.winner) : null;
	const mult = BIDS[h.contract! - 1].mult;
	const petit = petitAuBout ? (petitAuBout === 'taker' ? 10 : -10) * mult : 0;
	const base = (25 + margin) * mult * (made ? 1 : -1);
	return { takerHalf, oudlers, needed, made, margin, petitAuBout, score: base + petit };
}

/** Points (half-points) a seat took in tricks so far. */
export const halfTaken = (h: TarotHand, seat: number) => halfPointsIn(h.won[seat]);
