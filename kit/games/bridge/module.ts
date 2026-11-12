// Contract bridge, as in Vulnerable: you declare every deal from South and
// play dummy (North) too, against two AI defenders. Bid a contract from your
// hand and partner's described bid, play the 13 tricks, and score it by the
// duplicate table. 8 rubbers x 3 boards x 3 deals; the last board of a
// rubber, and every board from rubber 5, is vulnerable.

import * as cards from '../../src/core/rules/cards.ts';
import * as play from './rules/play.ts';
import * as bidding from './rules/bidding.ts';
import * as scoring from './rules/scoring.ts';
import * as ai from './rules/ai.ts';
import * as relicsLib from './relics.ts';
import * as conventions from './conventions.ts';
import * as R from '../../src/run/run.ts';
import type { Card, Contract, Hands } from '../../src/core/rules/cards.ts';
import type { PlayState, PlaySummary, Trick } from './rules/play.ts';
import type { GameModule, RelicDef, Run, UpgradeDef, BaseScore } from '../../src/run/run.ts';
import { findCard, playedCards } from '../../src/run/helpers.ts';
import { settled, fateOfMine } from '../../src/run/settle.ts';

export interface Deal {
	hands: Hands;
	original: Hands;
	declarer: number;
	dummy: number;
	partnerInfo: bidding.PartnerInfo;
	dummyVisible: boolean;
	contract: Contract | null;
	state: PlayState | null;
}

export type BridgeAction = { t: 'bid'; level: number; strain: number } | { t: 'play'; card: string } | { t: 'playOut' };

const RUBBER_BASE = [200, 420, 650, 920, 1260, 1680, 2200, 2700];
const BOARD_SCALE = [1.0, 1.3, 1.65];

function round10(n: number): number {
	if (n < 100) return Math.floor(n / 5 + 0.5) * 5;
	const mag = 10 ** Math.max(1, Math.floor(Math.log10(n)) - 1);
	return Math.floor(n / mag + 0.5) * mag;
}

export function vulnerable(run: Run): boolean {
	return run.board === 3 || run.table >= 5;
}

function aiCtx(run: Run<Deal>, rng = run.rng): ai.AIContext {
	const d = run.hand;
	return { declarer: d.declarer, dummy: d.dummy, dummyVisible: d.dummyVisible, rng, skill: ai.DEFAULT_SKILL };
}

export function isPlayerTurn(run: Run<Deal>): boolean {
	const st = run.hand.state;
	return !!st && !st.complete && cards.sameSide(st.turn, run.hand.declarer);
}

function advanceAI(run: Run<Deal>) {
	const d = run.hand;
	let guard = 0;
	while (d.state && !d.state.complete && !isPlayerTurn(run)) {
		if (++guard > 100) throw new Error('bridge: AI stuck');
		const seat = d.state.turn;
		play.play(d.state, seat, ai.chooseCard(d.state, seat, aiCtx(run)));
		d.dummyVisible = true;
	}
}


/** The facts relics see (Vulnerable's ScoreCtx). */
function scoreCtx(run: Run<Deal>, contract: Contract, tricksWon: number, summary: PlaySummary, tricks: Trick[]): relicsLib.ScoreCtx {
	const d = run.hand;
	const result = scoring.score(contract, tricksWon, vulnerable(run));
	return {
		contract,
		result,
		tricksWon,
		made: result.made,
		vulnerable: vulnerable(run),
		hand: d.original[d.declarer],
		dummyHand: d.original[d.dummy],
		declarer: d.declarer,
		summary,
		fit: cards.countSuit(d.original[d.declarer], contract.strain) + cards.countSuit(d.original[d.dummy], contract.strain),
		state: { tricks },
		run: { boardsWonThisRubber: run.boardsWonThisTable }
	};
}

function base(run: Run<Deal>, ctx: relicsLib.ScoreCtx): BaseScore<relicsLib.ScoreCtx> {
	const c = ctx.contract;
	const name = cards.contractName(c);
	if (!ctx.made) {
		const down = scoring.tricksNeeded(c) - ctx.tricksWon;
		return { title: `${name} down ${down}`, made: false, lines: [{ label: `${name}: ${ctx.tricksWon} of ${scoring.tricksNeeded(c)} tricks`, chips: 0 }], ctx, levels: [], detail: ctx.result };
	}
	return {
		title: `${name} made${ctx.tricksWon > scoring.tricksNeeded(c) ? ` +${ctx.tricksWon - scoring.tricksNeeded(c)}` : ''}`,
		made: true,
		lines: [{ label: `${name} scored`, chips: ctx.result.total }],
		ctx,
		levels: [conventions.forStrain(c.strain)!.key],
		detail: ctx.result
	};
}

const EMPTY_SUMMARY: PlaySummary = { declarerTricks: 0, ruffs: 0, tricksFromDummy: 0, tricksFromDeclarer: 0, honourWins: 0, wonLastTrick: false, wonFirstTrick: false, lastThree: 0 };

