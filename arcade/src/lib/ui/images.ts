// Card and icon art as image URLs, rasterised once per card and cached.

import * as cards from '$kit/src/core/rules/cards.ts';
import type { Card } from '$kit/src/core/rules/cards.ts';
import * as pixelcards from '$kit/src/core/ui/pixelcards.ts';
import * as icons from '$kit/src/core/ui/icons.ts';
import { toCanvas } from '$kit/src/core/ui/pixel.ts';
import { sealBitmap } from '$kit/src/core/ui/sealart.ts';
import { settings } from '../settings.svelte.ts';
import * as cardart from '$kit/src/core/ui/cardart.ts';
import { CARD_H, CARD_W } from '$kit/src/core/ui/theme.ts';

/** A smooth card drawn with canvas 2D, supersampled for any screen. */
function smooth(draw: (g: CanvasRenderingContext2D) => void, px: number): string {
	const k = Math.max(2, px);
	const canvas = document.createElement('canvas');
	canvas.width = Math.round((CARD_W * k) / 2);
	canvas.height = Math.round((CARD_H * k) / 2);
	const g = canvas.getContext('2d')!;
	g.scale(k / 2, k / 2);
	g.translate(CARD_W / 2, CARD_H / 2);
	draw(g);
	return canvas.toDataURL();
}

const cache = new Map<string, string>();

/** Device pixels per stage pixel. Card art (40x56) is rasterised at a
 *  whole multiple, and each card is drawn at a size where that multiple
 *  lands on whole device pixels: every art pixel the same size, crisp. */
let K = 1;
const SCALE = 6;
export function setDeviceScale(stageToDevice: number) {
	K = stageToDevice;
}
/** Whole device pixels per art pixel for a card drawn at `s` (x80px). */
export function artPixels(s: number): number {
	return Math.max(1, Math.round(2 * s * K));
}
/** The card size scale that `artPixels(s)` lands exactly on. */
export function snap(s: number): number {
	return artPixels(s) / (2 * K);
}

function cached(key: string, build: () => string): string {
	let u = cache.get(key);
	if (!u) cache.set(key, (u = build()));
	return u;
}

export function cardFace(card: Card, trump = false, px = SCALE): string {
	const four = settings.fourColor;
	if (!settings.pixel) return cached(`s|${cards.code(card)}|${trump}|${px}|${four}`, () => smooth((g) => cardart.face(g, card, trump, four), px));
	return cached(`${cards.code(card)}|${trump}|${px}|${four}`, () => toCanvas(pixelcards.faceBitmap(card, trump, four), px).toDataURL());
}

export function cardBack(deck = 'standard', px = SCALE): string {
	if (!settings.pixel) return cached(`s|back|${deck}|${px}`, () => smooth((g) => cardart.back(g, deck), px));
	return cached(`back|${deck}|${px}`, () => toCanvas(pixelcards.backBitmap(deck), px).toDataURL());
}

export function icon(key: string): string {
	return cached(`icon|${key}`, () => toCanvas(icons.bitmap(key), 8).toDataURL());
}

export function seal(glyph: string, color: string): string {
	return cached(`seal|${glyph}|${color}`, () => toCanvas(sealBitmap(glyph, color), 8).toDataURL());
}
