// Relics: the items that turn a hand of Hearts into a big number.
//
// Each hand scores chips x mult. Base chips come from the points you dodge
// (26 minus what you took) or the jackpot for shooting the moon. Relics add
// chips, add mult, or multiply it, and some grow over the run. Several pull
// against the core instinct of dodging -- Bleeding Heart and Collector pay
// you for taking hearts -- so a build can go hunting instead of hiding.
//
// Icons reuse Vulnerable's pixel art for now (`icon`).

import * as cards from '../../src/core/rules/cards.ts';
import * as H from './rules/hearts.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import type { PassDir, Trick } from './rules/hearts.ts';
import type { RNG } from '../../src/core/rules/rng.ts';

export const RARITY_NAME = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

export interface ScoreCtx {
	/** Points you took this hand. */
	myPoints: number;
	/** Hearts you took. */
	heartsTaken: number;
	tookQueen: boolean;
	/** Seat that shot the moon (after relic rules), or null. */
	shooter: number | null;
	/** Tricks you won. */
	myTricks: Trick[];
	/** Tricks you led. */
	tricksLed: number;
	/** Every trick of the hand. */
	tricks: Trick[];
	passDir: PassDir;
	passed: Card[];
	received: Card[];
	/** You held the queen of spades after passing. */
	heldQueen: boolean;
	/** You played the queen of spades into a trick someone else won. */
	dumpedQueen: boolean;
	/** Suits you were void in once the passing was done. */
	voidsAfterPass: number;
	/** You took the jack of diamonds. */
	tookJackOfDiamonds: boolean;
	/** Boards won so far this table, moons shot this run. */
	boardsWonThisTable: number;
	moonsThisRun: number;
	// For the expansion relics (filled in by the run; see run.scoreContext).
	/** Cards you won this hand. */
	taken: Card[];
	/** Points each card carries this hand. */
	pts: (c: Card) => number;
	firstHandOfBoard: boolean;
	lastHandOfBoard: boolean;
	/** Your board score before this hand was below the goal. */
	behindGoal: boolean;
	bossBoard: boolean;
	/** Cards burned from the pack so far. */
	cardsBurned: number;
	/** Sealed cards you won this hand. */
	sealedTaken: number;
	/** Your relics with an edition. */
	editionCount: number;
	/** Point cards you passed that someone else took. */
	passedPointsAway: number;
	/** Voids the opponents revealed this hand. */
	opponentVoids: number;
	/** The run's balance version (RunOptions.balance): 1 = v2 and before, 3 = v3. */
	balance: number;
	/** Relics you hold. */
	relicCount: number;
	/** Your common relics (Ensemble). */
	commonRelics?: number;
	/** Cards with an edition you played this hand (Gallery). */
	editionsPlayed?: number;
}

export interface Effect {
	chips?: number;
	mult?: number;
	xmult?: number;
	/** Money, paid when the hand is banked. */
	money?: number;
}

export interface RelicState {
	mult?: number;
	x?: number;
	streak?: number;
	chips?: number;
	/** Boards won while held (Snowball). */
	wins?: number;
	/** The board a once-per-board relic was last used on. */
	used?: string;
}

/** What a relic knows when a board is won. */
export interface BoardWinInfo {
	boss: boolean;
	seals: number;
	balance: number;
}

export interface Relic {
	key: string;
	def: RelicDef;
	name: string;
	cost: number;
	state: RelicState;
	edition?: EditionKey;
}

// ------------------------------------------------------------------ editions
//
// A relic in the club sometimes comes with an edition: a bonus on top of
// what the relic does, every hand, for a higher price. Off unless the run
// turns them on (the iPad app does; the web game doesn't yet).

export type EditionKey = 'etched' | 'lacquered' | 'prismatic' | 'phantom';

export interface EditionDef {
	key: EditionKey;
	name: string;
	text: string;
	/** Added to the relic's price. */
	cost: number;
	/** The bonus every hand, or null (Phantom's gift is the slot). */
	effect: Effect | null;
	/** Relative chance among editions. */
	weight: number;
}

export const EDITIONS: Record<EditionKey, EditionDef> = {
	etched: { key: 'etched', name: 'Etched', text: '+10 chips every hand', cost: 3, effect: { chips: 10 }, weight: 0.4 },
	lacquered: { key: 'lacquered', name: 'Lacquered', text: '+0.5 mult every hand', cost: 4, effect: { mult: 0.5 }, weight: 0.3 },
	prismatic: { key: 'prismatic', name: 'Prismatic', text: 'x1.25 mult every hand', cost: 6, effect: { xmult: 1.25 }, weight: 0.2 },
	phantom: { key: 'phantom', name: 'Phantom', text: 'Takes no relic slot', cost: 5, effect: null, weight: 0.1 }
};
export const EDITION_KEYS = Object.keys(EDITIONS) as EditionKey[];

