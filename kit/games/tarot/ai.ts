// A plain, sensible Tarot player. It bids by the usual hand count (oudlers,
// trumps, kings, shape), sets aside cards that make voids, and plays by a
// few rules of thumb: win cheaply when the trick matters, give points to a
// partner who's winning (the defenders are a team), throw low cards to the
// enemy, keep the Petit safe, and spend the Excuse before the last trick.

import * as cards from '../../src/core/rules/cards.ts';
import * as T from './rules.ts';
import { newRng, type RNG } from '../../src/core/rules/rng.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { Bid, TarotHand } from './rules.ts';

export const seatName = (s: number) => cards.seatName(s, T.PLAYER);

/** The usual Tarot hand count (36 or so to take, 52 to guard, 68 without the dog, 78 against it). */
export function handCount(hand: Card[]): number {
	let n = 0;
	const trumps = hand.filter(T.isTrump);
	for (const c of hand) {
		if (T.isTrump(c) && c.rank === 21) n += 10;
		else if (T.isExcuse(c)) n += 8;
		else if (T.isPetit(c)) n += trumps.length >= 5 ? 7 : trumps.length >= 4 ? 5 : 0;
		if (T.isTrump(c)) n += c.rank >= 16 ? 3 : 2;
		if (!T.isTrump(c) && !T.isExcuse(c)) {
			if (c.rank === 13) n += 6;
			else if (c.rank === 12) n += 3;
			else if (c.rank === T.KNIGHT) n += 2;
			else if (c.rank === 11) n += 1;
		}
	}
	for (let s = 1; s <= 4; s++) {
		const len = hand.filter((c) => c.suit === s).length;
		if (len === 0) n += 6;
		else if (len === 1) n += 3;
		else if (len >= 5) n += (len - 4) * 2;
		if (hand.some((c) => c.suit === s && c.rank === 13) && hand.some((c) => c.suit === s && c.rank === 12)) n += 1;
	}
	return n;
}

/** The hand counts to bid each contract at. The newer AI's come from
 *  playing thousands of hands out with it: a Prise breaks even at about 45,
 *  and from 50 the Garde's doubled stakes pay. The older ones took nine
 *  hands in ten and went down in more than half. */
const BID_AT = { old: [36, 52, 68, 78], smart: [45, 50, 72, 82] };

/** What a seat bids now (0: pass), never below what's been bid. */
export function chooseBid(h: TarotHand, seat: number, boldness = 0, smart = false): Bid | 0 {
	const n = handCount(h.hands[seat]) + boldness;
	const [p, g, gs, gc] = smart ? BID_AT.smart : BID_AT.old;
	const want: Bid | 0 = n >= gc ? 4 : n >= gs ? 3 : n >= g ? 2 : n >= p ? 1 : 0;
	return want > T.highBid(h) ? want : 0;
}

/** The six cards a taker sets aside: shortest suits first (to make voids),
 *  points before blanks among them (they count for the taker either way). */
export function chooseAside(hand: Card[]): Card[] {
	const chosen: Card[] = [];
	while (chosen.length < T.DOG_SIZE) {
		const left = hand.filter((c) => !chosen.includes(c));
		const ok = left.filter((c) => T.canSetAside(hand, c, chosen));
		const len = (s: number) => left.filter((c) => c.suit === s && !T.isKing(c)).length;
		ok.sort((a, b) => {
			const ta = T.isTrump(a) ? 1 : 0,
				tb = T.isTrump(b) ? 1 : 0;
			if (ta !== tb) return ta - tb;
			if (len(a.suit) !== len(b.suit)) return len(a.suit) - len(b.suit);
			return T.halfPoints(b) - T.halfPoints(a);
		});
		chosen.push(ok[0]);
	}
	return chosen;
}

/** Is the trick, as it stands, going to this seat's side? */
function winningSide(h: TarotHand, seat: number): boolean {
	if (!h.trick.length) return false;
	const w = T.trickWinner(h.trick);
	return T.sideOf(h, w.seat) === T.sideOf(h, seat);
}

/** Would this card take the trick as it stands? */
function wouldWin(h: TarotHand, seat: number, c: Card): boolean {
	if (T.isExcuse(c)) return false;
	return T.trickWinner([...h.trick, { seat, card: c }]).seat === seat;
}

const low = (list: Card[]) => list.reduce((a, b) => (T.halfPoints(b) < T.halfPoints(a) || (T.halfPoints(b) === T.halfPoints(a) && T.order(b) < T.order(a)) ? b : a));
const high = (list: Card[]) => list.reduce((a, b) => (T.halfPoints(b) > T.halfPoints(a) || (T.halfPoints(b) === T.halfPoints(a) && T.order(b) > T.order(a)) ? b : a));
const cheapest = (list: Card[]) => list.reduce((a, b) => (T.order(b) < T.order(a) ? b : a));

