// Opponent AI for Hearts, and the autopilot that plays your seat when asked.
//
// Heuristics a decent club player uses: pass the queen of spades and the
// high spades that attract her, pass high hearts, and try to void a short
// suit. In play: duck under the winning card whenever points are on the
// table, win cheap tricks you're last to, dump the queen and high hearts when
// void, flush the queen out with low spades, and gang up on anyone who looks
// like they're shooting the moon. Not a perfect player, on purpose.

import * as cards from '../../../src/core/rules/cards.ts';
import * as H from './hearts.ts';
import { luaSort } from '../../../src/core/rules/luasort.ts';
import type { Card, Hand } from '../../../src/core/rules/cards.ts';
import type { HandState } from './hearts.ts';
import { newRng, type RNG } from '../../../src/core/rules/rng.ts';

export const DEFAULT_SKILL = 0.9;

// ------------------------------------------------------------------ passing

/** How much a card wants to leave the hand (higher = pass it). */
function passDanger(c: Card, hand: Hand): number {
	const spades = cards.cardsOfSuit(hand, H.SPADES);
	const lowSpades = spades.filter((s) => s.rank < 12).length;
	const suitLen = cards.countSuit(hand, c.suit);
	if (c.suit === H.SPADES) {
		// The queen and the cards above her are dangerous without low cover.
		if (c.rank >= 12) return lowSpades >= 4 ? 4 : 100 + c.rank;
		return 0;
	}
	let d = c.rank;
	if (c.suit === H.HEARTS) d += c.rank >= 11 ? 12 : 3;
	// Shed short suits entirely to make a void.
	if (suitLen <= 3 && c.suit !== H.HEARTS) d += 8 - suitLen * 2;
	return d;
}

/** Three cards to pass. */
export function choosePass(hand: Hand, rng: RNG, skill = DEFAULT_SKILL): Card[] {
	if (rng.chance(1 - skill)) return rng.sample(hand, 3);
	const scored = hand.map((c) => ({ c, d: passDanger(c, hand) }));
	luaSort(scored, (a, b) => (a.d !== b.d ? a.d > b.d : a.c.suit !== b.c.suit ? a.c.suit > b.c.suit : a.c.rank > b.c.rank));
	return scored.slice(0, 3).map((x) => x.c);
}

// ------------------------------------------------------------------ play

export interface AIContext {
	rng: RNG;
	skill?: number;
	/** Mistakes look like a person's (a plausible wrong card), not a random card. */
	plausible?: boolean;
	/** A seat to push points onto (bosses: the Shark, the Cartel). When it's
	 *  winning the trick, a void seat dumps its worst card; when it isn't,
	 *  points are held back for later. */
	target?: number;
	/** A card saved for one seat (bosses: the Widow, the Diamond Jack): when
	 *  void, dump it only on a trick that seat is winning; otherwise keep it. */
	saveFor?: { seat: number; card: (c: Card) => boolean };
	/** The newer AI (R.AI_VERSION 2): a better first trick, cashing high
	 *  spades over its own queen, and discards that shed dangerous high cards. */
	smart?: boolean;
	/** Plays only on what a player at the table knows (AI version 4): the
	 *  face-down kitty's points aren't counted on the first trick. */
	fair?: boolean;
}

/** Is this hand strong enough to try for the moon? Lots of high cards,
 *  and the top hearts to take the heart tricks. */
export function moonWorthy(hand: Hand): boolean {
	const high = hand.filter((c) => c.rank >= 12).length;
	const hearts = hand.filter((c) => c.suit === H.HEARTS);
	const topHearts = hearts.filter((c) => c.rank >= 12).length;
	const spadeTop = hand.some((c) => c.suit === H.SPADES && c.rank >= 13) || hand.some(H.isQueenOfSpades);
	return high >= 6 && hearts.length >= 4 && topHearts >= 2 && spadeTop;
}

/** Still going for the moon: no one else has taken a point. */
function shooting(state: HandState, seat: number): boolean {
	if (!state.moonSeats?.includes(seat)) return false;
	const pts = H.pointsTaken(state);
	return [1, 2, 3, 4].every((s) => s === seat || pts[s] === 0);
}

/** Play for every trick: lead the top card of the longest suit, win when
 *  following if possible (as cheaply as still wins), dump low off-suit. */
