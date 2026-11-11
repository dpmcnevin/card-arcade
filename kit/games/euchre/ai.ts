// A plain, honest Euchre player: counts trump strength to call, leads its
// best, and wins tricks as cheaply as it can unless partner already has it.

import * as cards from '../../src/core/rules/cards.ts';
import * as E from './rules.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { EuchreHand } from './rules.ts';

/** How good a hand is with this suit as trump. */
export function strength(hand: Card[], trump: number): number {
	let n = 0;
	for (const c of hand) {
		if (E.isRight(c, trump)) n += 3;
		else if (E.isLeft(c, trump)) n += 2.5;
		else if (c.suit === trump) n += c.rank === 14 ? 1.6 : c.rank === 13 ? 1.3 : c.rank === 12 ? 1.1 : 0.9;
		else if (c.rank === 14) n += 0.7;
	}
	const voids = [1, 2, 3, 4].filter((s) => s !== trump && !hand.some((c) => E.suitOf(c, trump) === s)).length;
	return n + voids * 0.4;
}

/** The card the dealer throws away after taking the upcard. */
export function discard(hand: Card[], trump: number): Card {
	const off = hand.filter((c) => !E.isTrump(c, trump) && c.rank !== 14);
	const pool = off.length ? off : hand.filter((c) => !E.isTrump(c, trump)).length ? hand.filter((c) => !E.isTrump(c, trump)) : hand;
	return pool.reduce((a, b) => (E.power(b, trump, 0) < E.power(a, trump, 0) ? b : a));
}

export interface Call {
	suit: number | null;
	alone: boolean;
}

/** What a seat says when it has the call. */
export function call(h: EuchreHand, seat: number, bias = 0): Call {
	const hand = h.hands[seat];
	if (h.round === 1) {
		const t = h.upcard.suit;
		// The dealer's side gains the upcard; the others hand it to them.
		const withUp = seat === h.dealer ? [...hand, h.upcard] : hand;
		let s = strength(withUp, t);
		if (E.sameSide(seat, h.dealer) && seat !== h.dealer) s += 0.6;
		if (!E.sameSide(seat, h.dealer)) s -= 0.6;
		if (s + bias >= 5.2) return { suit: t, alone: s >= 8.5 };
		return { suit: null, alone: false };
	}
	let best = 0,
		bestS = -1;
	for (let t = 1; t <= 4; t++) {
		if (t === h.upcard.suit) continue;
		const s = strength(hand, t);
		if (s > bestS) [best, bestS] = [t, s];
	}
	if (bestS + bias >= 4.8 || seat === h.dealer) return { suit: best, alone: bestS >= 8.5 };
	return { suit: null, alone: false };
}

/** The card to play. */
export function chooseCard(h: EuchreHand, seat: number): Card {
	const trump = h.trump!;
	const legal = E.legalPlays(h, seat);
	const low = (xs: Card[], led: number) => xs.reduce((a, b) => (E.power(b, trump, led) < E.power(a, trump, led) ? b : a));
	const high = (xs: Card[], led: number) => xs.reduce((a, b) => (E.power(b, trump, led) > E.power(a, trump, led) ? b : a));
	if (!h.trick.length) {
		const trumps = legal.filter((c) => E.isTrump(c, trump));
		// Makers pull trumps with the right bower; anyone cashes an off ace.
		if (E.sameSide(seat, h.maker!) && trumps.some((c) => E.isRight(c, trump))) return high(trumps, trump);
		const aces = legal.filter((c) => c.rank === 14 && !E.isTrump(c, trump));
		if (aces.length) return aces[0];
		const off = legal.filter((c) => !E.isTrump(c, trump));
		return off.length ? low(off, 0) : low(legal, trump);
	}
	const led = E.suitOf(h.trick[0].card, trump);
	let best = h.trick[0];
	for (const p of h.trick) if (E.power(p.card, trump, led) > E.power(best.card, trump, led)) best = p;
	const top = E.power(best.card, trump, led);
	const partnerHasIt = E.sameSide(best.seat, seat) && (top >= 99 || h.trick.length === E.players(h) - 1 || best.card.rank >= 13);
	if (partnerHasIt) return low(legal, led);
	const winners = legal.filter((c) => E.power(c, trump, led) > top);
	return winners.length ? low(winners, led) : low(legal, led);
}

export const seatName = (s: number) => (s === E.PLAYER ? 'You' : s === E.PARTNER ? 'Partner' : cards.SEATS[s].name);
