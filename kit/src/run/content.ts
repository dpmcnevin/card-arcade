// Content every game shares: card editions and seals (enhanced cards),
// relic editions, bundles, tags for skipping boards, and starting decks.
// Games add their own seals, decks and bosses through their module.

import type { Card } from '../core/rules/cards.ts';
import type { RNG } from '../core/rules/rng.ts';
import type { Effect, Run } from './run.ts';

function weighted<K extends string>(rng: RNG, table: Record<K, { weight: number }>, fallback: K): K {
	let roll = rng.next();
	for (const k of Object.keys(table) as K[]) {
		roll -= table[k].weight;
		if (roll < 0) return k;
	}
	return fallback;
}

// ------------------------------------------------------------------ cards

/** A card as a hand played it, for editions and seals. */
export interface PlayedCard {
	card: Card;
	/** You (or a seat you play, like Bridge's dummy) played it. */
	mine: boolean;
	/** Your side won the trick it was in. */
	wonByUs: boolean;
	/** It was the card that won the trick. */
	winning: boolean;
}

export type CardEditionKey = 'etched' | 'lacquered' | 'prismatic';
export interface CardEditionDef {
	key: CardEditionKey;
	name: string;
	text: string;
	cost: number;
	effect: Effect;
	weight: number;
}
export const CARD_EDITIONS: Record<CardEditionKey, CardEditionDef> = {
	etched: { key: 'etched', name: 'Etched', text: '+15 chips when you play this card', cost: 3, effect: { chips: 15 }, weight: 0.45 },
	lacquered: { key: 'lacquered', name: 'Lacquered', text: '+1 mult when you play this card', cost: 4, effect: { mult: 1 }, weight: 0.35 },
	prismatic: { key: 'prismatic', name: 'Prismatic', text: 'x1.5 mult when you play this card', cost: 6, effect: { xmult: 1.5 }, weight: 0.2 }
};
export const rollCardEdition = (rng: RNG) => CARD_EDITIONS[weighted(rng, CARD_EDITIONS, 'etched')];

/** A seal on a card: what it does when the card is played in a trick. */
export interface SealDef {
	key: string;
	name: string;
	/** One letter for the wax badge. */
	glyph: string;
	color: string;
	cost: number;
	text: string;
	onPlayed?: (p: PlayedCard, run: Run) => Effect | null;
	/** Homing: always dealt to you (see homing()). */
	homing?: boolean;
}
export const SEALS: SealDef[] = [
	{ key: 'gilded', name: 'Gilded Seal', glyph: 'G', color: '#d9a441', cost: 4, text: 'Earn $2 each time you win a trick with this card in it', onPlayed: (p) => (p.mine && p.wonByUs ? { money: 2 } : null) },
	{ key: 'crown', name: 'Crown Seal', glyph: 'C', color: '#7a4fc1', cost: 5, text: '+0.5 mult each time this card wins a trick for you', onPlayed: (p) => (p.mine && p.winning ? { mult: 0.5 } : null) },
	{ key: 'homing', name: 'Homing Seal', glyph: 'H', color: '#c8323c', cost: 4, text: 'This card is always dealt to you', homing: true }
];

/** What's on a card in the run's pack. */
export interface CardMod {
	edition?: CardEditionKey;
	seal?: string;
}
export const modKey = (c: Card) => String(c.id ?? `${c.suit}-${c.rank}`);

// ------------------------------------------------------------------ relics

export type RelicEditionKey = 'etched' | 'lacquered' | 'prismatic' | 'phantom';
export interface RelicEditionDef {
	key: RelicEditionKey;
	name: string;
	text: string;
	cost: number;
	/** Every hand; Phantom's gift is the slot instead. */
	effect: Effect | null;
	weight: number;
}
export const RELIC_EDITIONS: Record<RelicEditionKey, RelicEditionDef> = {
	etched: { key: 'etched', name: 'Etched', text: '+10 chips every hand', cost: 3, effect: { chips: 10 }, weight: 0.4 },
	lacquered: { key: 'lacquered', name: 'Lacquered', text: '+0.5 mult every hand', cost: 4, effect: { mult: 0.5 }, weight: 0.3 },
	prismatic: { key: 'prismatic', name: 'Prismatic', text: 'x1.25 mult every hand', cost: 6, effect: { xmult: 1.25 }, weight: 0.2 },
	phantom: { key: 'phantom', name: 'Phantom', text: 'Takes no relic slot', cost: 5, effect: null, weight: 0.1 }
};
/** Chance a relic in the club comes with an edition. */
export const RELIC_EDITION_CHANCE = 0.08;
export function rollRelicEdition(rng: RNG): RelicEditionKey | undefined {
	if (rng.next() >= RELIC_EDITION_CHANCE) return undefined;
	return weighted(rng, RELIC_EDITIONS, 'etched');
}