function chooseMoon(state: HandState, seat: number, legal: Card[]): Card {
	if (state.trick.length === 0) {
		const bySuit = new Map<number, Card[]>();
		for (const c of legal) bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
		let best: Card[] = legal;
		for (const list of bySuit.values()) if (highest(list).rank > highest(best).rank || (highest(list).rank === highest(best).rank && list.length > best.length)) best = list;
		return highest(best);
	}
	const win = H.trickWinner(state.trick);
	const following = legal[0].suit === state.ledSuit;
	if (following) {
		const above = legal.filter((c) => c.rank > win.card.rank);
		return above.length > 0 ? (state.trick.length === 3 ? lowest(above) : highest(above)) : lowest(legal);
	}
	// Void: throw the lowest card that isn't a point (keep points to win later).
	const clean = legal.filter((c) => state.pts(c) <= 0);
	return lowest(clean.length > 0 ? clean : legal);
}

/** The n cards most dangerous to hold: the queen, then the spades above her
 *  and high hearts. For the Pickpocket boss, who passes you exactly these. */
export function mostDangerous(hand: Hand, n: number): Card[] {
	const score = (c: Card) =>
		H.isQueenOfSpades(c) ? 1000 : c.suit === H.HEARTS ? 100 + c.rank : c.suit === H.SPADES && c.rank > 12 ? 90 + c.rank : c.rank;
	const scored = hand.map((c) => ({ c, d: score(c) }));
	luaSort(scored, (a, b) => (a.d !== b.d ? a.d > b.d : a.c.suit > b.c.suit));
	return scored.slice(0, n).map((x) => x.c);
}

const lowest = (list: Card[]) => list.reduce((a, b) => (b.rank < a.rank ? b : a));
const highest = (list: Card[]) => list.reduce((a, b) => (b.rank > a.rank ? b : a));

/**
 * The seat that might be shooting the moon: it has taken every point so far,
 * and enough of them to be a threat. Null if nobody is.
 */
function moonThreat(state: HandState, me: number): number | null {
	const pts = H.pointsTaken(state);
	const total = pts.reduce((a, b) => a + b, 0);
	if (total < 8) return null;
	for (let s = 1; s <= 4; s++) if (s !== me && pts[s] === total) return s;
	return null;
}

function chooseLead(state: HandState, seat: number, legal: Card[]): Card {
	const hand = state.hands[seat];
	const holdQueen = hand.some(H.isQueenOfSpades);
	// Flush out the queen with a low spade while she's still out there.
	if (!holdQueen && H.queensOutstanding(state, hand) > 0) {
		const lowSpades = legal.filter((c) => c.suit === H.SPADES && c.rank < 12);
		if (lowSpades.length > 0) return highest(lowSpades);
	}
	// Otherwise lead low from the shortest safe suit, so it voids soonest.
	const bySuit = new Map<number, Card[]>();
	for (const c of legal) {
		if (c.suit === H.HEARTS) continue;
		if (c.suit === H.SPADES && c.rank >= 12 && !H.queenGone(state)) continue;
		bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
	}
	let best: Card[] | undefined;
	for (const list of bySuit.values()) if (!best || list.length < best.length) best = list;
	if (best) return lowest(best);
	return lowest(legal);
}