/** Chance a relic offered in the club has an edition. */
export const EDITION_CHANCE = 0.08;

export function rollEdition(rng: RNG): EditionKey | undefined {
	if (rng.next() >= EDITION_CHANCE) return undefined;
	let roll = rng.next();
	for (const k of EDITION_KEYS) {
		roll -= EDITIONS[k].weight;
		if (roll < 0) return k;
	}
	return 'etched';
}

export interface RelicDef {
	key: string;
	name: string;
	rarity: number;
	cost: number;
	icon: string;
	text: string;
	score?: (ctx: ScoreCtx, relic: Relic) => Effect | null;
	/** Called after each hand is scored; scaling relics grow here. */
	onHandEnd?: (ctx: ScoreCtx, relic: Relic) => void;
	onBoardWin?: (relic: Relic, info: BoardWinInfo) => { money?: number } | void;
	describe?: (relic: Relic, balance?: number) => string;
	/** Rule-changing relics. */
	halfMoon?: boolean;
	moonX?: number;
	baseX?: number;
	/** In the expanded pool only (the iPad app's runs). */
	expansion?: boolean;
	/** Offered only in runs with `v4Relics` (ruleset v4), so older runs keep their offers. */
	v4Only?: boolean;
	/** Glass Deck: the deck view stays open all hand. */
	seeDeck?: boolean;
	/** Offered only in runs with `v5Relics` (ruleset v5). */
	v5Only?: boolean;
	/** Interest can reach this much. */
	interestCap?: number;
	/** Rerolls cost $1 less, and the first in each club is free. */
	bargain?: boolean;
	/** Taking 16 or more points (short of the moon) scores as dodging them. */
	moonlighter?: boolean;
	/** Taking all but three or fewer points counts as shooting the moon. */
	shadowMoon?: boolean;
	/** Each hand, the first heart you take goes to the player with the most points. */
	fixer?: boolean;
	/** Your first three cards each hand may ignore the follow-suit rule. */
	wildcard?: boolean;
	/** You can see which suits each opponent is void in (the app shows it). */
	cardCounter?: boolean;
	/** Takes no relic slot and adds one. */
	extraSlot?: boolean;
	/** What changes under balance version 3 (ruleset v3): its text and price.
	 *  The numbers themselves branch on ctx.balance in `score`. */
	v3?: { text?: string; cost?: number };
}

/** A relic's text under a balance version. */
export function textAt(def: RelicDef, balance = 1): string {
	return balance >= 3 && def.v3?.text ? def.v3.text : def.text;
}

/** A relic's price under a balance version. */
export function costAt(def: RelicDef, balance = 1): number {
	return balance >= 3 && def.v3?.cost !== undefined ? def.v3.cost : def.cost;
}

const dodging = (ctx: ScoreCtx) => ctx.shooter === null;
/** The card you played to a trick. */
const myPlay = (t: Trick) => t.plays.find((p) => p.seat === H.PLAYER)!.card;

