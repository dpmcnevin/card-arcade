// A Whist 22 player that aims to take exactly its bid. It bids from the odds
// that each card wins its trick (in the one-card round, from the cards it can
// see on everyone else's forehead), then in play it ducks with its highest
// safe card once it has enough, takes cheaply when it needs more, and keeps
// the Fool to fix the count at the end (22 to win, 0 to lose).

import * as cards from '../../src/core/rules/cards.ts';
import * as W from './rules.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { WhistHand } from './rules.ts';

export const seatName = (s: number) => cards.seatName(s, W.PLAYER);

/** Expected tricks for a hand: each card's chance of beating three cards
 *  drawn from the ones this seat can't see (its own higher cards are no
 *  threat). The Fool, if someone else has it, beats you about half the time
 *  (they'll play it low as often as high). */
export function expected(hand: Card[]): number {
	const unseen = W.newDeck().filter((c) => !hand.some((x) => x.rank === c.rank && x.suit === c.suit));
	const foolOut = unseen.some(W.isFool);
	let n = 0;
	for (const c of hand) {
		if (W.isFool(c)) continue;
		const higher = unseen.filter((u) => !W.isFool(u) && u.rank > c.rank).length + (foolOut ? 0.5 : 0);
		n += Math.pow(1 - higher / unseen.length, 3);
	}
	return n;
}

/** The allowed bid nearest what a seat expects. */
function allowed(h: WhistHand, seat: number, want: number): number {
	const opts = Array.from({ length: h.size + 1 }, (_, i) => i).filter((b) => W.canBid(h, seat, b));
	return opts.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
}

export function chooseBid(h: WhistHand, seat: number): number {
	if (h.blind) {
		// You see everyone's card but your own: bid 1 if yours probably beats them.
		const seen = [1, 2, 3, 4].filter((s) => s !== seat).map((s) => h.hands[s][0]);
		const top = Math.max(...seen.map((c) => (W.isFool(c) ? 11 : c.rank)));
		const pool = W.newDeck().filter((c) => !seen.some((x) => x.rank === c.rank));
		// The Fool would win (as 22) or lose (as 0) at will: count it as a win.
		const wins = pool.filter((c) => W.isFool(c) || c.rank > top).length;
		return allowed(h, seat, wins / pool.length > 0.5 ? 1 : 0);
	}
	const hand = h.hands[seat];
	// Holding the Fool, lean higher: it can always win one more (or duck one).
	const raw = Math.min(h.size, expected(hand) + (hand.some(W.isFool) ? 0.35 : 0));
	// The nearest allowed bid to that count: a dealer barred from 2 with 2.4
	// expected bids 3; with 1.6, it bids 1.
	return allowed(h, seat, raw);
}

export interface Move {
	card: Card;
	fool?: number;
}

export function chooseCard(h: WhistHand, seat: number): Move {
	const hand = h.hands[seat];
	const fool = hand.find(W.isFool);
	const plain = hand.filter((c) => !W.isFool(c)).sort((a, b) => a.rank - b.rank);
	const need = (h.bids[seat] ?? 0) - h.won[seat];
	const left = hand.length;
	const top = W.best(h.trick);
	const last = h.trick.length === 3;
	if (left === 1) {
		const c = hand[0];
		return W.isFool(c) ? { card: c, fool: need > 0 ? 22 : 0 } : { card: c };
	}
	if (need <= 0) {
		// Enough: lose. Throw the highest card that still loses, or the Fool as 0.
		const losers = plain.filter((c) => c.rank < top);
		if (losers.length) return { card: losers.at(-1)! };
		if (fool) return { card: fool, fool: 0 };
		return { card: plain[0] };
	}
	if (need >= left) {
		// Every trick is needed: play to win.
		const winners = plain.filter((c) => c.rank > top);
		if (last && winners.length) return { card: winners[0] };
		if (fool && (!winners.length || last)) return { card: fool, fool: 22 };
		return { card: plain.at(-1)! };
	}
	// Some tricks still needed.
	if (!h.trick.length) {
		// Lead: a strong card when most of what's left is needed, else a low one.
		return need / left > 0.5 ? { card: plain.at(-1)! } : { card: plain[0] };
	}
	const winners = plain.filter((c) => c.rank > top);
	if (winners.length && (last || winners[0].rank >= 17)) return { card: winners[0] };
	const losers = plain.filter((c) => c.rank < top);
	if (losers.length) return { card: losers[0] };
	return { card: plain[0] ?? fool!, fool: plain.length ? undefined : 0 };
}