/** The rule-of-thumb card (no lookahead). */
export function quickCard(h: TarotHand, seat: number): Card {
	const legal = T.legalPlays(h, seat);
	if (legal.length === 1) return legal[0];
	const hand = h.hands[seat];
	const excuse = legal.find(T.isExcuse);
	const plain = legal.filter((c) => !T.isExcuse(c));
	// Spend the Excuse before the last trick: it's lost if played last.
	if (excuse && hand.length === 2) return excuse;
	const taker = seat === h.taker;
	if (!h.trick.length) {
		// Leading.
		const trumps = plain.filter(T.isTrump);
		if (taker && trumps.length >= 6) {
			const big = trumps.filter((c) => c.rank >= 15 && c.rank !== 21);
			if (big.length) return cheapest(big);
		}
		const kings = plain.filter(T.isKing);
		if (kings.length) return kings[0];
		const suits = plain.filter((c) => !T.isTrump(c));
		if (suits.length) {
			// The low card of the longest suit.
			const len = (s: number) => hand.filter((c) => c.suit === s).length;
			const longest = suits.reduce((a, b) => (len(b.suit) > len(a.suit) ? b : a)).suit;
			return low(suits.filter((c) => c.suit === longest));
		}
		const safe = trumps.filter((c) => !T.isPetit(c));
		return safe.length ? cheapest(safe) : plain[0] ?? legal[0];
	}
	const last = h.trick.length === 3;
	const ours = winningSide(h, seat);
	const winners = plain.filter((c) => wouldWin(h, seat, c));
	if (ours && last) {
		// Partner has it: give points (but not the Petit, unless it's safe now).
		return high(plain);
	}
	if (ours) {
		// Partner's winning but others still to play: give something modest.
		const modest = plain.filter((c) => T.halfPoints(c) <= 3 && !T.isPetit(c));
		return modest.length ? high(modest) : low(plain);
	}
	// The trick is the enemy's for now.
	const worth = T.halfPointsIn(h.trick.map((p) => p.card));
	if (winners.length) {
		const petitSafe = winners.filter((c) => !T.isPetit(c) || last);
		if (petitSafe.length && (last || worth >= 3 || winners.some(T.isTrump))) return last ? cheapest(petitSafe) : high(petitSafe.filter((c) => !T.isTrump(c)).length ? petitSafe.filter((c) => !T.isTrump(c)) : petitSafe);
	}
	// Can't (or won't) win: the Excuse saves a card worth something; else play low.
	const cheap = low(plain.filter((c) => !T.isPetit(c)).length ? plain.filter((c) => !T.isPetit(c)) : plain);
	if (excuse && T.halfPoints(cheap) >= 5) return excuse;
	return cheap;
}

export function describeBid(b: number): string {
	return b ? T.BIDS[b - 1].name : 'pass';
}

export const describeSeat = (s: number) => cards.SEATS[s]?.name ?? '';

// ------------------------------------------------------------------ lookahead
//
// The newer AI plays a hand the way a thoughtful player does: it pictures
// where the cards it can't see might be (consistent with everything it has
// seen: who couldn't follow a suit, who couldn't trump, the dog it was shown),
// plays the rest of the hand out in its head with the rule-of-thumb player
// for each card it might play, and plays the card that scores best on
// average. So it plans: draws trumps when that's what makes the contract,
// cashes a king before its suit is trumped, keeps the Petit back until it's
// safe to bring home, and gives a partner points only when they'll keep them.
// Its random pictures come from a seed made of the position, so the same
// position always gets the same card (a saved run replays exactly).

/** Simulated hands per decision, shared among the cards it might play. */
const BUDGET = 360;
const MIN_SAMPLES = 16;

function copy(h: TarotHand): TarotHand {
	return {
		...h,
		hands: h.hands.map((x) => x.slice()),
		dog: h.dog.slice(),
		bids: h.bids.slice(),
		aside: h.aside.slice(),
		trick: h.trick.slice(),
		tricks: h.tricks.slice(),
		won: h.won.map((x) => x.slice())
	};
}