export const DEFS: RelicDef[] = [
	// ---------------------------------------------------------------- common
	{
		key: 'clean_hands', name: 'Clean Hands', rarity: 1, cost: 4, icon: 'safety_play',
		text: '+15 chips if you take no points',
		score: (ctx) => (ctx.myPoints === 0 && dodging(ctx) ? { chips: 15 } : null)
	},
	{
		key: 'spade_shield', name: 'Spade Shield', rarity: 1, cost: 5, icon: 'insurance',
		text: '+25 chips if you hold the queen of spades after passing and still avoid taking her',
		score: (ctx) => (ctx.heldQueen && !ctx.tookQueen ? { chips: 25 } : null)
	},
	{
		key: 'low_road', name: 'Low Road', rarity: 1, cost: 4, icon: 'shape_shifter',
		text: '+4 chips for each trick you win with a seven or lower',
		v3: { text: '+7 chips for each trick you win with a seven or lower' },
		score: (ctx) => ({ chips: (ctx.balance >= 3 ? 7 : 4) * ctx.myTricks.filter((t) => t.winningCard.rank <= 7).length })
	},
	{
		key: 'trickster', name: 'Trickster', rarity: 1, cost: 5, icon: 'psych',
		text: '+4 chips for each trick you win that holds no points',
		score: (ctx) => ({ chips: 4 * ctx.myTricks.filter((t) => t.points === 0).length })
	},
	{
		key: 'passing_fancy', name: 'Passing Fancy', rarity: 1, cost: 4, icon: 'transfer',
		text: '+5 chips for each ten or higher you pass',
		score: (ctx) => ({ chips: 5 * ctx.passed.filter((c) => c.rank >= 10).length })
	},
	{
		key: 'diamond_jack', name: 'Diamond Jack', rarity: 1, cost: 5, icon: 'the_finesse',
		text: 'Taking the jack of diamonds is worth +20 chips (a classic house rule)',
		score: (ctx) => (ctx.tookJackOfDiamonds ? { chips: 20 } : null)
	},
	{
		key: 'leader', name: 'Leader', rarity: 1, cost: 4, icon: 'lead_out_of_turn',
		text: '+3 chips for each trick you lead',
		score: (ctx) => ({ chips: 3 * ctx.tricksLed })
	},
	{
		key: 'last_word', name: 'Last Word', rarity: 1, cost: 5, icon: 'endplay',
		text: '+20 chips if you win the last trick',
		v3: { text: '+30 chips if you win the last trick' },
		score: (ctx) => {
			const last = ctx.tricks[ctx.tricks.length - 1];
			return last && last.winner === H.PLAYER ? { chips: ctx.balance >= 3 ? 30 : 20 } : null;
		}
	},
	{
		key: 'steady_hand', name: 'Steady Hand', rarity: 1, cost: 5, icon: 'master_points',
		text: 'Gains +0.25 mult each hand you take no points',
		describe: (r) => `Gains +0.25 mult each hand you take no points (now +${(r.state.mult ?? 0).toFixed(2)})`,
		onHandEnd: (ctx, r) => {
			if (ctx.myPoints === 0 && dodging(ctx)) r.state.mult = (r.state.mult ?? 0) + 0.25;
		},
		score: (_ctx, r) => ((r.state.mult ?? 0) > 0 ? { mult: r.state.mult } : null)
	},

	// -------------------------------------------------------------- uncommon
	{
		key: 'bleeding_heart', name: 'Bleeding Heart', rarity: 2, cost: 6, icon: 'partners_trust',
		text: '+0.4 mult for each heart you take',
		score: (ctx) => (ctx.heartsTaken > 0 ? { mult: 0.4 * ctx.heartsTaken } : null)
	},
	{
		key: 'black_widow', name: 'Black Widow', rarity: 2, cost: 7, icon: 'the_void',
		text: 'x2 if you drop the queen of spades on someone else',
		score: (ctx) => (ctx.dumpedQueen ? { xmult: 2 } : null)
	},
	{
		key: 'void_walker', name: 'Void Walker', rarity: 2, cost: 6, icon: 'ruffing_void',
		text: 'x1.5 for each suit you are void in after passing',
		score: (ctx) => (ctx.voidsAfterPass > 0 ? { xmult: 1.5 ** ctx.voidsAfterPass } : null)
	},
	{
		key: 'hold_em', name: "Hold 'Em", rarity: 2, cost: 6, icon: 'strong_partner',
		text: 'x2 on hands with no passing',
		score: (ctx) => (ctx.passDir === 'hold' ? { xmult: 2 } : null)
	},
	{
		key: 'sweeper', name: 'Sweeper', rarity: 2, cost: 6, icon: 'clean_sweep',
		text: '+0.2 mult for each trick you win',
		score: (ctx) => (ctx.myTricks.length > 0 ? { mult: 0.2 * ctx.myTricks.length } : null)
	},
	{
		key: 'pickpocket', name: 'Pickpocket', rarity: 2, cost: 6, icon: 'coup',
		text: '+6 chips for each queen, king or ace you receive in the pass',
		score: (ctx) => ({ chips: 6 * ctx.received.filter((c) => c.rank >= 12).length })
	},
	{
		key: 'rainmaker', name: 'Rainmaker', rarity: 2, cost: 6, icon: 'rubber_baron',
		text: 'Earn $4 extra each time you win a board',
		v3: { text: 'Earn $3 extra each time you win a board' },
		onBoardWin: (_r, info) => ({ money: info.balance >= 3 ? 3 : 4 })
	},

	// ------------------------------------------------------------------ rare
	{
		key: 'moonstruck', name: 'Moonstruck', rarity: 3, cost: 8, icon: 'phantom_trick',
		text: 'Shooting the moon pays triple',
		moonX: 3
	},
	{
		key: 'half_moon', name: 'Half Moon', rarity: 3, cost: 7, icon: 'vulnerable',
		text: 'Taking every heart counts as shooting the moon, even without the queen',
		halfMoon: true
	},
	{
		key: 'collector', name: 'Collector', rarity: 3, cost: 9, icon: 'ace_collector',
		text: 'x1.1 for each point you take',
		v3: { text: 'x1.07 for each point you take' },
		score: (ctx) => (ctx.myPoints > 0 && dodging(ctx) ? { xmult: (ctx.balance >= 3 ? 1.07 : 1.1) ** ctx.myPoints } : null)
	},
	{
		key: 'queens_favor', name: "Queen's Favor", rarity: 3, cost: 8, icon: 'grand_design',
		text: 'Taking the queen of spades is worth +40 chips instead of costing you',
		score: (ctx) => (ctx.tookQueen && dodging(ctx) ? { chips: 40 + 13 } : null)
	},
	{
		key: 'night_owl', name: 'Night Owl', rarity: 3, cost: 9, icon: 'slam_hunter',
		text: 'Gains x0.5 every time you shoot the moon',
		describe: (r) => `Gains x0.5 every time you shoot the moon (now x${(1 + (r.state.x ?? 0)).toFixed(1)})`,
		onHandEnd: (ctx, r) => {
			if (ctx.shooter === H.PLAYER) r.state.x = (r.state.x ?? 0) + 0.5;
		},
		score: (_ctx, r) => ((r.state.x ?? 0) > 0 ? { xmult: 1 + r.state.x! } : null)
	},

	// ------------------------------------------------------------- legendary
	{
		key: 'house_rules', name: 'House Rules', rarity: 4, cost: 12, icon: 'milton_work',
		text: 'Base chips are doubled',
		baseX: 2
	},
	{
		key: 'full_moon', name: 'Full Moon', rarity: 4, cost: 13, icon: 'life_master',
		text: 'x1.5, and x1.5 again for every board already won at this table',
		v3: { text: 'x1.25, and x1.25 again for every board already won at this table' },
		score: (ctx) => ({ xmult: (ctx.balance >= 3 ? 1.25 : 1.5) ** (1 + ctx.boardsWonThisTable) })
	},

	// ============================================================ expansion
	// The iPad app's runs add these to the pool (RunOptions.moreRelics).

	// ---------------------------------------------------------------- common
	// Build-arounds (ruleset v5): relics that grow from one theme, and two
	// that scale over the run.
	{
		key: 'heartbreaker', name: 'Heartbreaker', rarity: 1, cost: 4, icon: 'heartbreaker', v5Only: true,
		text: '+4 chips for each heart you take',
		score: (ctx) => (ctx.heartsTaken > 0 ? { chips: 4 * ctx.heartsTaken } : null)
	},
	{
		key: 'black_suit', name: 'Black Suit', rarity: 1, cost: 5, icon: 'black_suit', v5Only: true,
		text: '+12 chips for each trick you win with a spade',
		score: (ctx) => {
			const n = ctx.myTricks.filter((t) => t.winningCard.suit === H.SPADES).length;
			return n ? { chips: 12 * n } : null;
		}
	},
	{
		key: 'snowball', name: 'Snowball', rarity: 2, cost: 7, icon: 'snowball', v5Only: true,
		text: 'Gains x0.05 mult every board you win',
		describe: (r) => `Gains x0.05 mult every board you win (now x${(1 + (r.state.wins ?? 0) * 0.05).toFixed(2)})`,
		onBoardWin: (r) => {
			r.state.wins = (r.state.wins ?? 0) + 1;
		},
		score: (_ctx, r) => ((r.state.wins ?? 0) > 0 ? { xmult: 1 + (r.state.wins ?? 0) * 0.05 } : null)
	},
	{
		key: 'ensemble', name: 'Ensemble', rarity: 2, cost: 6, icon: 'ensemble', v5Only: true,
		text: '+0.6 mult for each of your other common relics',
		score: (ctx) => ((ctx.commonRelics ?? 0) > 0 ? { mult: 0.6 * (ctx.commonRelics ?? 0) } : null)
	},
	{
		key: 'gallery', name: 'Gallery', rarity: 2, cost: 6, icon: 'gallery', v5Only: true,
		text: 'x1.2 mult for each card with an edition you play',
		score: (ctx) => ((ctx.editionsPlayed ?? 0) > 0 ? { xmult: 1.2 ** (ctx.editionsPlayed ?? 0) } : null)
	},
	{
		key: 'clean_streak', name: 'Clean Record', rarity: 3, cost: 8, icon: 'clean_streak', v5Only: true,
		text: 'Gains x0.25 mult for every clean hand, for the rest of the run',
		describe: (r) => `Gains x0.25 mult for every clean hand, for the rest of the run (now x${(1 + (r.state.streak ?? 0) * 0.25).toFixed(2)})`,
		onHandEnd: (ctx, r) => {
			if (ctx.myPoints === 0 && ctx.shooter === null) r.state.streak = (r.state.streak ?? 0) + 1;
		},
		score: (_ctx, r) => ((r.state.streak ?? 0) > 0 ? { xmult: 1 + (r.state.streak ?? 0) * 0.25 } : null)
	},
	{
		key: 'glass_deck', name: 'Glass Deck', rarity: 4, cost: 10, icon: 'kibitzer', v4Only: true,
		text: 'See the deck all hand, not just before the first trick, with the cards already played crossed off',
		seeDeck: true
	},
	// Clean top cards (ruleset v4): winning a trick with a high card that
	// holds no points, usually by leading it or covering a clean lead.
	{
		key: 'ace_of_spades', name: 'Ace of Spades', rarity: 1, cost: 4, icon: 'ace_of_spades', v4Only: true,
		text: '+40 chips if you win a trick with the ace of spades and it holds no points',
		score: (ctx) => (ctx.myTricks.some((t) => cleanWith(t, (c) => c.suit === H.SPADES && c.rank === 14)) ? { chips: 40 } : null)
	},
	{
		key: 'kings_ransom', name: "King's Ransom", rarity: 1, cost: 4, icon: 'kings_ransom', v4Only: true,
		text: '+30 chips if you win a trick with the king of spades and it holds no points',
		score: (ctx) => (ctx.myTricks.some((t) => cleanWith(t, (c) => c.suit === H.SPADES && c.rank === 13)) ? { chips: 30 } : null)
	},
	{
		key: 'clean_court', name: 'Clean Court', rarity: 1, cost: 5, icon: 'minor_nobility', v4Only: true,
		text: '+10 chips for each trick you win with a jack, queen or king that holds no points',
		score: (ctx) => {
			const n = ctx.myTricks.filter((t) => cleanWith(t, (c) => c.rank >= 11 && c.rank <= 13)).length;
			return n ? { chips: 10 * n } : null;
		}
	},
	{
		key: 'ace_high', name: 'Ace High', rarity: 2, cost: 6, icon: 'honour_roll', v4Only: true,
		text: '+0.75 mult for each trick you win with an ace that holds no points',
		score: (ctx) => {
			const n = ctx.myTricks.filter((t) => cleanWith(t, (c) => c.rank === 14)).length;
			return n ? { mult: 0.75 * n } : null;
		}
	},
	{
		key: 'bodyguard', name: 'Bodyguard', rarity: 3, cost: 8, icon: 'bodyguard', v4Only: true,
		text: 'x1.75 mult for each trick you win with the ace or king of spades that holds no points',
		score: (ctx) => {
			const n = ctx.myTricks.filter((t) => cleanWith(t, (c) => c.suit === H.SPADES && c.rank >= 13)).length;
			return n ? { xmult: 1.75 ** n } : null;
		}
	},
	{
		key: 'low_ball', name: 'Low Ball', rarity: 1, cost: 4, icon: 'low_ball', expansion: true,
		text: '+2 chips for each card under 6 still in your hand when you first take points',
		score: (ctx) => {
			const k = ctx.tricks.findIndex((t) => t.winner === H.PLAYER && t.points > 0);
			if (k < 0) return null;
			const left = ctx.tricks.slice(k + 1).filter((t) => myPlay(t).rank < 6).length;
			return left > 0 ? { chips: 2 * left } : null;
		}
	},
	{
		key: 'club_sandwich', name: 'Club Sandwich', rarity: 1, cost: 4, icon: 'club_sandwich', expansion: true,
		text: '+20 chips if you win the opening trick',
		score: (ctx) => (ctx.tricks[0]?.winner === H.PLAYER ? { chips: 20 } : null)
	},
	{
		key: 'diamond_mine', name: 'Diamond Mine', rarity: 1, cost: 5, icon: 'diamond_mine', expansion: true,
		text: '+3 chips for each diamond you win',
		score: (ctx) => {
			const n = ctx.taken.filter((c) => c.suit === H.DIAMONDS).length;
			return n > 0 ? { chips: 3 * n } : null;
		}
	},
	{
		key: 'spade_work', name: 'Spade Work', rarity: 1, cost: 4, icon: 'spade_work', expansion: true,
		text: '+4 chips for each spade below the queen you play on a spade trick',
		score: (ctx) => {
			const n = ctx.tricks.filter((t) => t.ledSuit === H.SPADES && myPlay(t).suit === H.SPADES && myPlay(t).rank < 12).length;
			return n > 0 ? { chips: 4 * n } : null;
		}
	},
	{
		key: 'second_chair', name: 'Second Chair', rarity: 1, cost: 5, icon: 'second_chair', expansion: true,
		text: '+10 chips for each trick you win playing second',
		score: (ctx) => {
			const n = ctx.tricks.filter((t) => t.plays[1]?.seat === H.PLAYER && t.winner === H.PLAYER).length;
			return n > 0 ? { chips: 10 * n } : null;
		}
	},
	{
		key: 'tip_jar', name: 'Tip Jar', rarity: 1, cost: 5, icon: 'tip_jar', expansion: true,
		text: 'Earn $1 for every two tricks you win that hold no points',
		score: (ctx) => {
			const n = Math.floor(ctx.myTricks.filter((t) => t.points === 0).length / 2);
			return n > 0 ? { money: n } : null;
		}
	},
	{
		key: 'lucky_seven', name: 'Lucky Seven', rarity: 1, cost: 4, icon: 'lucky_seven', expansion: true,
		text: '+7 chips for each seven you play',
		v3: { text: '+14 chips for each seven you play' },
		score: (ctx) => {
			const n = ctx.tricks.filter((t) => myPlay(t).rank === 7).length;
			return n > 0 ? { chips: (ctx.balance >= 3 ? 14 : 7) * n } : null;
		}
	},
	{
		key: 'wallflower', name: 'Wallflower', rarity: 1, cost: 4, icon: 'wallflower', expansion: true,
		text: '+25 chips if you win no tricks at all',
		score: (ctx) => (ctx.myTricks.length === 0 && ctx.tricks.length > 0 ? { chips: 25 } : null)
	},

	// -------------------------------------------------------------- uncommon
	{
		key: 'heart_surgeon', name: 'Heart Surgeon', rarity: 2, cost: 6, icon: 'heart_surgeon', expansion: true,
		text: '+1 mult if you take exactly one heart',
		score: (ctx) => (ctx.heartsTaken === 1 ? { mult: 1 } : null)
	},
	{
		key: 'slow_burn', name: 'Slow Burn', rarity: 2, cost: 6, icon: 'slow_burn', expansion: true,
		text: 'Gains +3 chips each hand; resets if you take the queen of spades',
		describe: (r) => `Gains +3 chips each hand; resets if you take the queen of spades (now +${r.state.chips ?? 0})`,
		onHandEnd: (ctx, r) => {
			r.state.chips = ctx.tookQueen ? 0 : (r.state.chips ?? 0) + 3;
		},
		score: (_ctx, r) => ((r.state.chips ?? 0) > 0 ? { chips: r.state.chips } : null)
	},
	{
		key: 'cold_feet', name: 'Cold Feet', rarity: 2, cost: 7, icon: 'cold_feet', expansion: true,
		text: 'x1.5 if hearts stay unbroken until the last three tricks',
		score: (ctx) => {
			const broke = ctx.tricks.findIndex((t) => t.plays.some((p) => p.card.suit === H.HEARTS || H.isQueenOfSpades(p.card)));
			return ctx.tricks.length > 3 && (broke < 0 || broke >= ctx.tricks.length - 3) ? { xmult: 1.5 } : null;
		}
	},
	{
		key: 'duck_hunter', name: 'Duck Hunter', rarity: 2, cost: 6, icon: 'duck_hunter', expansion: true,
		text: '+0.3 mult for each trick you duck under a higher card already played',
		score: (ctx) => {
			const n = ctx.tricks.filter((t) => {
				const i = t.plays.findIndex((p) => p.seat === H.PLAYER);
				const mine = t.plays[i].card;
				return t.winner !== H.PLAYER && mine.suit === t.ledSuit && t.plays.slice(0, i).some((p) => p.card.suit === t.ledSuit && p.card.rank > mine.rank);
			}).length;
			return n > 0 ? { mult: 0.3 * n } : null;
		}
	},
	{
		key: 'undertaker', name: 'Undertaker', rarity: 2, cost: 6, icon: 'undertaker', expansion: true,
		text: '+0.25 mult for each card burned from the pack',
		score: (ctx) => (ctx.cardsBurned > 0 ? { mult: 0.25 * ctx.cardsBurned } : null)
	},
	{
		key: 'wax_collector', name: 'Wax Collector', rarity: 2, cost: 6, icon: 'wax_collector', expansion: true,
		text: '+0.5 mult for each sealed card you win',
		score: (ctx) => (ctx.sealedTaken > 0 ? { mult: 0.5 * ctx.sealedTaken } : null)
	},
	{
		key: 'mint_condition', name: 'Mint Condition', rarity: 2, cost: 6, icon: 'mint_condition', expansion: true,
		text: '+0.25 mult for each of your relics with an edition',
		score: (ctx) => (ctx.editionCount > 0 ? { mult: 0.25 * ctx.editionCount } : null)
	},
	{
		key: 'interest_rate', name: 'Interest Rate', rarity: 2, cost: 7, icon: 'interest_rate', expansion: true,
		text: 'Interest can reach $8 instead of $5',
		v3: { text: 'Interest can reach $8 instead of $5, and earn $1 more each board' },
		interestCap: 8,
		onBoardWin: (_r, info) => (info.balance >= 3 ? { money: 1 } : undefined)
	},
	{
		key: 'bargain_bin', name: 'Bargain Bin', rarity: 2, cost: 6, icon: 'bargain_bin', expansion: true,
		text: 'Rerolls cost $1 less, and the first one in each club is free',
		bargain: true
	},
	{
		key: 'tailwind', name: 'Tailwind', rarity: 2, cost: 6, icon: 'tailwind', expansion: true,
		text: '+20 chips on the first hand of each board',
		score: (ctx) => (ctx.firstHandOfBoard ? { chips: 20 } : null)
	},

	// ------------------------------------------------------------------ rare
	{
		key: 'crown_jewels', name: 'Crown Jewels', rarity: 3, cost: 8, icon: 'crown_jewels', expansion: true,
		text: 'x1.5 for each king of hearts or queen of spades you pass',
		score: (ctx) => {
			const n = ctx.passed.filter((c) => (c.suit === H.HEARTS && c.rank === 13) || H.isQueenOfSpades(c)).length;
			return n > 0 ? { xmult: 1.5 ** n } : null;
		}
	},
	{
		key: 'clean_slate', name: 'Clean Slate', rarity: 3, cost: 8, icon: 'clean_slate', expansion: true,
		text: 'x2 if you take no points two hands in a row',
		v3: { text: 'x1.25 on a clean hand, x2 if the last hand was clean too' },
		describe: (r, b = 1) => `${b >= 3 ? 'x1.25 on a clean hand, x2 if the last hand was clean too' : 'x2 if you take no points two hands in a row'}${(r.state.streak ?? 0) > 0 ? ' (last hand was clean)' : ''}`,
		onHandEnd: (ctx, r) => {
			r.state.streak = ctx.myPoints === 0 && dodging(ctx) ? (r.state.streak ?? 0) + 1 : 0;
		},
		score: (ctx, r) => {
			if (ctx.myPoints !== 0 || !dodging(ctx)) return null;
			if ((r.state.streak ?? 0) >= 1) return { xmult: 2 };
			return ctx.balance >= 3 ? { xmult: 1.25 } : null;
		}
	},
	{
		key: 'comeback', name: 'Comeback', rarity: 3, cost: 8, icon: 'comeback', expansion: true,
		text: "x2 on a board's last hand if you're behind the goal",
		score: (ctx) => (ctx.lastHandOfBoard && ctx.behindGoal ? { xmult: 2 } : null)
	},
	{
		key: 'hot_potato', name: 'Hot Potato', rarity: 3, cost: 8, icon: 'hot_potato', expansion: true,
		text: 'x1.25 for each point card you pass that someone else takes',
		score: (ctx) => (ctx.passedPointsAway > 0 ? { xmult: 1.25 ** ctx.passedPointsAway } : null)
	},
	{
		key: 'boss_hunter', name: 'Boss Hunter', rarity: 3, cost: 9, icon: 'boss_hunter', expansion: true,
		text: 'x1.5 on boss boards, and beating a boss pays $2 more',
		score: (ctx) => (ctx.bossBoard ? { xmult: 1.5 } : null),
		onBoardWin: (_r, info) => (info.boss ? { money: 2 } : undefined)
	},
	{
		key: 'moonlighter', name: 'Moonlighter', rarity: 2, cost: 6, icon: 'moonlighter', expansion: true,
		text: 'Taking 13 or more points, short of the moon, scores as if you dodged them',
		moonlighter: true
	},
	{
		key: 'gilded_cage', name: 'Gilded Cage', rarity: 3, cost: 8, icon: 'gilded_cage', expansion: true,
		text: 'Earn $1 for each seal you own when you win a board',
		onBoardWin: (_r, info) => (info.seals > 0 ? { money: info.seals } : undefined)
	},
	{
		key: 'long_game', name: 'Long Game', rarity: 3, cost: 9, icon: 'long_game', expansion: true,
		text: 'Gains x0.03 for each board you win',
		describe: (r) => `Gains x0.03 for each board you win (now x${(1 + (r.state.x ?? 0)).toFixed(2)})`,
		onBoardWin: (r) => {
			r.state.x = (r.state.x ?? 0) + 0.03;
		},
		score: (_ctx, r) => ((r.state.x ?? 0) > 0 ? { xmult: 1 + r.state.x! } : null)
	},

	// ------------------------------------------------------------- legendary
	{
		key: 'the_fixer', name: 'The Fixer', rarity: 4, cost: 12, icon: 'the_fixer', expansion: true,
		text: 'The first heart you take each hand goes to the player with the most points',
		fixer: true
	},
	{
		key: 'shadow_moon', name: 'Shadow Moon', rarity: 4, cost: 12, icon: 'shadow_moon', expansion: true,
		text: 'Taking all but three or fewer points counts as shooting the moon',
		shadowMoon: true
	},
	{
		key: 'double_down', name: 'Double Down', rarity: 4, cost: 13, icon: 'double_down', expansion: true,
		text: "Your score for each board's last hand counts twice",
		score: (ctx) => (ctx.lastHandOfBoard ? { xmult: 2 } : null)
	},
	{
		key: 'card_counter', name: 'Card Counter', rarity: 4, cost: 11, icon: 'card_counter', expansion: true,
		text: 'See which suits each opponent is out of, and +0.25 mult for each void they show',
		cardCounter: true,
		score: (ctx) => (ctx.opponentVoids > 0 ? { mult: 0.25 * ctx.opponentVoids } : null)
	},
	{
		key: 'wildcard', name: 'Wildcard', rarity: 4, cost: 12, icon: 'wildcard', expansion: true,
		text: "Your first three cards each hand don't have to follow suit",
		wildcard: true
	},
	{
		key: 'collectors_album', name: "The Collector's Album", rarity: 4, cost: 11, icon: 'collectors_album', expansion: true,
		text: 'Takes no relic slot, and adds one',
		v3: { text: 'Takes no relic slot, and adds one; +0.2 mult for each relic you hold' },
		extraSlot: true,
		score: (ctx) => (ctx.balance >= 3 && ctx.relicCount > 0 ? { mult: 0.2 * ctx.relicCount } : null)
	}
];

