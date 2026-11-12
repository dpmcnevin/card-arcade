// The generic run: what every card roguelike in this style shares, whatever
// game is played at the table.
//
//   tables x boards x hands   Each board has a goal; reach it within its
//                             hands to win the board, earn money and visit
//                             the club. The last board of a table has a boss.
//                             Boards 1 and 2 can be skipped for a tag. Win
//                             every table, then keep going (endless).
//   score                     A hand scores chips x mult: the game's base
//                             lines, upgrade levels, relics (and their
//                             editions), the cards you played (editions and
//                             seals), the boss, then ploys.
//   the club                  Relics, upgrades, ploys, card editions, seals
//                             and bundles; reroll, sell.
//   the pack                  The run's own cards, with ids, so editions and
//                             seals stay on a card all run.
//   saves                     A run is its seed and its actions: replaying
//                             them rebuilds it exactly (see save.ts).
//
// The game itself lives in a GameModule: how a hand is dealt, the actions a
// player takes before and during play, when the hand is over, its base
// score, and its content. Everything else here is shared.

import { newRng, randomSeedString, type RNG } from '../core/rules/rng.ts';
import * as cards from '../core/rules/cards.ts';
import type { Card, Hands } from '../core/rules/cards.ts';
import * as C from './content.ts';
import type { CardMod, DeckDef, PlayedCard, SealDef, TagKey, BundleKey, RelicEditionKey, CardEditionKey } from './content.ts';

// ------------------------------------------------------------------ scoring

export interface Line {
	label: string;
	chips?: number;
	mult?: number;
	xmult?: number;
	money?: number;
	/** An edition behind the line (a relic's or a card's), for its color. */
	edition?: string;
}

/** What a relic, upgrade, seal, boss or ploy adds to a hand. */
export interface Effect {
	chips?: number;
	/** Vulnerable's relics say points; the same thing. */
	points?: number;
	mult?: number;
	xmult?: number;
	money?: number;
}

/** A hand's score, line by line. */
export interface Breakdown {
	/** A headline for the score panel ("Clean hand!", "4♠ made"). */
	title: string;
	/** False when the hand scores nothing at all (a failed contract). */
	made: boolean;
	lines: Line[];
	chips: number;
	mult: number;
	total: number;
	money: number;
	/** Anything the game wants to show with it (points taken, tricks). */
	detail?: unknown;
}

/** The game's own part of a hand's score, before levels and relics. */
export interface BaseScore<S> {
	title: string;
	made: boolean;
	lines: Line[];
	/** What relics and bosses see: the game's facts about the hand. */
	ctx: S;
	/** Which upgrades this hand levels (their keys). */
	levels: string[];
	/** The cards played this hand, for editions and seals. */
	played?: PlayedCard[];
	detail?: unknown;
}

// ------------------------------------------------------------------ content

export interface Relic<S = unknown> {
	key: string;
	def: RelicDef<S>;
	name: string;
	cost: number;
	/** Scaling relics keep what they've grown here. */
	state: Record<string, any>;
	edition?: RelicEditionKey;
}

export interface RelicDef<S = unknown> {
	key: string;
	name: string;
	rarity: number;
	cost: number;
	icon: string;
	text: string;
	/** Live text, for relics whose value changes. */
	describe?: (relic: Relic<S>) => string;
	score?: (ctx: S, relic: Relic<S>) => Effect | null | void;
	/** After each hand is banked (scaling relics grow here); may pay money. */
	onHandEnd?: (ctx: S, relic: Relic<S>, made: boolean, run: Run) => { money?: number } | void;
	onBoardWin?: (relic: Relic<S>, run: Run) => { money?: number } | void;
	/** A rule the game reads with hasRule (a relic that bends the rules). */
	rule?: string;
	/** Interest can reach this much (instead of MAX_INTEREST). */
	interestCap?: number;
	/** Rerolls cost $1 less, and the first in each club is free. */
	bargain?: boolean;
	/** Takes no relic slot, and adds one. */
	extraSlot?: boolean;
}

/** A permanent level for one kind of hand: each level past the first adds
 *  `chips` and `mult` whenever the game says that kind of hand was played. */
export interface UpgradeDef {
	key: string;
	name: string;
	icon: string;
	/** A glyph to show in place of the icon (a suit, NT). */
	glyph?: string;
	text: string;
	chips: number;
	mult: number;
}

export interface PloyDef {
	key: string;
	name: string;
	text: string;
	cost: number;
	icon: string;
	/** When it can be used. */
	when: Phase[];
	canUse?: (run: Run) => [boolean, string?];
	use: (run: Run) => void;
	/** Only in games this is true for (a generic ploy a game must support). */
	only?: (m: GameModule) => boolean;
}

/** A boss: the last board of each table, with a rule. Score hooks run
 *  after relics; `rule` is a key the game checks with bossIs(); `hands`
 *  changes the hands on its board. */
export interface BossDef<S = unknown> {
	key: string;
	name: string;
	text: string;
	icon?: string;
	score?: (ctx: S, run: Run) => Line | null | void;
	hands?: number;
	/** One of your relics, at random, does nothing on its board. */
	jinx?: boolean;
	/** Bosses come in tiers; later tables draw from higher ones. */
	tier?: number;
}

