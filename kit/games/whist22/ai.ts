// A Whist 22 player that aims to take exactly its bid.
//
// It thinks ahead by playing the round out in its head: for each bid it may
// make, and each card it may play, it deals the cards it can't see at random
// many times, plays the rest of the round with a quick rule-of-thumb player
// (below), and keeps the choice that comes out exact most often. Its random
// draws come from a seed made of the position, so the same position always
// gets the same answer (a saved run replays exactly).
//
// The rule-of-thumb player bids from the odds that each card wins its trick
// (in the one-card round, from the cards it can see on everyone else's
// forehead), and in play ducks with its highest safe card once it has enough,
// takes cheaply when it needs more, and keeps the Fool to fix the count at
// the end (22 to win, 0 to lose).

import * as cards from '../../src/core/rules/cards.ts';
import * as W from './rules.ts';
import { newRng, type RNG } from '../../src/core/rules/rng.ts';
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

/** The rule-of-thumb bid (no lookahead). */
export function quickBid(h: WhistHand, seat: number): number {
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

/** The rule-of-thumb card (no lookahead). */
export function quickCard(h: WhistHand, seat: number): Move {
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

// ------------------------------------------------------------------ lookahead

/** Simulated rounds per choice. */
const BID_SAMPLES = 40;
const CARD_SAMPLES = 32;

/** A seed from everything this seat can see, so the same position always
 *  draws the same random deals. */
function seedFor(h: WhistHand, seat: number, what: string): RNG {
	const mine = h.hands[seat].map((c) => c.rank).join(',');
	const seen = [...h.tricks.flatMap((t) => t.plays), ...h.trick].map((p) => `${p.seat}:${p.card.rank}:${p.value}`).join(',');
	return newRng(`w22|${what}|${seat}|${h.size}|${h.dealer}|${mine}|${h.bids.join(',')}|${seen}`);
}

/** A copy of a round to play out in the head. Cards are never changed in
 *  play (only moved between arrays), so copying the arrays is enough; and a
 *  bare JavaScriptCore (the iPad) has no structuredClone. */
function copy(h: WhistHand): WhistHand {
	return { ...h, hands: h.hands.map((x) => x.slice()), bids: h.bids.slice(), trick: h.trick.slice(), tricks: h.tricks.slice(), won: h.won.slice(), undealt: h.undealt.slice() };
}

/** A copy of the round as this seat might imagine it: the cards it can't see
 *  (other hands and the undealt) shuffled and dealt back out. */
function imagine(h: WhistHand, seat: number, rng: RNG): WhistHand {
	const c = copy(h);
	const others = [1, 2, 3, 4].filter((s) => s !== seat);
	const pool = rng.shuffle([...others.flatMap((s) => c.hands[s]), ...c.undealt]);
	let k = 0;
	for (const s of others) c.hands[s] = c.hands[s].map(() => pool[k++]);
	c.undealt = pool.slice(k);
	return c;
}

/** How well an imagined deal fits the bids made: each seat that has bid is
 *  likelier to hold cards that bid that (by the rule-of-thumb count of its
 *  hand as it was dealt, cards already played included). 1 is a perfect fit. */
function fit(h: WhistHand, d: WhistHand, seat: number): number {
	let w = 1;
	for (const s of [1, 2, 3, 4]) {
		const b = h.bids[s];
		if (s === seat || b === null) continue;
		const played = [...h.tricks.flatMap((t) => t.plays), ...h.trick].filter((p) => p.seat === s).map((p) => p.card);
		const dealt = [...d.hands[s], ...played];
		const e = Math.min(h.size, expected(dealt) + (dealt.some(W.isFool) ? 0.35 : 0));
		w *= Math.exp(-((e - b) ** 2) / (2 * 0.6 * 0.6));
	}
	return w;
}

/** An imagined deal that fits the bids: deals drawn at random are kept in
 *  proportion to how well they fit (the newer AI, version 4). A seat that
 *  bid 0 rarely holds the 20; a seat that bid 3 of 4 holds high cards. */
function imagineFitting(h: WhistHand, seat: number, rng: RNG): WhistHand {
	let best: WhistHand | null = null, bestW = -1;
	for (let i = 0; i < 40; i++) {
		const d = imagine(h, seat, rng);
		const w = fit(h, d, seat);
		if (rng.next() < w) return d;
		if (w > bestW) [best, bestW] = [d, w];
	}
	return best!;
}

/** Finish the round with the rule-of-thumb player in every seat. */
function playOutQuick(h: WhistHand) {
	while (h.stage === 'bid') W.bid(h, h.turn, quickBid(h, h.turn));
	while (!h.complete) {
		const m = quickCard(h, h.turn);
		W.play(h, h.turn, m.card, m.fool);
	}
}

/** The bid that comes out exact most often over simulated rounds (ties go
 *  to the rule-of-thumb bid). In the one-card round you can't see your own
 *  card, so it bids by what's on the others' foreheads. */
export function chooseBid(h: WhistHand, seat: number, lookahead = true, infer = false): number {
	const quick = quickBid(h, seat);
	if (h.blind || !lookahead) return quick;
	const options = Array.from({ length: h.size + 1 }, (_, i) => i).filter((b) => W.canBid(h, seat, b));
	if (options.length === 1) return options[0];
	const rng = seedFor(h, seat, 'bid');
	const deals = Array.from({ length: BID_SAMPLES }, () => (infer ? imagineFitting(h, seat, rng) : imagine(h, seat, rng)));
	let best = quick, bestN = -1;
	for (const b of [quick, ...options.filter((x) => x !== quick)]) {
		let n = 0;
		for (const d of deals) {
			const c = copy(d);
			W.bid(c, seat, b);
			playOutQuick(c);
			if (c.won[seat] === b) n++;
		}
		if (n > bestN) [best, bestN] = [b, n];
	}
	return best;
}

/** The card (and the Fool's value) that makes the bid most often over
 *  simulated rounds (ties go to the rule-of-thumb card). */
export function chooseCard(h: WhistHand, seat: number, lookahead = true, infer = false): Move {
	const quick = quickCard(h, seat);
	const hand = h.hands[seat];
	if (hand.length <= 1 || h.blind || !lookahead) return quick;
	const moves: Move[] = hand.flatMap((c) => (W.isFool(c) ? [{ card: c, fool: 0 }, { card: c, fool: 22 }] : [{ card: c }]));
	const same = (a: Move, b: Move) => a.card === b.card && (a.fool ?? -1) === (b.fool ?? -1);
	const ordered = [moves.find((m) => same(m, quick)) ?? quick, ...moves.filter((m) => !same(m, quick))];
	const rng = seedFor(h, seat, 'card');
	const deals = Array.from({ length: CARD_SAMPLES }, () => (infer ? imagineFitting(h, seat, rng) : imagine(h, seat, rng)));
	let best = ordered[0], bestN = -1;
	for (const m of ordered) {
		let n = 0;
		const at = hand.indexOf(m.card);
		for (const d of deals) {
			const c = copy(d);
			W.play(c, seat, c.hands[seat][at], m.fool);
			playOutQuick(c);
			if (c.won[seat] === c.bids[seat]) n++;
		}
		if (n > bestN) [best, bestN] = [m, n];
	}
	return best;
}
