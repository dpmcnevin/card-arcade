// Euchre: 24 cards (nine to ace), four players in two partnerships, five
// cards each. A card is turned up; in the first round each player may order
// it up as trump (the dealer takes it and discards), in the second they may
// name another suit. The dealer is stuck: if everyone passes twice, the
// dealer must name a suit. Whoever makes trump may go alone, their partner
// sitting out.
//
// Trumps rank: the jack of trumps (the right bower), the other jack of the
// same color (the left bower, which counts as a trump), then A K Q 10 9.
// Follow the led suit if you can. Making side: 3 or 4 tricks scores 1, all
// five (a march) 2, a lone march 4; fewer than three and they're euchred,
// the other side scoring 2.

import * as cards from '../../src/core/rules/cards.ts';
import type { Card, Hands } from '../../src/core/rules/cards.ts';
import type { RNG } from '../../src/core/rules/rng.ts';

export const RANKS = [9, 10, 11, 12, 13, 14];
export const PLAYER = cards.SOUTH;
export const PARTNER = cards.NORTH;

export function newDeck(): Card[] {
	const out: Card[] = [];
	for (let s = 1; s <= 4; s++) for (const r of RANKS) out.push(cards.card(s, r));
	return out;
}

/** The other suit of the same color. */
export function sameColor(suit: number): number {
	return { 1: 4, 4: 1, 2: 3, 3: 2 }[suit]!;
}

export const isRight = (c: Card, trump: number) => c.rank === 11 && c.suit === trump;
export const isLeft = (c: Card, trump: number) => c.rank === 11 && c.suit === sameColor(trump);

/** The suit a card plays as: the left bower is a trump. */
export function suitOf(c: Card, trump: number): number {
	return isLeft(c, trump) ? trump : c.suit;
}

export function isTrump(c: Card, trump: number): boolean {
	return suitOf(c, trump) === trump;
}

/** How strong a card is in a trick led in `led`. */
export function power(c: Card, trump: number, led: number): number {
	if (isRight(c, trump)) return 100;
	if (isLeft(c, trump)) return 99;
	if (c.suit === trump) return 80 + c.rank;
	if (suitOf(c, trump) === led) return 40 + c.rank;
	return c.rank;
}

export const sameSide = (a: number, b: number) => a % 2 === b % 2;

export interface Played {
	seat: number;
	card: Card;
}

export interface Trick {
	plays: Played[];
	leader: number;
	winner: number;
	led: number;
}

export interface EuchreHand {
	dealer: number;
	hands: Hands;
	/** The turned-up card, and the rest of the kitty. */
	upcard: Card;
	kitty: Card[];
	/** Who has the call, the round (1: order up, 2: name a suit). */
	turn: number;
	round: 1 | 2;
	/** What each seat said, for the table. */
	calls: { seat: number; text: string }[];
	trump: number | null;
	maker: number | null;
	alone: boolean;
	/** Trump was named in round 2. */
	second: boolean;
	/** The cards each seat held once trump was made. */
	start: Hands;
	// Play.
	leader: number;
	trick: Played[];
	tricks: Trick[];
	complete: boolean;
}

/** Deal from a pack of 24 (a run's pack, which may carry ids). */
export function deal(rng: RNG, dealer: number, pack: Card[] = newDeck()): EuchreHand {
	const deck = rng.shuffle(pack.slice());
	const hands: Hands = [[], [], [], [], []];
	let k = 0;
	for (let i = 0; i < 5; i++) for (let s = 1; s <= 4; s++) hands[s].push(deck[k++]);
	for (let s = 1; s <= 4; s++) cards.sortHand(hands[s]);
	return {
		dealer,
		hands,
		upcard: deck[20],
		kitty: deck.slice(21),
		turn: cards.nextSeat(dealer),
		round: 1,
		calls: [],
		trump: null,
		maker: null,
		alone: false,
		second: false,
		start: [[], [], [], [], []],
		leader: cards.nextSeat(dealer),
		trick: [],
		tricks: [],
		complete: false
	};
}