function chooseFollow(state: HandState, seat: number, legal: Card[], ctx: AIContext): Card {
	const led = state.ledSuit!;
	const following = legal[0].suit === led;
	const win = H.trickWinner(state.trick);
	const trickPts = H.pointsIn(state.trick.map((p) => p.card), state.pts) + (state.tricks.length === 0 && !ctx.fair ? H.pointsIn(state.kitty, state.pts) : 0);
	const last = state.trick.length === 3;
	const threat = moonThreat(state, seat);

	if (!following && ctx.saveFor && seat !== ctx.saveFor.seat) {
		const saved = legal.filter(ctx.saveFor.card);
		if (saved.length > 0) {
			if (win.seat === ctx.saveFor.seat) return saved[0];
			const rest = legal.filter((c) => !ctx.saveFor!.card(c));
			if (rest.length > 0) legal = rest;
		}
	}
	if (!following) {
		// Ganging up on a target seat: unload on it, and only on it.
		if (ctx.target !== undefined && seat !== ctx.target) {
			if (win.seat !== ctx.target) {
				const clean = legal.filter((c) => state.pts(c) <= 0);
				if (clean.length > 0) return highest(clean);
			} else {
				const queen = legal.find(H.isQueenOfSpades);
				if (queen) return queen;
				const pointy = legal.filter((c) => state.pts(c) > 0);
				if (pointy.length > 0) return pointy.reduce((a, b) => (state.pts(b) > state.pts(a) || (state.pts(b) === state.pts(a) && b.rank > a.rank) ? b : a));
			}
		}
		// Void: a free discard. Stop a moon shot by keeping points away from
		// the shooter; otherwise unload the most dangerous card.
		if (threat !== null && win.seat === threat) {
			const clean = legal.filter((c) => state.pts(c) <= 0);
			if (clean.length > 0) return highest(clean);
		}
		const queen = legal.find(H.isQueenOfSpades);
		if (queen) return queen;
		if (!H.queenGone(state)) {
			const bigSpade = legal.filter((c) => c.suit === H.SPADES && c.rank > 12);
			if (bigSpade.length > 0) return highest(bigSpade);
		}
		// High hearts next; then a high card in another suit, which would
		// otherwise be forced to win a trick later; low hearts last (they're
		// cheap, and easy to duck with).
		if (ctx.smart) {
			const highHearts = legal.filter((c) => c.suit === H.HEARTS && c.rank >= 11 && state.pts(c) > 0);
			if (highHearts.length > 0) return highest(highHearts);
			const danger = legal.filter((c) => state.pts(c) <= 0 && c.rank >= 12);
			if (danger.length > 0) return highest(danger);
		}
		const pointy = legal.filter((c) => state.pts(c) > 0);
		if (pointy.length > 0) return pointy.reduce((a, b) => (state.pts(b) > state.pts(a) || (state.pts(b) === state.pts(a) && b.rank > a.rank) ? b : a));
		return highest(legal);
	}

	const below = legal.filter((c) => c.rank < win.card.rank);
	// Someone's running away with every point: take this trick to stop them.
	if (threat !== null && win.seat === threat && trickPts > 0) {
		const above = legal.filter((c) => c.rank > win.card.rank);
		if (above.length > 0) return lowest(above);
	}
	// The first trick carries no points: get rid of the highest card of the
	// suit while it's free to.
	if (ctx.smart && state.tricks.length === 0 && trickPts === 0) {
		const nonQueen = legal.filter((c) => !H.isQueenOfSpades(c));
		return highest(nonQueen.length > 0 ? nonQueen : legal);
	}
	// Spades with the queen in hand: drop her under the ace or king.
	if (led === H.SPADES) {
		const queen = legal.find(H.isQueenOfSpades);
		if (queen && win.card.rank > 12) return queen;
		// Holding her with the ace or king too: cash them while the trick is
		// clean (no one else can drop the queen on it), so they can't later
		// force you to win the trick she lands in.
		const guards = legal.filter((c) => c.suit === H.SPADES && c.rank > 12);
		if (ctx.smart && queen && guards.length > 0 && trickPts === 0) return highest(guards);
	}
	if (trickPts > 0 || !last) {
		// Points on the table (or more cards to come): duck as high as we safely can.
		if (below.length > 0) {
			// Avoid ducking with the queen when a higher spade might still follow.
			const safe = below.filter((c) => !H.isQueenOfSpades(c));
			if (safe.length > 0) return highest(safe);
			return highest(below);
		}
		// Forced to win: win with the highest card, getting rid of it.
		const nonQueen = legal.filter((c) => !H.isQueenOfSpades(c));
		if (!last && nonQueen.length > 0 && trickPts === 0) return lowest(nonQueen);
		return nonQueen.length > 0 ? highest(nonQueen) : highest(legal);
	}
	// Last to play on a clean trick: take it with our highest card (not the queen).
	const nonQueen = legal.filter((c) => !H.isQueenOfSpades(c));
	if (nonQueen.length > 0 && !ctx.rng.chance(0.15)) return highest(nonQueen);
	return lowest(legal);
}

/** A mistake a real player makes: a card that's off but defensible. Never
 *  the queen of spades thrown away, never a heart led for no reason, never
 *  winning a trick full of points when a lower card would duck it. */