export const RARITY_NAME = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

// ------------------------------------------------------------------ module

export interface GameModule<H = any, A = any, S = any> {
	id: string;
	title: string;
	tagline: string;
	/** What the game calls things. */
	words: {
		table: string; // "Table", "Rubber"
		hand: string; // "hand", "deal"
		hands: string;
		chips: string; // "chips", "points"
		/** The pre-play step, if any: "Pass", "Bid". */
		pre?: string;
	};
	tables: number;
	boardsPerTable: number;
	handsPerBoard: number;
	startMoney: number;
	goal(table: number, board: number): number;
	boardName?(run: Run<H>): string;
	/** The run's pack (default: the 52-card deck). Ids are added by the kit. */
	newPack?(): Card[];
	/** Called as each board starts (vulnerability...). */
	startBoard?(run: Run<H>): void;
	/** Deal a new hand from run.pack (see shuffledPack, homing). Return 'pre'
	 *  to ask for the pre-play step first. */
	deal(run: Run<H>): { hand: H; phase: 'pre' | 'play' };
	/** Apply one of the game's own actions; throw if it's illegal. The module
	 *  runs the AI seats after it until it's the player's turn again, unless
	 *  `stepwise`: then the UI plays them one at a time with stepAI. */
	act(run: Run<H>, action: A, opts?: { stepwise?: boolean }): void;
	/** Stepwise play: an AI seat is due to play. */
	aiToMove?(run: Run<H>): boolean;
	/** Play one AI card: 'trick' if it finished a trick, 'card' if not. */
	stepAI?(run: Run<H>): 'trick' | 'card' | null;
	/** The hand has been played out. */
	handOver(run: Run<H>): boolean;
	/** Nothing has happened this hand yet: no trick finished (a board can
	 *  still be skipped). Default: only in the pre-play step. */
	untouched?(run: Run<H>): boolean;
	/** Deal this hand again, with the player as dealer where the game has
	 *  one, without counting a new hand (the Steal the Deal ploy). */
	redeal?(run: Run<H>): { hand: H; phase: 'pre' | 'play' };
	/** Nothing left in this hand can change its score (every way to play the
	 *  rest ends the same): the player may claim it. See settle.ts. */
	settled?(run: Run<H>): boolean;
	/** The game's part of the score. */
	score(run: Run<H>): BaseScore<S>;
	relics: RelicDef<S>[];
	upgrades: UpgradeDef[];
	/** The game's own ploys, seals, decks and bosses; the kit adds its generic ones. */
	ploys?: PloyDef[];
	seals?: SealDef[];
	decks?: DeckDef[];
	bosses?: BossDef<S>[];
	/** Card editions and seals change cards in the pack (off for a game
	 *  whose pack must stay as dealt). Default on. */
	cardMods?: boolean;
	/** Pack items (burn, recolor, promote, copy) may change the pack, within
	 *  these sizes. Off unless set: most games need their pack as it is. */
	packOps?: { min: number; max: number };
	/** How much a relic helps (for the bot's shopping), if measured. */
	relicValue?: Record<string, number>;
	/** The game's own tallies across a run (moons, slams), for the profile. */
	counters?(run: Run<H>): Record<string, number>;
	/** What those tallies are called, for the stats screen. */
	counterNames?: Record<string, string>;
	/** One line about the hand just played, for the game log. */
	describeHand?(run: Run<H>): string;
	/** A sensible action for the player right now: autoplay and tests. Any
	 *  randomness comes from `rng`, never the run's own (replays must match). */
	bot(run: Run<H>, rng: RNG): A;
}

// ------------------------------------------------------------------ the run

export const PHASE = {
	PRE: 'pre',
	PLAY: 'play',
	SCORED: 'scored',
	WON: 'won',
	SHOP: 'shop',
	OVER: 'over',
	VICTORY: 'victory'
} as const;
export type Phase = (typeof PHASE)[keyof typeof PHASE];

export type ShopItem =
	| { kind: 'relic'; def: RelicDef; name: string; cost: number; edition?: RelicEditionKey; sold?: boolean }
	| { kind: 'upgrade'; def: UpgradeDef; name: string; cost: number; sold?: boolean }
	| { kind: 'ploy'; def: PloyDef; name: string; cost: number; sold?: boolean }
	| { kind: 'edition'; def: C.CardEditionDef; name: string; cost: number; sold?: boolean }
	| { kind: 'seal'; def: SealDef; name: string; cost: number; sold?: boolean }
	| { kind: 'bundle'; def: C.BundleDef; name: string; cost: number; sold?: boolean }
	| { kind: 'pack'; def: C.PackOpDef; name: string; cost: number; sold?: boolean };

/** One of a bundle's three choices. */
export type BundleChoice =
	| { kind: 'relic'; def: RelicDef; edition?: RelicEditionKey }
	| { kind: 'ploy'; def: PloyDef }
	| { kind: 'edition'; cardId: number; edition: CardEditionKey };