export const BY_KEY: Record<string, RelicDef> = {};
for (const d of DEFS) BY_KEY[d.key] = d;

export function get(key: string): RelicDef | undefined {
	return BY_KEY[key];
}

export function instantiate(def: RelicDef, edition?: EditionKey, balance = 1): Relic {
	const cost = costAt(def, balance) + (edition ? EDITIONS[edition].cost : 0);
	return { key: def.key, def, name: def.name, cost, state: {}, ...(edition ? { edition } : {}) };
}

export function textFor(relic: Relic, balance = 1): string {
	return relic.def.describe ? relic.def.describe(relic, balance) : textAt(relic.def, balance);
}

/** Weighted rarity roll, never offering a relic you already own. */
/** Did you win this trick with a card like this, and does it hold no points? */
function cleanWith(t: Trick, card: (c: Card) => boolean): boolean {
	return t.points === 0 && card(t.winningCard);
}

export function randomUnowned(rng: RNG, owned: { key: string }[], expanded = false, v4 = false, v5 = false): RelicDef | undefined {
	const weights = [0.6, 0.3, 0.085, 0.015];
	const have = new Set(owned.map((o) => o.key));
	for (let attempt = 0; attempt < 40; attempt++) {
		const roll = rng.next();
		let acc = 0,
			rarity = 1;
		for (let r = 1; r <= 4; r++) {
			acc += weights[r - 1];
			if (roll <= acc) {
				rarity = r;
				break;
			}
		}
		const pool = DEFS.filter((d) => d.rarity === rarity && !have.has(d.key) && (expanded || !d.expansion) && (v4 || !d.v4Only) && (v5 || !d.v5Only));
		const pick = rng.pick(pool);
		if (pick) return pick;
	}
	return DEFS.find((d) => !have.has(d.key) && (expanded || !d.expansion));
}

void cards;