function plausibleMistake(state: HandState, seat: number, legal: Card[], ctx: AIContext): Card {
	// Nobody misses an obvious queen dump: under the ace or king of spades,
	// or on someone else's trick when void.
	const queen = legal.find(H.isQueenOfSpades);
	if (queen && state.trick.length > 0) {
		const win = H.trickWinner(state.trick);
		const following = legal[0].suit === state.ledSuit;
		if (!following || (state.ledSuit === H.SPADES && win.card.rank > 12)) return queen;
	}
	let pool = legal.filter((c) => !H.isQueenOfSpades(c));
	if (state.trick.length === 0) {
		const safe = pool.filter((c) => c.suit !== H.HEARTS);
		if (safe.length) pool = safe;
	} else {
		const win = H.trickWinner(state.trick);
		const pts = H.pointsIn(state.trick.map((p) => p.card), state.pts);
		if (pts > 0 && legal[0].suit === state.ledSuit) {
			const duck = pool.filter((c) => c.rank < win.card.rank);
			if (duck.length) pool = duck;
		}
	}
	if (pool.length === 0) pool = legal;
	return pool[ctx.rng.int(1, pool.length) - 1];
}

/** Three cards to pass, with a person's kind of mistake: three of the six
 *  most dangerous, not the best three. */
export function choosePassPlausible(hand: Hand, rng: RNG, skill = DEFAULT_SKILL): Card[] {
	const scored = hand.map((c) => ({ c, d: passDanger(c, hand) }));
	luaSort(scored, (a, b) => (a.d !== b.d ? a.d > b.d : a.c.suit !== b.c.suit ? a.c.suit > b.c.suit : a.c.rank > b.c.rank));
	if (!rng.chance(1 - skill)) return scored.slice(0, 3).map((x) => x.c);
	return rng.sample(scored.slice(0, 6), 3).map((x) => x.c);
}

/** Choose a card for an AI seat. `think`, when given, picks the card in
 *  place of the rules of thumb (the newer AI's lookahead); a forced card,
 *  a moon run and a person's kind of mistake come first either way. */
export function chooseCard(state: HandState, seat: number, ctx: AIContext, think?: () => Card): Card {
	const legal = H.legalPlays(state, seat);
	if (legal.length === 1) return legal[0];
	const skill = ctx.skill ?? DEFAULT_SKILL;
	if (shooting(state, seat)) return chooseMoon(state, seat, legal);
	if (ctx.rng.chance(1 - skill)) return ctx.plausible ? plausibleMistake(state, seat, legal, ctx) : legal[ctx.rng.int(1, legal.length) - 1];
	if (think) return think();
	if (state.trick.length === 0) return chooseLead(state, seat, legal);
	return chooseFollow(state, seat, legal, ctx);
}

/** Play the rest of the hand with every seat on autopilot. The context can
 *  differ by seat (a boss can make one seat play differently). */
export function playOut(state: HandState, ctx: AIContext | ((seat: number) => AIContext)): HandState {
	let guard = 0;
	while (!state.complete) {
		if (++guard > 60) throw new Error('playOut: did not terminate');
		const seat = state.turn;
		H.play(state, seat, chooseCard(state, seat, typeof ctx === 'function' ? ctx(seat) : ctx));
	}
	return state;
}

// ------------------------------------------------------------------ lookahead
//
// The newer AI (version 4) plays the way a careful player does: it pictures
// where the cards it can't see might be, using only what a player at the
// table would know (its own hand, every card played, who has shown out of a
// suit, the three cards it passed and to whom, the points taken so far, and
// what the pack holds), plays the rest of the hand out in its head for each
// card it might play, and plays the one that leaves it the fewest points on
// average (a moon counts: its own as a big win, anyone else's as a big loss).
// It never looks at another hand, the face-down kitty, or which opponents
// are going for the moon. Its pictures come from a seed made of the
// position, so the same position always gets the same card.

/** What a seat knows beyond the table: the cards it passed, and to whom. */
export interface Knowledge {
	passed?: { to: number; cards: Card[] };
}

const BUDGET = 320;
const MIN_SAMPLES = 14;

function copyState(st: HandState): HandState {
	return {
		...st,
		hands: st.hands.map((x) => x.slice()),
		trick: st.trick.slice(),
		tricks: st.tricks.slice(),
		taken: st.taken.map((x) => x.slice()),
		voids: st.voids.map((v) => ({ ...v })),
		played: st.played.slice(),
		kitty: st.kitty.slice(),
		moonSeats: st.moonSeats?.slice()
	};
}

/** Suits each seat is known to be out of: those it didn't follow, and every
 *  suit but hearts for a seat that led a heart before hearts were broken. */