export interface Payout {
	board: number;
	unused: number;
	interest: number;
	relics: number;
	boss: number;
	total: number;
}

export interface Stats {
	hands: number;
	made: number;
	best: number;
	total: number;
	ploysUsed: number;
	boardsSkipped: number;
}

export interface Run<H = any> {
	game: string;
	module: GameModule<H>;
	seed: string | number;
	rng: RNG;
	deck: string;
	table: number;
	board: number;
	boardsWonThisTable: number;
	money: number;
	score: number;
	target: number;
	handsLeft: number;
	handsThisBoard: number;
	phase: Phase;
	hand: H;
	result: Breakdown | null;
	relics: Relic[];
	/** Ploy keys held. */
	ploys: string[];
	levels: Record<string, number>;
	/** The run's cards, with ids; mods by card id. */
	pack: Card[];
	mods: Record<string, CardMod>;
	shop: { items: ShopItem[] } | null;
	/** A bundle being opened in the club. */
	opening: { bundle: BundleKey; options: BundleChoice[] } | null;
	rerollCost: number;
	freeRerolls?: boolean;
	doubleInterest?: boolean;
	/** This table's boss (the last board's). */
	boss: BossDef | null;
	/** This table's tags for skipping boards 1 and 2. */
	tagOffers: TagKey[];
	/** Tags whose reward comes later (the next club). */
	pendingTags: TagKey[];
	/** After the last table: the run goes on. */
	endless: boolean;
	/** Spotlight: the next hand scores x2. */
	spotlight?: boolean;
	/** The relic a Jinx boss switched off this board. */
	jinxed?: string;
	lastPayout?: Payout;
	stats: Stats;
	/** The game's own run state (a pass rotation, a dealer...). */
	ext: Record<string, any>;
}

export const RELIC_SLOTS = 5;
export const PLOY_SLOTS = 2;
export const SHOP_SIZE = 4;
export const BASE_REROLL = 5;
export const MONEY_PER_BOARD = 4;
export const MONEY_PER_UNUSED = 1;
export const BOSS_BONUS = 2;
export const INTEREST_PER = 5;
export const MAX_INTEREST = 5;
/** Endless goals grow this much a table past the last. */
export const ENDLESS_GROWTH = 1.6;

/** Ploys every game gets. */
export const GENERIC_PLOYS: PloyDef[] = [
	{
		key: 'steal_deal', name: 'Steal the Deal', text: 'Deal this hand again, with you as the dealer', cost: 4, icon: 'redeal',
		when: [PHASE.PRE, PHASE.PLAY],
		only: (m) => !!m.redeal,
		canUse: (run) => (run.module.untouched && !run.module.untouched(run) ? [false, 'only before a trick is played'] : [true]),
		use: (run) => {
			const { hand, phase } = run.module.redeal!(run);
			run.hand = hand;
			run.phase = phase === 'pre' ? PHASE.PRE : PHASE.PLAY;
			run.ext.redeals = (run.ext.redeals ?? 0) + 1;
		}
	},
	{
		key: 'encore', name: 'Encore', text: '+1 hand on this board', cost: 5, icon: 'ploy_encore',
		when: [PHASE.PRE, PHASE.PLAY, PHASE.SCORED],
		canUse: (run) => (run.phase === PHASE.SCORED && run.score >= run.target ? [false, 'the board is won'] : [true]),
		use: (run) => run.handsLeft++
	},
	{
		key: 'spotlight', name: 'Spotlight', text: 'Your next hand scores x2 mult', cost: 4, icon: 'ploy_spotlight',
		when: [PHASE.PRE, PHASE.PLAY],
		canUse: (run) => (run.spotlight ? [false, 'already in the spotlight'] : [true]),
		use: (run) => (run.spotlight = true)
	},
	{
		// Undo rewinds the run's save (see save.ts undo), so the host applies it.
		key: 'undo', name: 'Undo', text: 'Take back the last card you played', cost: 4, icon: 'redeal',
		when: [PHASE.PLAY],
		canUse: (run) => (run.ext.lastPlay === run.stats.hands ? [true] : [false, 'nothing to take back this hand']),
		use: () => {}
	},
	{
		key: 'windfall', name: 'Windfall', text: 'Gain $5', cost: 2, icon: 'ploy_windfall',
		when: [PHASE.PRE, PHASE.PLAY, PHASE.SCORED, PHASE.SHOP],
		use: (run) => (run.money += 5)
	}
];

/** Starting decks every game gets (a game adds its own). */
export const GENERIC_DECKS: DeckDef[] = [
	{ key: 'standard', name: 'Standard Deck', text: 'The usual start', back: 'standard' },
	{ key: 'gilded', name: 'Gilded Deck', text: 'Start with $10', back: 'gilded', apply: (run) => (run.money = 10) },
	{
		key: 'royal', name: 'Royal Deck', text: 'Your four aces start Etched', back: 'royal',
		apply: (run) => run.pack.filter((c) => c.rank === 14).forEach((c) => setMod(run, c, { edition: 'etched' }))
	},
	{
		key: 'schemer', name: "Schemer's Deck", text: 'Start with two ploys', back: 'schemer',
		apply: (run) => {
			while (run.ploys.length < PLOY_SLOTS) run.ploys.push(run.rng.pick(allPloys(run.module))!.key);
		}
	},
	{
		key: 'collector', name: "Collector's Deck", text: 'Start with a random common relic, but only $2', back: 'collector',
		apply: (run) => {
			const def = run.rng.pick(run.module.relics.filter((d) => d.rarity === 1));
			if (def) run.relics.push(instantiate(def));
			run.money = 2;
		}
	}
];

