// A Whist 22 player that aims to take exactly its bid. It bids from the odds
// that each card wins its trick (in the one-card round, from the cards it can
// see on everyone else's forehead), then in play it ducks with its highest
// safe card once it has enough, takes cheaply when it needs more, and keeps
// the Fool to fix the count at the end (22 to win, 0 to lose).

import * as W from './rules.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { WhistHand } from './rules.ts';

export const seatName = (s: number) => (s === W.PLAYER ? 'You' : W.SEAT_NAMES[s]);

/** Expected tricks for a hand: each card's chance of beating three others. */
export function expected(hand: Card[]): number {
	let n = 0;
	for (const c of hand) {
		if (W.isFool(c)) continue;
		n += Math.pow(c.rank / 22, 3);
	}
	return n;
}

/** The nearest allowed bid to what a seat would like. */
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
	let want = Math.round(expected(hand));
	// Holding the Fool, lean a trick higher: it can always win one.
	if (hand.some(W.isFool) && expected(hand) % 1 > 0.25) want = Math.ceil(expected(hand));
	return allowed(h, seat, Math.min(h.size, want));
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
