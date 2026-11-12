// Whist 22: the twenty-one Tarot trumps and the Fool, no suits. With four
// players, rounds deal 5, 4, 3, 2, 1, then 2, 3, 4, 5 cards each (two cards
// stay out of a five-card round). Starting left of the dealer, everyone bids
// exactly how many tricks they'll take; the dealer bids last and may not make
// the bids add up to the cards dealt, so someone must miss. The highest card
// takes the trick (no suits, nothing to follow); the Fool counts 0 or 22, as
// its player says when playing it. In the one-card round you hold your card
// to your forehead: you see everyone's but your own.

import * as cards from '../../src/core/rules/cards.ts';
import type { Card, Hands } from '../../src/core/rules/cards.ts';
import type { RNG } from '../../src/core/rules/rng.ts';

export const PLAYER = cards.SOUTH;
/** The round sizes, in order, over and over. */
export const ROUNDS = [5, 4, 3, 2, 1, 2, 3, 4, 5];

export const isFool = (c: Card) => c.suit === cards.TRUMPS && c.rank === 0;

export function newDeck(): Card[] {
	const out: Card[] = [];
	for (let r = 0; r <= 21; r++) out.push(cards.card(cards.TRUMPS, r));
	return out;
}

export interface Played {
	seat: number;
	card: Card;
	/** What it counts for (the Fool: 0 or 22, as declared). */
	value: number;
}

export interface Trick {
	plays: Played[];
	winner: number;
}

export interface WhistHand {
	size: number;
	dealer: number;
	hands: Hands;
	/** Bids by seat (null: not yet). */
	bids: (number | null)[];
	stage: 'bid' | 'play';
	turn: number;
	leader: number;
	trick: Played[];
	tricks: Trick[];
	/** Tricks each seat has taken. */
	won: number[];
	complete: boolean;
	/** The one-card round: you can't see your own card. */
	blind: boolean;
	/** A seat the dealer rule doesn't bind this round (the Loophole ploy). */
	loophole?: number;
}

export function deal(rng: RNG, dealer: number, size: number, pack: Card[] = newDeck()): WhistHand {
	const deck = rng.shuffle(pack.slice());
	const hands: Hands = [[], [], [], [], []];
	let k = 0;
	for (let i = 0; i < size; i++) for (let s = 1; s <= 4; s++) hands[s].push(deck[k++]);
	const first = cards.nextSeat(dealer);
	return { size, dealer, hands, bids: [null, null, null, null, null], stage: 'bid', turn: first, leader: first, trick: [], tricks: [], won: [0, 0, 0, 0, 0], complete: false, blind: size === 1 };
}

/** Bids made so far, added up. */
export const bidTotal = (h: WhistHand) => h.bids.reduce<number>((n, b) => n + (b ?? 0), 0);

/** The bid the dealer may not make (it would make the bids add up), if any. */
export function forbidden(h: WhistHand, seat: number): number | null {
	if (seat !== h.dealer || h.loophole === seat) return null;
	const f = h.size - bidTotal(h);
	return f >= 0 && f <= h.size ? f : null;
}

export function canBid(h: WhistHand, seat: number, b: number): boolean {
	return h.stage === 'bid' && seat === h.turn && Number.isInteger(b) && b >= 0 && b <= h.size && b !== forbidden(h, seat);
}

export function bid(h: WhistHand, seat: number, b: number) {
	if (!canBid(h, seat, b)) throw new Error(`whist22: can't bid ${b} now`);
	h.bids[seat] = b;
	if (seat === h.dealer) {
		h.stage = 'play';
		h.turn = h.leader;
	} else h.turn = cards.nextSeat(seat);
}

/** What a card counts for: the Fool as declared, anything else its number. */
export function valueOf(c: Card, fool?: number): number {
	return isFool(c) ? (fool === 22 ? 22 : 0) : c.rank;
}

/** The value to beat in the trick so far (-1: nothing played). */
export const best = (trick: Played[]) => trick.reduce((m, p) => Math.max(m, p.value), -1);

export function play(h: WhistHand, seat: number, card: Card, fool?: number): Trick | null {
	if (h.stage !== 'play' || h.complete) throw new Error('whist22: not playing');
	if (seat !== h.turn) throw new Error("whist22: not that seat's turn");
	const hand = h.hands[seat];
	const i = hand.indexOf(card);
	if (i < 0) throw new Error('whist22: not in that hand');
	if (isFool(card) && fool !== 0 && fool !== 22) throw new Error('whist22: say what the Fool counts for (0 or 22)');
	hand.splice(i, 1);
	h.trick.push({ seat, card, value: valueOf(card, fool) });
	if (h.trick.length < 4) {
		h.turn = cards.nextSeat(seat);
		return null;
	}
	const top = h.trick.reduce((a, b) => (b.value > a.value ? b : a));
	const t: Trick = { plays: h.trick, winner: top.seat };
	h.tricks.push(t);
	h.won[top.seat]++;
	h.trick = [];
	h.leader = h.turn = top.seat;
	if (h.tricks.length === h.size) h.complete = true;
	return t;
}

/** Did a seat take exactly what it bid? */
export const madeBid = (h: WhistHand, seat: number) => h.bids[seat] === h.won[seat];