export function allPloys(m: GameModule): PloyDef[] {
	return [...GENERIC_PLOYS, ...(m.ploys ?? [])].filter((p) => !p.only || p.only(m));
}
export function allSeals(m: GameModule): SealDef[] {
	return [...C.SEALS, ...(m.seals ?? [])];
}
export function allDecks(m: GameModule): DeckDef[] {
	return [...GENERIC_DECKS, ...(m.decks ?? [])];
}
export function ployDef(run: Run, key: string): PloyDef | undefined {
	return allPloys(run.module).find((p) => p.key === key);
}

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

export function instantiate(def: RelicDef, edition?: RelicEditionKey): Relic {
	return { key: def.key, def, name: def.name, cost: def.cost + (edition ? C.RELIC_EDITIONS[edition].cost : 0), state: {}, edition };
}

// ------------------------------------------------------------------ the pack

export function mod(run: Run, c: Card): CardMod {
	return run.mods[C.modKey(c)] ?? {};
}
export function setMod(run: Run, c: Card, m: CardMod) {
	run.mods[C.modKey(c)] = { ...mod(run, c), ...m };
}
export function sealOf(run: Run, c: Card): SealDef | undefined {
	const k = mod(run, c).seal;
	return k ? allSeals(run.module).find((s) => s.key === k) : undefined;
}

/** The pack, shuffled with the run's RNG: what a module deals from. */
export function shuffledPack(run: Run): Card[] {
	return run.rng.shuffle(run.pack.slice());
}

/** Homing seals: move each into the player's hand right after the deal,
 *  swapping it for their lowest card that isn't homing. Deterministic. */
export function homing(run: Run, hands: Hands, player: number) {
	const home = (c: Card) => !!sealOf(run, c)?.homing;
	const mine = hands[player];
	for (let seat = 1; seat < hands.length; seat++) {
		if (seat === player) continue;
		for (const c of hands[seat].slice()) {
			if (!home(c)) continue;
			const give = mine.filter((m) => !home(m)).reduce<Card | undefined>((lo, m) => (!lo || m.rank < lo.rank || (m.rank === lo.rank && m.suit < lo.suit) ? m : lo), undefined);
			if (!give) continue;
			hands[seat].splice(hands[seat].indexOf(c), 1, give);
			mine.splice(mine.indexOf(give), 1, c);
		}
	}
	for (let seat = 1; seat < hands.length; seat++) cards.sortHand(hands[seat]);
}

// ------------------------------------------------------------------ rules

/** Is this table's boss on now, and is it this one? */
export function bossActive(run: Run): boolean {
	return !!run.boss && run.board === run.module.boardsPerTable;
}
export function bossIs(run: Run, key: string): boolean {
	return bossActive(run) && run.boss!.key === key;
}
/** Relics that count right now (a Jinx switches one off). */
export function activeRelics(run: Run): Relic[] {
	return run.jinxed && bossActive(run) ? run.relics.filter((r) => r.key !== run.jinxed) : run.relics;
}
/** A held relic bends the rules this way. */
export function hasRule(run: Run, rule: string): boolean {
	return activeRelics(run).some((r) => r.def.rule === rule);
}
/** Relic slots: five, plus one for each relic that adds one. */
export function relicSlots(run: Run): number {
	return RELIC_SLOTS + run.relics.filter((r) => r.def.extraSlot).length;
}

// ------------------------------------------------------------------ new run

export function newRun<H>(module: GameModule<H>, seed?: string | number, opts: { money?: number; deck?: string } = {}): Run<H> {
	seed = seed ?? randomSeedString(newRng());
	const base = module.newPack?.() ?? cards.newDeck();
	const run: Run<H> = {
		game: module.id,
		module,
		seed,
		rng: newRng(seed),
		deck: opts.deck ?? 'standard',
		table: 1,
		board: 1,
		boardsWonThisTable: 0,
		money: opts.money ?? module.startMoney,
		score: 0,
		target: 0,
		handsLeft: 0,
		handsThisBoard: 0,
		phase: PHASE.PRE,
		hand: null as H,
		result: null,
		relics: [],
		ploys: [],
		levels: Object.fromEntries(module.upgrades.map((u) => [u.key, 1])),
		pack: base.map((c, i) => ({ ...c, id: i + 1 })),
		mods: {},
		shop: null,
		opening: null,
		rerollCost: BASE_REROLL,
		boss: null,
		tagOffers: [],
		pendingTags: [],
		endless: false,
		stats: { hands: 0, made: 0, best: 0, total: 0, ploysUsed: 0, boardsSkipped: 0 },
		ext: {}
	};
	allDecks(module).find((d) => d.key === run.deck)?.apply?.(run);
	startBoard(run);
	return run;
}