/** Suits (TRUMPS included) each seat has shown it's out of. */
function voids(h: TarotHand): Set<number>[] {
	const out = [0, 1, 2, 3, 4].map(() => new Set<number>());
	const look = (plays: T.Played[]) => {
		const led = T.ledSuit(plays);
		if (led === null) return;
		const seen: T.Played[] = [];
		for (const p of plays) {
			if (!T.isExcuse(p.card) && seen.some((q) => !T.isExcuse(q.card))) {
				if (p.card.suit !== led) {
					out[p.seat].add(led);
					if (!T.isTrump(p.card)) out[p.seat].add(T.TRUMPS);
				}
			}
			seen.push(p);
		}
	};
	for (const t of h.tricks) look(t.plays);
	look(h.trick);
	return out;
}

/** Deal the cards this seat can't see back out, consistent with what it
 *  knows. Seat 0 stands for the cards set aside, when this seat didn't see
 *  them. Falls back to ignoring the voids if no deal fits quickly. */
function imagine(h: TarotHand, seat: number, rng: RNG, vs: Set<number>[]): TarotHand {
	const c = copy(h);
	const taker = h.taker!;
	const sawAside = seat === taker && h.contract! <= 2;
	const others = [1, 2, 3, 4].filter((s) => s !== seat);
	const holders = sawAside ? others : [...others, 0];
	const room = new Map<number, number>(holders.map((s) => [s, s === 0 ? h.aside.length : h.hands[s].length]));
	const pool = [...others.flatMap((s) => h.hands[s]), ...(sawAside ? [] : h.aside)];
	// Cards of the shown dog not yet played are the taker's or set aside.
	const shown = new Set(seat === taker ? [] : h.shownDog);
	const can = (s: number, card: Card, strict: boolean) => {
		// The aside: the untouched dog in a Garde sans or contre; otherwise
		// set aside by the taker, who can't set aside kings or oudlers (and
		// trumps only when forced, which we ignore).
		if (s === 0) return h.contract! > 2 || (!T.isTrump(card) && !T.isKing(card) && !T.isExcuse(card));
		if (strict && vs[s].has(card.suit)) return false;
		if (shown.has(card) && s !== taker) return false;
		return true;
	};
	for (let attempt = 0; attempt < 12; attempt++) {
		const strict = attempt < 10;
		const left = new Map(room);
		const deal = new Map<number, Card[]>(holders.map((s) => [s, []]));
		const order = rng.shuffle(pool.slice());
		// Most constrained cards first: the shown dog, then by how few can hold it.
		order.sort((a, b) => holders.filter((s) => can(s, a, strict)).length - holders.filter((s) => can(s, b, strict)).length);
		let ok = true;
		for (const card of order) {
			const fit = holders.filter((s) => left.get(s)! > 0 && can(s, card, strict));
			if (!fit.length) { ok = false; break; }
			const s = fit[Math.floor(rng.next() * fit.length)];
			deal.get(s)!.push(card);
			left.set(s, left.get(s)! - 1);
		}
		if (!ok) continue;
		for (const s of others) c.hands[s] = deal.get(s)!;
		if (!sawAside) c.aside = deal.get(0)!;
		return c;
	}
	return c;
}

function seedFor(h: TarotHand, seat: number): RNG {
	const code = (x: Card) => `${x.suit}.${x.rank}`;
	const mine = h.hands[seat].map(code).join(',');
	const seen = [...h.tricks.flatMap((t) => t.plays), ...h.trick].map((p) => `${p.seat}:${code(p.card)}`).join(',');
	return newRng(`tarot|${seat}|${h.dealer}|${h.taker}|${h.contract}|${mine}|${seen}`);
}

/** How this seat's side does at the end of the hand: the taker's score, or
 *  minus it for a defender. */
function value(h: TarotHand, seat: number): number {
	const s = T.outcome(h).score;
	return seat === h.taker ? s : -s;
}

/** The card that scores best over the hands it pictures (ties go to the
 *  rule-of-thumb card). */
export function chooseCard(h: TarotHand, seat: number, lookahead = true): Card {
	const quick = quickCard(h, seat);
	const legal = T.legalPlays(h, seat);
	if (!lookahead || legal.length === 1 || h.hands[seat].length <= 1) return quick;
	const moves = [quick, ...legal.filter((c) => c !== quick)];
	const n = Math.max(MIN_SAMPLES, Math.floor(BUDGET / moves.length));
	const rng = seedFor(h, seat);
	const vs = voids(h);
	const pictures = Array.from({ length: n }, () => imagine(h, seat, rng, vs));
	let best = quick, bestV = -Infinity;
	for (const m of moves) {
		let v = 0;
		for (const pic of pictures) {
			const c = copy(pic);
			T.play(c, seat, m);
			while (!c.complete) T.play(c, c.turn, quickCard(c, c.turn));
			v += value(c, seat);
		}
		if (v > bestV) [best, bestV] = [m, v];
	}
	return best;
}
