// A plain, sensible Tarot player. It bids by the usual hand count (oudlers,
// trumps, kings, shape), sets aside cards that make voids, and plays by a
// few rules of thumb: win cheaply when the trick matters, give points to a
// partner who's winning (the defenders are a team), throw low cards to the
// enemy, keep the Petit safe, and spend the Excuse before the last trick.

import * as cards from '../../src/core/rules/cards.ts';
import * as T from './rules.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { Bid, TarotHand } from './rules.ts';

export const seatName = (s: number) => (s === T.PLAYER ? 'You' : T.SEAT_NAMES[s]);

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

/** What a seat bids now (0: pass), never below what's been bid. */
export function chooseBid(h: TarotHand, seat: number, boldness = 0): Bid | 0 {
	const n = handCount(h.hands[seat]) + boldness;
	const want: Bid | 0 = n >= 78 ? 4 : n >= 68 ? 3 : n >= 52 ? 2 : n >= 36 ? 1 : 0;
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

export function chooseCard(h: TarotHand, seat: number): Card {
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