export function boardName(run: Run): string {
	return run.module.boardName?.(run) ?? `Board ${run.board}`;
}

/** The goal for a board (past the last table, it keeps growing). */
export function goalFor(m: GameModule, table: number, board: number): number {
	if (table <= m.tables) return m.goal(table, board);
	const g = m.goal(m.tables, board) * ENDLESS_GROWTH ** (table - m.tables);
	return Math.round(g / 10) * 10;
}

function newTable(run: Run) {
	const bosses = run.module.bosses ?? [];
	if (bosses.length) {
		const tier = Math.min(3, Math.ceil(run.table / 3));
		const pool = bosses.filter((b) => (b.tier ?? 1) <= tier && b.key !== run.boss?.key);
		run.boss = run.rng.pick(pool.length ? pool : bosses)!;
	}
	run.tagOffers = Array.from({ length: run.module.boardsPerTable - 1 }, () => C.TAG_KEYS[run.rng.int(1, C.TAG_KEYS.length) - 1]);
}

function startBoard(run: Run) {
	if (run.board === 1) newTable(run);
	run.target = goalFor(run.module, run.table, run.board);
	run.score = 0;
	run.handsThisBoard = (bossActive(run) && run.boss!.hands) || run.module.handsPerBoard;
	run.handsLeft = run.handsThisBoard;
	run.jinxed = bossActive(run) && run.boss!.jinx && run.relics.length ? run.rng.pick(run.relics)!.key : undefined;
	run.module.startBoard?.(run);
	startHand(run);
}

function startHand(run: Run) {
	run.result = null;
	const { hand, phase } = run.module.deal(run);
	run.hand = hand;
	run.phase = phase === 'pre' ? PHASE.PRE : PHASE.PLAY;
	// A module may finish a hand inside deal (an all-AI hand); bank it.
	afterGameStep(run);
}

/** One of the game's own actions: pass, bid, play a card, play it out. */
export function act(run: Run, action: unknown, opts?: { stepwise?: boolean }) {
	assert(run.phase === PHASE.PRE || run.phase === PHASE.PLAY, 'act: not at the table');
	run.module.act(run, action, opts);
	// For Undo: the hand in which you last played a card.
	if ((action as { t?: string })?.t === 'play') run.ext.lastPlay = run.stats.hands;
	afterGameStep(run);
}

/** Stepwise play (a UI pacing the AI): is an AI seat due? */
export function aiToMove(run: Run): boolean {
	return run.phase === PHASE.PLAY && !!run.module.aiToMove?.(run);
}

/** Stepwise play: one AI card. Same draws as the module's own loop, so a
 *  save (which records only the player's actions) replays the same. */
export function stepAI(run: Run): 'trick' | 'card' | null {
	if (!aiToMove(run)) return null;
	const r = run.module.stepAI!(run);
	afterGameStep(run);
	return r;
}

function afterGameStep(run: Run) {
	if ((run.phase === PHASE.PRE || run.phase === PHASE.PLAY) && run.module.handOver(run)) finishHand(run);
}

/** The game's base score, then levels, relics, cards, the boss and ploys. */
export function pipeline<S>(run: Run, base: BaseScore<S>): Breakdown {
	const lines = base.lines.slice();
	let chips = lines.reduce((n, l) => n + (l.chips ?? 0), 0);
	let mult = (1 + lines.reduce((n, l) => n + (l.mult ?? 0), 0)) * lines.reduce((x, l) => x * (l.xmult ?? 1), 1);
	let money = 0;
	if (!base.made) return { title: base.title, made: false, lines, chips, mult, total: 0, money: 0, detail: base.detail };
	const add = (label: string, e: Effect | null | void, edition?: string) => {
		if (!e) return;
		const c = e.chips ?? e.points ?? 0;
		if (!c && !e.mult && !e.money && (!e.xmult || e.xmult === 1)) return;
		chips += c;
		mult += e.mult ?? 0;
		if (e.xmult) mult *= e.xmult;
		money += e.money ?? 0;
		lines.push({ label, chips: c || undefined, mult: e.mult || undefined, xmult: e.xmult, money: e.money || undefined, edition });
	};
	for (const key of base.levels) {
		const u = run.module.upgrades.find((x) => x.key === key);
		const lvl = run.levels[key] ?? 1;
		if (!u || lvl <= 1) continue;
		add(`${u.name} level ${lvl}`, { chips: (lvl - 1) * u.chips, mult: (lvl - 1) * u.mult });
	}
	for (const relic of activeRelics(run)) {
		add(relic.name, relic.def.score?.(base.ctx as never, relic as never));
		const ed = relic.edition && C.RELIC_EDITIONS[relic.edition];
		if (ed?.effect) add(`${ed.name} ${relic.name}`, ed.effect, ed.key);
	}
	for (const p of base.played ?? []) {
		const m = mod(run, p.card);
		if (m.edition && p.mine) add(`${C.CARD_EDITIONS[m.edition].name} ${cards.name(p.card)}`, C.CARD_EDITIONS[m.edition].effect, m.edition);
		const seal = sealOf(run, p.card);
		if (seal?.onPlayed) add(`${seal.name.replace(' Seal', '')} ${cards.name(p.card)}`, seal.onPlayed(p, run));
	}
	if (bossActive(run)) {
		const l = run.boss!.score?.(base.ctx as never, run);
		if (l) add(l.label, l);
	}
	if (run.spotlight) add('Spotlight', { xmult: 2 });
	return { title: base.title, made: true, lines, chips, mult, total: Math.max(0, Math.floor(chips * mult)), money, detail: base.detail };
}