function knownVoids(st: HandState): Set<number>[] {
	const out = [0, 1, 2, 3, 4].map((s) => new Set<number>(Object.keys(st.voids[s] ?? {}).filter((k) => st.voids[s][Number(k)]).map(Number)));
	let broken = false;
	for (const t of [...st.tricks.map((x) => x.plays), st.trick]) {
		for (let i = 0; i < t.length; i++) {
			const p = t[i];
			if (i === 0 && p.card.suit === H.HEARTS && !broken && !(st.wildSeat === p.seat)) {
				for (const suit of [H.CLUBS, H.DIAMONDS, H.SPADES]) out[p.seat].add(suit);
			}
			if (p.card.suit === H.HEARTS || H.isQueenOfSpades(p.card)) broken = true;
		}
	}
	return out;
}

/** The hidden cards dealt back out as this seat might picture them. Seat 0
 *  stands for the face-down kitty. */
function imagine(st: HandState, seat: number, rng: RNG, voids: Set<number>[], know: Knowledge): HandState {
	const c = copyState(st);
	const others = [1, 2, 3, 4].filter((s) => s !== seat);
	const holders = st.kitty.length ? [...others, 0] : others;
	const room = (s: number) => (s === 0 ? st.kitty.length : st.hands[s].length);
	const pool = [...others.flatMap((s) => st.hands[s]), ...st.kitty];
	const playedSet = new Set(st.played.map((p) => p.card));
	const gift = new Set(know.passed && know.passed.to !== seat ? know.passed.cards.filter((x) => !playedSet.has(x)) : []);
	const can = (s: number, card: Card, strict: boolean) => {
		if (gift.has(card)) return s === know.passed!.to;
		if (s === 0) return true;
		return !strict || !voids[s].has(card.suit);
	};
	for (let attempt = 0; attempt < 12; attempt++) {
		const strict = attempt < 10;
		const left = new Map(holders.map((s) => [s, room(s)]));
		const deal = new Map<number, Card[]>(holders.map((s) => [s, []]));
		const order = rng.shuffle(pool.slice());
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
		if (st.kitty.length) {
			const kitty = deal.get(0)!;
			// After the first trick the kitty sits with whoever won it: swap the
			// pictured kitty in for the real one there.
			if (st.tricks.length > 0) {
				const w = st.tricks[0].winner;
				c.taken[w] = [...c.taken[w].filter((x) => !st.kitty.includes(x)), ...kitty];
			}
			c.kitty = kitty;
		}
		break;
	}
	// Whether the others are going for the moon is theirs to know.
	c.moonSeats = st.moonSeats?.includes(seat) ? [seat] : [];
	return c;
}

function seedFor(st: HandState, seat: number): RNG {
	const code = (x: Card) => `${x.suit}.${x.rank}`;
	return newRng(`hearts|${seat}|${st.hands[seat].map(code).join(',')}|${st.played.map((p) => `${p.seat}:${code(p.card)}`).join(',')}`);
}

/** What the hand cost this seat: its points, or a moon's swing. */
function cost(st: HandState, seat: number): number {
	const shooter = H.moonShooter(st);
	if (shooter === seat) return -H.positiveTotal(st);
	if (shooter !== null) return H.positiveTotal(st);
	return H.pointsTaken(st)[seat];
}

/** The card that leaves this seat the fewest points over the hands it
 *  pictures (ties go to the rule-of-thumb card). */
export function thinkAhead(st: HandState, seat: number, ctx: AIContext, know: Knowledge = {}): Card {
	const legal = H.legalPlays(st, seat);
	if (legal.length === 1) return legal[0];
	const rng = seedFor(st, seat);
	const quickCtx: AIContext = { rng, skill: 1, plausible: true, smart: true, fair: true };
	const quick = st.trick.length === 0 ? chooseLead(st, seat, legal) : chooseFollow(st, seat, legal, { ...ctx, rng, smart: true });
	const moves = [quick, ...legal.filter((c) => c !== quick)];
	const n = Math.max(MIN_SAMPLES, Math.floor(BUDGET / moves.length));
	const voids = knownVoids(st);
	const pictures = Array.from({ length: n }, () => imagine(st, seat, rng, voids, know));
	let best = quick, bestV = Infinity;
	for (const m of moves) {
		let v = 0;
		for (const pic of pictures) {
			const c = copyState(pic);
			H.play(c, seat, m);
			playOut(c, quickCtx);
			v += cost(c, seat);
		}
		if (v < bestV) [best, bestV] = [m, v];
	}
	return best;
}