/** What a contract would score made exactly, with nothing earned in play. */
export function projectScore(run: Run<Deal>, c: Contract): number {
	const plain = { level: c.level, strain: c.strain, doubled: 0 };
	return R.pipeline(run, base(run, scoreCtx(run, plain, scoring.tricksNeeded(plain), EMPTY_SUMMARY, []))).total;
}

export interface BidOption {
	contract: Contract;
	chance: number;
	projected: number;
}

/** Odds and projected score for every contract: the bid grid. */
export function bidOptions(run: Run<Deal>): BidOption[] {
	const d = run.hand;
	const hand = d.hands[d.declarer];
	return scoring.allContracts().map((c) => ({
		contract: c,
		chance: bidding.chanceToMake(bidding.estimateTricks(hand, d.partnerInfo, c.strain), scoring.tricksNeeded(c)),
		projected: projectScore(run, c)
	}));
}

/** The contract a careful player would choose. */
export function recommendBid(run: Run<Deal>, options = bidOptions(run)): Contract {
	const need = Math.max(1, run.target - run.score);
	if (run.handsLeft <= 1) {
		const sure = options.filter((o) => o.projected >= need).sort((a, b) => b.chance - a.chance)[0];
		if (sure) return sure.contract;
	}
	let best = options[0],
		bestV = -1;
	for (const o of options) {
		const v = o.chance * Math.min(o.projected, need) + 0.05 * o.chance * o.projected;
		if (v > bestV) [best, bestV] = [o, v];
	}
	return best.contract;
}

// Vulnerable's relics, seen through the kit's interface. The icons are
// keyed by the relic's own key.
const RELICS: RelicDef<relicsLib.ScoreCtx>[] = relicsLib.DEFS.map((d) => ({
	key: d.key,
	name: d.name,
	rarity: d.rarity,
	cost: d.cost,
	icon: d.key,
	text: d.text,
	describe: d.describe ? (r) => d.describe!(r as never) : undefined,
	score: d.score ? (ctx, r) => d.score!(ctx, r as never) : undefined,
	onHandEnd: (ctx, r, made, run) => {
		const ev = { made, contract: ctx.contract, run: { ...run, boardsWonThisRubber: run.boardsWonThisTable } };
		d.onDealEnd?.(ev, r as never);
		if (!made) return d.onDealFail?.(ev, r as never) ?? undefined;
	},
	onBoardWin: d.onBoardWin ? (r, run) => d.onBoardWin!({ run: { ...run, boardsWonThisRubber: run.boardsWonThisTable } }, r as never) ?? undefined : undefined
}));

const UPGRADES: UpgradeDef[] = conventions.DEFS.map((c) => ({
	key: c.key,
	name: c.name,
	icon: c.key,
	glyph: cards.STRAINS[c.strain].glyph,
	text: c.text,
	chips: conventions.POINTS_PER_LEVEL,
	mult: conventions.MULT_PER_LEVEL
}));