function finishHand(run: Run) {
	const base = run.module.score(run);
	const b = pipeline(run, base);
	run.result = b;
	run.spotlight = false;
	run.score += b.total;
	run.money += b.money;
	run.handsLeft--;
	run.stats.hands++;
	if (b.made) run.stats.made++;
	run.stats.total += b.total;
	run.stats.best = Math.max(run.stats.best, b.total);
	for (const r of run.relics) {
		const out = r.def.onHandEnd?.(base.ctx as never, r as never, b.made, run);
		if (out?.money) run.money += out.money;
	}
	run.phase = PHASE.SCORED;
}

/** After the score panel: the next hand, the board won, or the end. */
export function next(run: Run) {
	assert(run.phase === PHASE.SCORED, 'next: nothing scored');
	if (run.score >= run.target) winBoard(run);
	else if (run.handsLeft <= 0) run.phase = PHASE.OVER;
	else startHand(run);
}

export function interest(run: Run): number {
	const cap = Math.max(MAX_INTEREST, ...run.relics.map((r) => r.def.interestCap ?? 0));
	return Math.min(cap, Math.floor(run.money / INTEREST_PER));
}

function winBoard(run: Run) {
	let relics = 0;
	for (const r of run.relics) relics += r.def.onBoardWin?.(r as never, run)?.money ?? 0;
	const int = interest(run) * (run.doubleInterest ? 2 : 1);
	run.doubleInterest = false;
	const p: Payout = { board: MONEY_PER_BOARD, unused: Math.max(0, run.handsLeft) * MONEY_PER_UNUSED, interest: int, relics, boss: bossActive(run) ? BOSS_BONUS : 0, total: 0 };
	p.total = p.board + p.unused + p.interest + p.relics + p.boss;
	run.money += p.total;
	run.lastPayout = p;
	run.boardsWonThisTable++;
	const last = run.board === run.module.boardsPerTable && run.table === run.module.tables && !run.endless;
	run.phase = last ? PHASE.VICTORY : PHASE.WON;
}

/** After winning the last table: keep going, with growing goals. */
export function goEndless(run: Run): [boolean, string?] {
	if (run.phase !== PHASE.VICTORY) return [false, 'not yet'];
	run.endless = true;
	run.phase = PHASE.WON;
	return [true];
}

// ------------------------------------------------------------------ skipping

/** The tag for skipping this board, if it can be skipped now: boards
 *  before the last, before anything has happened on them. */
export function skipTag(run: Run): TagKey | null {
	if (run.board >= run.module.boardsPerTable) return null;
	const fresh = run.phase === PHASE.PRE || (run.phase === PHASE.PLAY && !!run.module.untouched?.(run));
	if (!fresh || run.handsLeft !== run.handsThisBoard || run.score > 0) return null;
	return run.tagOffers[run.board - 1] ?? null;
}

export function skipBoard(run: Run): [boolean, string?] {
	const tag = skipTag(run);
	if (!tag) return [false, "this board can't be skipped now"];
	if (tag === 'ploy') {
		if (run.ploys.length < PLOY_SLOTS) run.ploys.push(run.rng.pick(allPloys(run.module))!.key);
		else run.money += 3;
	} else if (tag === 'edition') giveRandomEdition(run);
	else if (tag === 'cash') run.money += 8;
	else if (tag === 'interest') run.doubleInterest = true;
	else run.pendingTags.push(tag);
	run.stats.boardsSkipped++;
	run.board++;
	startBoard(run);
	return [true];
}

function giveRandomEdition(run: Run) {
	if (run.module.cardMods === false) return;
	const free = run.pack.filter((c) => !mod(run, c).edition);
	if (free.length) setMod(run, run.rng.pick(free)!, { edition: C.rollCardEdition(run.rng).key });
}

// ------------------------------------------------------------------ the club

export function enterShop(run: Run) {
	assert(run.phase === PHASE.WON, 'enterShop: no board won');
	run.phase = PHASE.SHOP;
	const bargain = run.relics.some((r) => r.def.bargain);
	run.rerollCost = bargain ? 0 : BASE_REROLL;
	run.freeRerolls = false;
	run.shop = { items: [] };
	stock(run);
	// Tags paid at the club.
	for (const t of run.pendingTags.splice(0)) {
		if (t === 'bundle') run.shop.items.push({ kind: 'bundle', def: C.BUNDLES.relic, name: C.BUNDLES.relic.name, cost: 0 });
		else if (t === 'reroll') {
			run.freeRerolls = true;
			run.rerollCost = 0;
		}
	}
}