/** The seat sitting out (the lone maker's partner), if any. */
export function sittingOut(h: EuchreHand): number | null {
	return h.alone && h.maker ? cards.partner(h.maker) : null;
}

function nextActive(h: EuchreHand, seat: number): number {
	let s = cards.nextSeat(seat);
	if (s === sittingOut(h)) s = cards.nextSeat(s);
	return s;
}

/** Trump is made: the dealer takes the upcard in round 1, play begins. */
export function makeTrump(h: EuchreHand, seat: number, suit: number, alone: boolean, discard: (hand: Card[], trump: number) => Card) {
	h.trump = suit;
	h.maker = seat;
	h.alone = alone;
	h.second = h.round === 2;
	h.calls.push({ seat, text: `${h.round === 1 ? 'orders up' : 'names'} ${cards.SUITS[suit].name.toLowerCase()}${alone ? ', alone' : ''}` });
	if (h.round === 1 && h.dealer !== sittingOut(h)) {
		const dh = h.hands[h.dealer];
		dh.push(h.upcard);
		const out = discard(dh, suit);
		dh.splice(dh.indexOf(out), 1);
		h.kitty.push(out);
	}
	for (let s = 1; s <= 4; s++) h.start[s] = h.hands[s].slice();
	h.leader = nextActive(h, h.dealer);
	if (h.leader === sittingOut(h)) h.leader = nextActive(h, h.leader);
	h.turn = h.leader;
}

/** A seat passes; the call moves on (to round 2 after the dealer). */
export function pass(h: EuchreHand, seat: number) {
	h.calls.push({ seat, text: 'passes' });
	if (seat === h.dealer) {
		if (h.round === 2) throw new Error('euchre: the dealer is stuck and must name a suit');
		h.round = 2;
	}
	h.turn = cards.nextSeat(seat);
}

export function legalPlays(h: EuchreHand, seat: number): Card[] {
	const hand = h.hands[seat];
	if (!h.trick.length) return hand.slice();
	const led = suitOf(h.trick[0].card, h.trump!);
	const follow = hand.filter((c) => suitOf(c, h.trump!) === led);
	return follow.length ? follow : hand.slice();
}

export function players(h: EuchreHand): number {
	return h.alone ? 3 : 4;
}

/** Play a card; returns the trick if this card finished it. */
export function play(h: EuchreHand, seat: number, card: Card): Trick | null {
	if (seat !== h.turn) throw new Error('euchre: not that seat’s turn');
	if (!legalPlays(h, seat).includes(card)) throw new Error('euchre: illegal card');
	const hand = h.hands[seat];
	hand.splice(hand.indexOf(card), 1);
	h.trick.push({ seat, card });
	if (h.trick.length < players(h)) {
		h.turn = nextActive(h, seat);
		return null;
	}
	const led = suitOf(h.trick[0].card, h.trump!);
	let best = h.trick[0];
	for (const p of h.trick) if (power(p.card, h.trump!, led) > power(best.card, h.trump!, led)) best = p;
	const t: Trick = { plays: h.trick, leader: h.trick[0].seat, winner: best.seat, led };
	h.tricks.push(t);
	h.trick = [];
	h.turn = h.leader = best.seat;
	if (h.tricks.length === 5) h.complete = true;
	return t;
}

export function tricksFor(h: EuchreHand, seat: number): number {
	return h.tricks.filter((t) => sameSide(t.winner, seat)).length;
}

/** Game points by the real rules: [your side, theirs]. */
export function points(h: EuchreHand): [number, number] {
	const makers = tricksFor(h, h.maker!);
	const mine = sameSide(h.maker!, PLAYER);
	let m = 0,
		d = 0;
	if (makers < 3) d = 2;
	else if (makers === 5) m = h.alone ? 4 : 2;
	else m = 1;
	return mine ? [m, d] : [d, m];
}