export const bridge: GameModule<Deal, BridgeAction, relicsLib.ScoreCtx> = {
	id: 'bridge',
	title: 'Vulnerable',
	tagline: 'a contract bridge roguelike',
	words: { table: 'Rubber', hand: 'deal', hands: 'deals', chips: 'points', pre: 'Bid' },
	tables: 8,
	boardsPerTable: 3,
	handsPerBoard: 3,
	startMoney: 6,
	goal: (table, board) => round10(RUBBER_BASE[Math.min(table, 8) - 1] * BOARD_SCALE[board - 1]),
	boardName: (run) => (run.board === 3 ? 'Vulnerable Board' : `Board ${run.board}`),
	deal(run) {
		const pack = R.shuffledPack(run);
		const hands: Hands = [[], ...[0, 1, 2, 3].map((i) => cards.sortHand(pack.slice(i * 13, i * 13 + 13)))];
		const N = cards.NORTH,
			S = cards.SOUTH;
		// You always declare, so your side is the stronger, and you hold the
		// stronger of its two hands.
		if (cards.hcp(hands[N]) + cards.hcp(hands[S]) < 20) {
			[hands[N], hands[cards.EAST]] = [hands[cards.EAST], hands[N]];
			[hands[S], hands[cards.WEST]] = [hands[cards.WEST], hands[S]];
		}
		if (cards.hcp(hands[N]) > cards.hcp(hands[S])) [hands[N], hands[S]] = [hands[S], hands[N]];
		R.homing(run, hands, S);
		const hand: Deal = {
			hands,
			original: [[], ...[1, 2, 3, 4].map((s) => cards.copyHand(hands[s]))],
			declarer: S,
			dummy: N,
			partnerInfo: bidding.describePartner(hands[N]),
			dummyVisible: false,
			contract: null,
			state: null
		};
		return { hand, phase: 'pre' };
	},
	act(run, a, opts) {
		const d = run.hand;
		const stepwise = !!opts?.stepwise;
		if (a.t === 'bid') {
			if (run.phase !== R.PHASE.PRE) throw new Error('bridge: not bidding');
			const c: Contract = { level: a.level, strain: a.strain, doubled: 0 };
			if (R.bossIs(run, 'doubler') || bidding.defendersDouble(c, d.hands[d.declarer], d.hands[d.dummy], run.rng)) c.doubled = 1;
			d.contract = c;
			d.state = play.newPlay(d.hands, c.strain, cards.nextSeat(d.declarer));
			run.phase = R.PHASE.PLAY;
			if (!stepwise) advanceAI(run);
		} else if (a.t === 'play') {
			const st = d.state!;
			if (!isPlayerTurn(run)) throw new Error('bridge: not your turn');
			const card = findCard(st.hands[st.turn], a.card);
			if (!card || !play.isLegal(st, st.turn, card)) throw new Error('bridge: illegal card');
			play.play(st, st.turn, card);
			d.dummyVisible = true;
			if (!stepwise) advanceAI(run);
		} else {
			ai.playOut(d.state!, aiCtx(run));
			d.dummyVisible = true;
		}
	},
	handOver: (run) => !!run.hand.state?.complete,
	aiToMove: (run) => !!run.hand.state && !run.hand.state.complete && !isPlayerTurn(run),
	untouched: (run) => !run.hand.state || run.hand.state.tricks.length === 0,
	// While bidding: your hand for West's (you still declare, from it).
	swapHand: {
		can: (run) => (run.phase === R.PHASE.PRE && !run.hand.contract ? [true] : [false, 'only while bidding']),
		swap: (run) => {
			const d = run.hand;
			const S = cards.SOUTH,
				W = cards.WEST;
			[d.hands[S], d.hands[W]] = [d.hands[W], d.hands[S]];
			[d.original[S], d.original[W]] = [d.original[W], d.original[S]];
		}
	},
	// You declare every board, so there's no dealer to be: fresh cards.
	redeal: (run) => bridge.deal(run),
	settled(run) {
		const d = run.hand as Deal;
		const st = d.state;
		if (!st || st.complete || st.tricks.length === 0) return false;
		const ours = (x: number) => cards.sameSide(x, d.declarer);
		return settled(st, {
			clone: (s) => ({ ...s, hands: s.hands.map((x) => x.slice()), trick: s.trick.slice(), tricks: s.tricks.slice(), voids: s.voids.map((v) => ({ ...v })), played: s.played.slice() }),
			over: (s) => s.complete,
			turn: (s) => s.turn,
			legal: (s, seat) => play.legalPlays(s, seat),
			play: (s, seat, c) => void play.play(s, seat, c),
			outcome: (s) => `${JSON.stringify(play.summarise(s, d.declarer))}|${fateOfMine(s.tricks, ours, ours)}`
		});
	},
	stepAI(run) {
		const d = run.hand;
		const st = d.state!;
		const t = play.play(st, st.turn, ai.chooseCard(st, st.turn, aiCtx(run)));
		d.dummyVisible = true;
		return t ? 'trick' : 'card';
	},
	score(run) {
		const d = run.hand;
		const st = d.state!;
		const won = play.declarerTricks(st, d.declarer);
		const b = base(run, scoreCtx(run, d.contract!, won, play.summarise(st, d.declarer), st.tricks));
		if (b.made && d.contract!.level >= 6) run.ext.slams = (run.ext.slams ?? 0) + 1;
		const ours = (s: number) => cards.sameSide(s, d.declarer);
		b.played = playedCards(st.tricks, ours, ours);
		return b;
	},
	relics: RELICS,
	upgrades: UPGRADES,
	bosses: [
		{ key: 'doubler', name: 'The Doubler', text: 'The defenders double every contract', tier: 1 },
		{ key: 'tightwad', name: 'The Tightwad', text: 'x0.75 mult on every deal', tier: 1, score: () => ({ label: 'The Tightwad', xmult: 0.75 }) },
		{ key: 'snob', name: 'The Snob', text: 'Contracts below game score half', tier: 2, score: (c) => (!scoring.isGame(c.contract) ? { label: 'The Snob: below game', xmult: 0.5 } : null) },
		{ key: 'short_rubber', name: 'The Short Rubber', text: 'Only two deals on this board', tier: 2, hands: 2 },
		{ key: 'purist', name: 'The Purist', text: 'Overtricks cost 30 points each', tier: 3, score: (c) => (c.tricksWon > scoring.tricksNeeded(c.contract) ? { label: 'The Purist: overtricks', chips: -30 * (c.tricksWon - scoring.tricksNeeded(c.contract)) } : null) }
	],
	counters: (run) => ({ made: run.stats.made, slams: run.ext.slams ?? 0 }),
	counterNames: { made: 'Contracts made', slams: 'Slams made' },
	describeHand(run) {
		const d = run.hand;
		return `${cards.contractName(d.contract!)}${d.contract!.doubled ? ' doubled' : ''} · ${play.declarerTricks(d.state!, d.declarer)} tricks`;
	},
	bot(run, rng) {
		if (run.phase === R.PHASE.PRE) {
			const c = recommendBid(run);
			return { t: 'bid', level: c.level, strain: c.strain };
		}
		const st = run.hand.state!;
		const card = ai.chooseDeclarerCard(st, st.turn, aiCtx(run, rng));
		return { t: 'play', card: cards.code(card) };
	}
};