/** What makes two offers the same (a Recolor is per suit). */
function offerKey(it: ShopItem): string {
	return `${it.kind}:${it.def.key}${it.kind === 'pack' && it.def.suit ? it.def.suit : ''}`;
}

/** Fill the club with different offers: a repeat is rolled again. */
function stock(run: Run) {
	const items = run.shop!.items;
	while (items.length < SHOP_SIZE) {
		let it = rollItem(run);
		for (let tries = 0; tries < 12 && items.some((x) => offerKey(x) === offerKey(it)); tries++) it = rollItem(run);
		items.push(it);
	}
}

const RARITY_ODDS = [0, 0.7, 0.25, 0.05];

function rollRelicDef(run: Run, extraOwned: Set<string> = new Set()): RelicDef | undefined {
	const m = run.module;
	const have = new Set([...run.relics.map((r) => r.key), ...(run.shop?.items ?? []).filter((i) => i.kind === 'relic').map((i) => i.def.key), ...extraOwned]);
	let r = run.rng.next(),
		rarity = 1;
	for (let k = 1; k < RARITY_ODDS.length; k++) {
		if (r < RARITY_ODDS[k]) {
			rarity = k;
			break;
		}
		r -= RARITY_ODDS[k];
	}
	const pool = m.relics.filter((d) => d.rarity === rarity && !have.has(d.key));
	return run.rng.pick(pool.length ? pool : m.relics.filter((d) => !have.has(d.key)));
}

function rollItem(run: Run): ShopItem {
	const m = run.module;
	const mods = m.cardMods !== false;
	const roll = run.rng.next();
	// Upgrades 18%, ploys 12%, bundles 10%, card editions 8%, seals 8%; the rest relics.
	if (roll < 0.18 && m.upgrades.length) {
		const def = run.rng.pick(m.upgrades)!;
		return { kind: 'upgrade', def, name: def.name, cost: 3 + (run.levels[def.key] ?? 1) };
	}
	if (roll < 0.3) {
		const def = run.rng.pick(allPloys(m))!;
		return { kind: 'ploy', def, name: def.name, cost: def.cost };
	}
	if (roll < 0.4) {
		const def = C.rollBundle(run.rng);
		if (def.key !== 'edition' || mods) return { kind: 'bundle', def, name: def.name, cost: def.cost };
	}
	if (mods && roll >= 0.4 && roll < 0.48) {
		const def = C.rollCardEdition(run.rng);
		return { kind: 'edition', def, name: `${def.name} card`, cost: def.cost };
	}
	if (m.packOps && roll >= 0.56 && roll < 0.64) {
		const def = C.rollPackOp(run.rng);
		return { kind: 'pack', def, name: def.name, cost: def.cost };
	}
	if (mods && roll >= 0.48 && roll < 0.56) {
		const def = run.rng.pick(allSeals(m))!;
		return { kind: 'seal', def, name: def.name, cost: def.cost };
	}
	const def = rollRelicDef(run)!;
	const edition = C.rollRelicEdition(run.rng);
	return { kind: 'relic', def, name: def.name, cost: def.cost + (edition ? C.RELIC_EDITIONS[edition].cost : 0), edition };
}

/** Relic slots: Phantom relics take none. */
export function relicSlotsUsed(run: Run): number {
	return run.relics.filter((r) => r.edition !== 'phantom' && !r.def.extraSlot).length;
}

/** Does buying this item need a card from the pack (edition, seal)? */
export function needsCard(it: ShopItem): boolean {
	return it.kind === 'edition' || it.kind === 'seal' || it.kind === 'pack';
}

/** Can this pack item go on that card? */
export function canApplyPack(run: Run, def: C.PackOpDef, card: Card | undefined): [boolean, string?] {
	const lim = run.module.packOps;
	if (!lim) return [false, 'this game keeps its pack'];
	if (!card) return [false, 'choose a card'];
	if (def.key === 'burn' && run.pack.length <= lim.min) return [false, `the pack can't go below ${lim.min} cards`];
	if (def.key === 'copy' && run.pack.length >= lim.max) return [false, `the pack can't go above ${lim.max} cards`];
	if (def.key === 'promote' && card.rank >= 14) return [false, 'an ace is already the top rank'];
	if (def.key === 'recolor' && card.suit === def.suit) return [false, 'that card is already that suit'];
	return [true];
}

function applyPack(run: Run, def: C.PackOpDef, card: Card) {
	const i = run.pack.indexOf(card);
	if (def.key === 'burn') {
		run.pack.splice(i, 1);
		delete run.mods[C.modKey(card)];
	} else if (def.key === 'copy') run.pack.push({ suit: card.suit, rank: card.rank, id: Math.max(...run.pack.map((c) => c.id ?? 0)) + 1 } as Card);
	else run.pack[i] = { ...card, ...(def.key === 'promote' ? { rank: card.rank + 1 } : { suit: def.suit }) } as Card;
}