// ------------------------------------------------------------------ club

export type BundleKey = 'relic' | 'ploy' | 'edition';
export interface BundleDef {
	key: BundleKey;
	name: string;
	text: string;
	cost: number;
	icon: string;
	weight: number;
}
export const BUNDLES: Record<BundleKey, BundleDef> = {
	relic: { key: 'relic', name: 'Relic Bundle', text: 'Open it and choose one of three relics', cost: 6, icon: 'bundle_relic', weight: 0.45 },
	ploy: { key: 'ploy', name: 'Ploy Bundle', text: 'Open it and choose one of three ploys', cost: 4, icon: 'bundle_ploy', weight: 0.3 },
	edition: { key: 'edition', name: 'Edition Bundle', text: 'Open it and choose one of three cards to get an edition', cost: 5, icon: 'bundle_edition', weight: 0.25 }
};
export const rollBundle = (rng: RNG) => BUNDLES[weighted(rng, BUNDLES, 'relic')];

// ------------------------------------------------------------------ tags

export type TagKey = 'bundle' | 'interest' | 'reroll' | 'ploy' | 'edition' | 'cash';
export interface TagDef {
	key: TagKey;
	name: string;
	text: string;
	icon: string;
}
export const TAGS: Record<TagKey, TagDef> = {
	bundle: { key: 'bundle', name: 'Free Bundle', text: 'The next club has a free Relic Bundle', icon: 'bundle_relic' },
	interest: { key: 'interest', name: 'Double Interest', text: 'Double interest at the next payout', icon: 'interest_rate' },
	reroll: { key: 'reroll', name: 'Free Rerolls', text: 'Rerolls are free in the next club', icon: 'redeal' },
	ploy: { key: 'ploy', name: 'Free Ploy', text: 'A ploy now (or $3 if your ploys are full)', icon: 'bundle_ploy' },
	edition: { key: 'edition', name: 'Edition', text: 'A random card in your pack gets an edition', icon: 'bundle_edition' },
	cash: { key: 'cash', name: 'Cash', text: 'Gain $8 now', icon: 'tip_jar' }
};
export const TAG_KEYS = Object.keys(TAGS) as TagKey[];

// ------------------------------------------------------------------ pack items

/** Club items that change a card in the pack for good (games whose pack
 *  can change size and ranks opt in with GameModule.packOps). */
export type PackOpKey = 'burn' | 'recolor' | 'promote' | 'copy';
export interface PackOpDef {
	key: PackOpKey;
	name: string;
	text: string;
	cost: number;
	icon: string;
	/** The suit a Recolor turns a card into. */
	suit?: number;
}
const SUIT_NAME: Record<number, [string, string]> = { 1: ['Clubs', 'club'], 2: ['Diamonds', 'diamond'], 3: ['Hearts', 'heart'], 4: ['Spades', 'spade'] };
export const PACK_OPS: Record<Exclude<PackOpKey, 'recolor'>, PackOpDef> = {
	burn: { key: 'burn', name: 'Burn', text: 'Remove a card from the pack for good', cost: 4, icon: 'redeal' },
	promote: { key: 'promote', name: 'Promote', text: 'Raise a card one rank (a two becomes a three)', cost: 3, icon: 'promotion' },
	copy: { key: 'copy', name: 'Copy', text: 'Add a duplicate of a card to the pack', cost: 4, icon: 'vanderbilt' }
};
export function recolorDef(suit: number): PackOpDef {
	return { key: 'recolor', name: `Recolor: ${SUIT_NAME[suit][0]}`, text: `Turn a card into a ${SUIT_NAME[suit][1]} of the same rank`, cost: 3, suit, icon: 'transfer' };
}
export function rollPackOp(rng: RNG): PackOpDef {
	const r = rng.next();
	if (r < 0.35) return recolorDef(rng.int(1, 4));
	if (r < 0.6) return PACK_OPS.burn;
	if (r < 0.8) return PACK_OPS.promote;
	return PACK_OPS.copy;
}

// ------------------------------------------------------------------ decks

/** A starting deck: a choice on the menu that changes how a run begins. */
export interface DeckDef {
	key: string;
	name: string;
	text: string;
	/** The card back it's drawn with (pixelcards back styles). */
	back: string;
	apply?: (run: Run) => void;
}