export function canBuy(run: Run, i: number): [boolean, string?] {
	const it = run.shop?.items[i];
	if (!it || it.sold) return [false, 'sold'];
	if (run.opening) return [false, 'open your bundle first'];
	if (run.money < it.cost) return [false, 'too expensive'];
	if (it.kind === 'relic' && it.edition !== 'phantom' && !it.def.extraSlot && relicSlotsUsed(run) >= relicSlots(run)) return [false, 'no relic slot'];
	if (it.kind === 'ploy' && run.ploys.length >= PLOY_SLOTS) return [false, 'no ploy slot'];
	return [true];
}

/** Buy an item; editions and seals go on the card you name. */
export function buy(run: Run, i: number, cardId?: number): [boolean, string?] {
	const ok = canBuy(run, i);
	if (!ok[0]) return ok;
	const it = run.shop!.items[i];
	const card = cardId !== undefined ? run.pack.find((c) => c.id === cardId) : undefined;
	if (needsCard(it) && !card) return [false, 'choose a card'];
	if (it.kind === 'pack') {
		const ok = canApplyPack(run, it.def, card);
		if (!ok[0]) return ok;
	}
	run.money -= it.cost;
	it.sold = true;
	if (it.kind === 'relic') run.relics.push(instantiate(it.def, it.edition));
	else if (it.kind === 'upgrade') run.levels[it.def.key] = (run.levels[it.def.key] ?? 1) + 1;
	else if (it.kind === 'ploy') run.ploys.push(it.def.key);
	else if (it.kind === 'edition') setMod(run, card!, { edition: it.def.key });
	else if (it.kind === 'seal') setMod(run, card!, { seal: it.def.key });
	else if (it.kind === 'pack') applyPack(run, it.def, card!);
	else run.opening = { bundle: it.def.key, options: bundleOptions(run, it.def.key) };
	return [true];
}

function bundleOptions(run: Run, key: BundleKey): BundleChoice[] {
	const out: BundleChoice[] = [];
	if (key === 'relic') {
		const seen = new Set<string>();
		for (let i = 0; i < 3; i++) {
			const def = rollRelicDef(run, seen);
			if (!def) break;
			seen.add(def.key);
			out.push({ kind: 'relic', def, edition: C.rollRelicEdition(run.rng) });
		}
	} else if (key === 'ploy') {
		const pool = run.rng.shuffle(allPloys(run.module).slice());
		for (const def of pool.slice(0, 3)) out.push({ kind: 'ploy', def });
	} else {
		const free = run.rng.shuffle(run.pack.filter((c) => !mod(run, c).edition));
		for (const c of free.slice(0, 3)) out.push({ kind: 'edition', cardId: c.id!, edition: C.rollCardEdition(run.rng).key });
	}
	return out;
}

/** Take one of the open bundle's choices (-1: none). */
export function pick(run: Run, i: number): [boolean, string?] {
	const o = run.opening;
	if (!o) return [false, 'no bundle open'];
	const c = o.options[i];
	if (c?.kind === 'relic' && c.edition !== 'phantom' && !c.def.extraSlot && relicSlotsUsed(run) >= relicSlots(run)) return [false, 'no relic slot'];
	if (c?.kind === 'ploy' && run.ploys.length >= PLOY_SLOTS) return [false, 'no ploy slot'];
	if (c?.kind === 'relic') run.relics.push(instantiate(c.def, c.edition));
	else if (c?.kind === 'ploy') run.ploys.push(c.def.key);
	else if (c?.kind === 'edition') setMod(run, run.pack.find((x) => x.id === c.cardId)!, { edition: c.edition });
	run.opening = null;
	return [true];
}

export function sellRelic(run: Run, i: number): boolean {
	const r = run.relics[i];
	if (!r) return false;
	run.money += Math.max(1, Math.floor(r.cost / 2));
	run.relics.splice(i, 1);
	return true;
}

export function reroll(run: Run): boolean {
	if (run.money < run.rerollCost || run.opening) return false;
	run.money -= run.rerollCost;
	if (!run.freeRerolls) run.rerollCost = run.relics.some((r) => r.def.bargain) ? Math.max(BASE_REROLL - 1, run.rerollCost + 1) : run.rerollCost + 1;
	run.shop!.items = [];
	stock(run);
	return true;
}

export function leaveShop(run: Run) {
	assert(run.phase === PHASE.SHOP, 'leaveShop: not in the club');
	run.shop = null;
	run.opening = null;
	if (run.board === run.module.boardsPerTable) {
		run.table++;
		run.board = 1;
		run.boardsWonThisTable = 0;
	} else run.board++;
	startBoard(run);
}

// ------------------------------------------------------------------ ploys

export function canUsePloy(run: Run, slot: number): [boolean, string?] {
	const key = run.ploys[slot];
	const def = key ? ployDef(run, key) : undefined;
	if (!def) return [false, 'no ploy there'];
	if (!def.when.includes(run.phase)) return [false, 'not now'];
	return def.canUse?.(run) ?? [true];
}

export function usePloy(run: Run, slot: number): [boolean, string?] {
	const ok = canUsePloy(run, slot);
	if (!ok[0]) return ok;
	const def = ployDef(run, run.ploys[slot])!;
	run.ploys.splice(slot, 1);
	def.use(run);
	run.stats.ploysUsed++;
	afterGameStep(run);
	return [true];
}
