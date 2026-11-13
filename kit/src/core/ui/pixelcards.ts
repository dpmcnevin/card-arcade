// Pixel-art versions of the art deco cards. Port of src/ui/pixelcards.lua.
//
// Each card is a 40x56 bitmap built from hand-drawn sprites and drawn at an
// integer scale with nearest-neighbour filtering. The palette and suit
// colors live here too (they were in cardart.lua), so both card styles
// share them.

import * as cards from '../rules/cards.ts';
import type { Card } from '../rules/cards.ts';
import { newBitmap, type Bitmap } from './pixel.ts';
import * as S from './pixelsprites.ts';
import { hex, type Color } from './theme.ts';

export const W = 40;
export const H = 56;

export const P = {
	cream: hex('#f3ead6'),
	trumpCream: hex('#f6e3a8'),
	creamDeep: hex('#e6d9bc'),
	ink: hex('#1b1d26'),
	gold: hex('#c9a24a'),
	goldLight: hex('#e8c873'),
	goldDeep: hex('#8f6d27'),
	wine: hex('#5e1a26'),
	wineLight: hex('#7c2634'),
	wineDeep: hex('#3f1019')
};
export type Palette = typeof P;

const TWO: Record<number, Color> = {
	1: hex('#1b1d26'),
	2: hex('#c8323c'),
	3: hex('#c8323c'),
	4: hex('#1b1d26'),
	5: hex('#2c3f8c')
};
// The four-color deck many bridge players prefer: suits never get confused.
const FOUR: Record<number, Color> = {
	1: hex('#23804e'),
	2: hex('#d9771f'),
	3: hex('#c8323c'),
	4: hex('#1b1d26'),
	5: hex('#2c3f8c')
};

export function suitColor(suit: number, fourColor: boolean): Color {
	return (fourColor ? FOUR : TWO)[suit];
}

// --------------------------------------------------------------------- helpers

/** Big suit shapes rasterised from geometry (for aces). */
function bigSuit(b: Bitmap, suit: number, cx: number, cy: number, size: number, color: Color) {
	const s = size / 2;
	if (suit === cards.DIAMONDS) {
		b.fillPoly([cx, cy - s, cx + s * 0.75, cy, cx, cy + s, cx - s * 0.75, cy], color);
	} else if (suit === cards.HEARTS) {
		const r = s * 0.52;
		b.fillCircle(cx - r * 0.95, cy - s * 0.3, r, color);
		b.fillCircle(cx + r * 0.95, cy - s * 0.3, r, color);
		b.fillPoly([cx - s, cy - s * 0.15, cx + s, cy - s * 0.15, cx, cy + s], color);
	} else if (suit === cards.SPADES) {
		const r = s * 0.5;
		b.fillCircle(cx - r * 0.95, cy + s * 0.18, r, color);
		b.fillCircle(cx + r * 0.95, cy + s * 0.18, r, color);
		b.fillPoly([cx - s * 0.98, cy + s * 0.08, cx + s * 0.98, cy + s * 0.08, cx, cy - s], color);
		b.fillPoly([cx, cy + s * 0.2, cx - s * 0.4, cy + s, cx + s * 0.4, cy + s], color);
	} else {
		// Three full lobes that just overlap (a solid three-leaf shape with
		// notches between the leaves), on a short flared stem.
		const r = s * 0.46;
		b.fillCircle(cx, cy - s * 0.5, r, color);
		b.fillCircle(cx - s * 0.52, cy + s * 0.16, r, color);
		b.fillCircle(cx + s * 0.52, cy + s * 0.16, r, color);
		b.fillRect(Math.round(cx - 1), Math.round(cy), 2, Math.round(s * 0.8), color);
		b.fillPoly([cx, cy + s * 0.5, cx - s * 0.42, cy + s, cx + s * 0.42, cy + s], color);
	}
}

function body(b: Bitmap, fill: Color) {
	b.fillRect(1, 1, W - 2, H - 2, fill);
	// Outline with clipped corners.
	b.fillRect(2, 0, W - 4, 1, P.ink);
	b.fillRect(2, H - 1, W - 4, 1, P.ink);
	b.fillRect(0, 2, 1, H - 4, P.ink);
	b.fillRect(W - 1, 2, 1, H - 4, P.ink);
	b.set(1, 1, P.ink);
	b.set(W - 2, 1, P.ink);
	b.set(1, H - 2, P.ink);
	b.set(W - 2, H - 2, P.ink);
}

// Pip layouts: column -1..1 and row -1..1.
export const LAYOUTS: Record<number, [number, number][]> = {
	2: [[0, -1], [0, 1]],
	3: [[0, -1], [0, 0], [0, 1]],
	4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
	5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
	6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
	7: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [-1, 1], [1, 1]],
	8: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [0, 0.5], [-1, 1], [1, 1]],
	9: [[-1, -1], [1, -1], [-1, -1 / 3], [1, -1 / 3], [0, 0], [-1, 1 / 3], [1, 1 / 3], [-1, 1], [1, 1]],
	10: [[-1, -1], [1, -1], [0, -2 / 3], [-1, -1 / 3], [1, -1 / 3], [-1, 1 / 3], [1, 1 / 3], [0, 2 / 3], [-1, 1], [1, 1]]
};

// --------------------------------------------------------------------- builders

// ------------------------------------------------------------ faces, at 2x
//
// Faces are drawn at twice the old resolution (80x112), so an art pixel is
// half as big on screen: a fine index, smooth pips drawn from geometry, a
// thin outline and no gold frame (that marks trumps). Courts reuse their
// bold sprites at double size.

export const FW = 80;
export const FH = 112;

// The index font: 7x11, bold two-pixel stems with one-pixel curves, drawn at
// the faces' own pixel size ("10" is 11 wide).
const RANK11: Record<number, string[]> = {
	2: ['.#####.', '##...##', '.....##', '.....##', '....##.', '...##..', '..##...', '.##....', '##.....', '##.....', '#######'],
	3: ['.#####.', '##...##', '.....##', '.....##', '..####.', '.....##', '.....##', '.....##', '##...##', '##...##', '.#####.'],
	4: ['....##.', '...###.', '..####.', '.##.##.', '##..##.', '##..##.', '#######', '....##.', '....##.', '....##.', '....##.'],
	5: ['#######', '##.....', '##.....', '######.', '.....##', '.....##', '.....##', '.....##', '##...##', '##...##', '.#####.'],
	6: ['..####.', '.##....', '##.....', '##.....', '######.', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
	7: ['#######', '.....##', '.....##', '....##.', '....##.', '...##..', '...##..', '..##...', '..##...', '..##...', '..##...'],
	8: ['.#####.', '##...##', '##...##', '##...##', '.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
	9: ['.#####.', '##...##', '##...##', '##...##', '##...##', '.######', '.....##', '.....##', '.....##', '....##.', '.####..'],
	10: ['.##..#####.', '###.##...##', '.##.##...##', '.##.##...##', '.##.##...##', '.##.##...##', '.##.##...##', '.##.##...##', '.##.##...##', '.##.##...##', '###..#####.'],
	11: ['...####', '.....##', '.....##', '.....##', '.....##', '.....##', '.....##', '.....##', '##...##', '##...##', '.#####.'],
	12: ['.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##.#.##', '##..##.', '.##.##.', '..##.##'],
	13: ['##...##', '##..##.', '##.##..', '####...', '###....', '###....', '####...', '##.##..', '##..##.', '##...##', '##...##'],
	14: ['..###..', '.##.##.', '##...##', '##...##', '##...##', '#######', '#######', '##...##', '##...##', '##...##', '##...##'],
	// Tarot: the 1, and the knight (cavalier)
	1: ['..##...', '.###...', '..##...', '..##...', '..##...', '..##...', '..##...', '..##...', '..##...', '..##...', '.####..'],
	15: ['.#####.', '##...##', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##...##', '.#####.']
};

/** Digits for numbers (Tarot's trumps), in the index font. */
const DIGIT: Record<number, string[]> = {
	0: ['.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
	1: ['..##.', '.###.', '..##.', '..##.', '..##.', '..##.', '..##.', '..##.', '..##.', '..##.', '.####'],
	2: RANK11[2], 3: RANK11[3], 4: RANK11[4], 5: RANK11[5], 6: RANK11[6], 7: RANK11[7], 8: RANK11[8], 9: RANK11[9]
};
/** A number as one sprite: digits side by side, a pixel apart. */
function numberSprite(n: number): string[] {
	const ds = String(n).split('').map((d) => DIGIT[+d]);
	return ds[0].map((_, row) => ds.map((d) => d[row].padEnd(d[0].length, '.')).join('.'));
}
const STAR7 = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];

/** Stamp a sprite at k times its size. */
function stamp(b: Bitmap, rows: string[], pal: Record<string, Color>, x: number, y: number, k: number) {
	rows.forEach((row, j) => {
		for (let i = 0; i < row.length; i++) {
			const c = pal[row[i]];
			if (c) b.fillRect(x + i * k, y + j * k, k, k, c);
		}
	});
}

function body2(b: Bitmap, fill: Color) {
	b.fillRect(1, 1, FW - 2, FH - 2, fill);
	// A thin outline with rounded corners.
	b.fillRect(3, 0, FW - 6, 1, P.ink);
	b.fillRect(3, FH - 1, FW - 6, 1, P.ink);
	b.fillRect(0, 3, 1, FH - 6, P.ink);
	b.fillRect(FW - 1, 3, 1, FH - 6, P.ink);
	for (const [x, y] of [[1, 2], [2, 1], [FW - 2, 2], [FW - 3, 1], [1, FH - 3], [2, FH - 2], [FW - 2, FH - 3], [FW - 3, FH - 2]]) b.set(x, y, P.ink);
	for (const [x, y] of [[1, 1], [FW - 2, 1], [1, FH - 2], [FW - 2, FH - 2]]) b.clear(x, y);
}

function index2(b: Bitmap, card: Card, color: Color) {
	const glyph = RANK11[card.rank];
	const gw = glyph[0].length;
	const pal = S.solid(color);
	// The suit under the rank.
	const sx = 4;
	b.sprite(glyph, pal, 4, 5);
	b.sprite(S.SUIT7[card.suit], pal, sx, 18);
	b.sprite(glyph, pal, FW - 4 - gw, FH - 5 - 11, { flip: true });
	b.sprite(S.SUIT7[card.suit], pal, FW - sx - 7, FH - 18 - 7, { flip: true });
}

// Hand-drawn pips for the 2x faces (geometry this small comes out lumpy).
const PIP: Record<number, string[]> = {
	// clubs: three round lobes, notched apart, on a flared stem
	1: ['....###....', '...#####...', '...#####...', '...#####...', '....###....', '.###.#.###.', '###########', '###########', '###########', '.###.#.###.', '....###....', '...#####...'],
	// diamonds
	2: ['....#....', '...###...', '...###...', '..#####..', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '..#####..', '...###...', '...###...', '....#....'],
	// hearts
	3: ['.###...###.', '#####.#####', '###########', '###########', '###########', '.#########.', '..#######..', '...#####...', '....###....', '.....#.....'],
	// spades
	4: ['.....#.....', '....###....', '...#####...', '..#######..', '.#########.', '###########', '###########', '###########', '.###.#.###.', '.....#.....', '....###....', '...#####...']
};

function pip(b: Bitmap, suit: number, cx: number, cy: number, color: Color) {
	const rows = PIP[suit];
	b.sprite(rows, S.solid(color), Math.round(cx - rows[0].length / 2), Math.round(cy - rows.length / 2));
}

function pips2(b: Bitmap, card: Card, color: Color) {
	for (const p of LAYOUTS[card.rank]) bigSuit(b, card.suit, 40 + p[0] * 18, 57 + p[1] * 31, card.suit === cards.SPADES ? 18 : 17, color);
}

function ace2(b: Bitmap, card: Card, color: Color) {
	const cx = 40,
		cy = 56;
	const n = 16;
	for (let i = 0; i < n; i++) {
		const a0 = (i / n) * Math.PI * 2;
		const a1 = ((i + 1) / n) * Math.PI * 2;
		b.fillPoly([cx, cy, cx + Math.cos(a0) * 28, cy + Math.sin(a0) * 28, cx + Math.cos(a1) * 28, cy + Math.sin(a1) * 28], i % 2 === 0 ? P.gold : P.goldLight);
	}
	b.fillCircle(cx, cy, 21, P.gold);
	b.fillCircle(cx, cy, 19, P.cream);
	bigSuit(b, card.suit, cx, cy, card.suit === cards.SPADES ? 27 : 25, color);
}

function court2(b: Bitmap, card: Card, color: Color) {
	const tint: Color = [
		P.cream[0] + (color[0] - P.cream[0]) * 0.18,
		P.cream[1] + (color[1] - P.cream[1]) * 0.18,
		P.cream[2] + (color[2] - P.cream[2]) * 0.18,
		1
	];
	const mask = new Set<number>();
	const mark = (x: number, y: number, w: number, h: number) => {
		for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) mask.add(j * 1000 + i);
	};
	mark(20, 32, 40, 58);
	mark(24, 28, 32, 4);
	mark(28, 24, 24, 4);
	for (const key of mask) b.set(key % 1000, Math.floor(key / 1000), tint);
	for (const key of mask) {
		const x = key % 1000,
			y = Math.floor(key / 1000);
		if (!(mask.has((y - 1) * 1000 + x) && mask.has((y + 1) * 1000 + x) && mask.has(y * 1000 + x - 1) && mask.has(y * 1000 + x + 1))) b.set(x, y, P.gold);
	}
	stamp(b, S.CREST[card.rank], { g: P.gold, G: P.goldLight, r: color }, 31, 30, 2);
	b.sprite(RANK11[card.rank], S.solid(color), 37, 46);
	pip(b, card.suit, 40, 76, color);
	for (const x of [26, 32, 47, 53]) b.fillRect(x, 83, 1, 5, P.goldLight);
}

function trumpMark2(b: Bitmap) {
	b.rect(2, 2, FW - 4, FH - 4, P.gold);
	b.rect(3, 3, FW - 6, FH - 6, P.goldLight);
	b.fillPoly([1, FH - 24, 1, FH - 1, 24, FH - 1], P.goldDeep);
	b.fillPoly([1, FH - 21, 1, FH - 1, 21, FH - 1], P.goldLight);
	const sx = 5,
		sy = FH - 11;
	b.fillRect(sx + 2, sy, 1, 5, P.ink);
	b.fillRect(sx, sy + 2, 5, 1, P.ink);
	b.fillRect(sx + 1, sy + 1, 3, 3, P.ink);
}

// ------------------------------------------------------------ Tarot trumps
//
// Double-ended, like the real cards: a little scene drawn from the trump's
// number (a sky, the ground, something on the horizon, a few figures),
// mirrored top and bottom, between two bands of grey ornament holding the
// number. The oudlers (1 and 21) are trimmed in gold. The Excuse is a
// jester's hat over a star.

const SKIES = [hex('#f2b46a'), hex('#7fb8e0'), hex('#b07ab8'), hex('#2b3566'), hex('#cfe3ea'), hex('#e88a5a')];
const GROUNDS = [hex('#6aa84f'), hex('#93c47d'), hex('#e0c27a'), hex('#3d7fb8'), hex('#a8743e'), hex('#4f8a5a')];
const CLOTHES = [hex('#c8323c'), hex('#2c5fa8'), hex('#e0a42a'), hex('#5a8a3a'), hex('#7a4fc1'), hex('#1b1d26'), hex('#d9771f')];
const SKIN = hex('#e8b98a'),
	WOOD = hex('#7a4a22'),
	LEAF = hex('#2f6b34'),
	STONE = hex('#8a8f9a'),
	SNOW = hex('#f3ead6'),
	ROOF = hex('#a8432f'),
	WALL = hex('#e6d2a8'),
	SUN = hex('#f6d34a'),
	GREY = hex('#c9c6bd'),
	GREY_D = hex('#8c887e');

/** A small seeded random for scenes (the same trump always looks the same). */
function sceneRng(n: number) {
	let x = (n * 2654435761) >>> 0 || 1;
	return () => ((x = (x * 1103515245 + 12345) >>> 0), x / 4294967296);
}

/** Draw trump n's scene into a w x h bitmap. */
function scene(n: number, w: number, h: number): Bitmap {
	const b = newBitmap(w, h);
	const r = sceneRng(n * 7 + 3);
	const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
	const sky = n === 21 ? hex('#f6d98a') : SKIES[n % SKIES.length];
	const night = sky === SKIES[3];
	const ground = GROUNDS[(n * 5) % GROUNDS.length];
	const water = ground === GROUNDS[3];
	const horizon = Math.round(h * (0.5 + r() * 0.15));
	b.fillRect(0, 0, w, horizon, sky);
	b.fillRect(0, horizon, w, h - horizon, ground);
	// A darker band of ground near the horizon, for depth.
	b.fillRect(0, horizon, w, 2, [ground[0] * 0.85, ground[1] * 0.85, ground[2] * 0.85, 1]);
	if (n === 21) {
		// The world: a sunburst over everything.
		for (let i = 0; i < 12; i += 2) {
			const a0 = Math.PI + (i / 12) * Math.PI,
				a1 = Math.PI + ((i + 1) / 12) * Math.PI;
			b.fillPoly([w / 2, horizon, w / 2 + Math.cos(a0) * 60, horizon + Math.sin(a0) * 60, w / 2 + Math.cos(a1) * 60, horizon + Math.sin(a1) * 60], hex('#f2c14e'));
		}
	}
	// The sky: a sun, or a moon and stars at night.
	const sx = 6 + Math.floor(r() * (w - 12));
	if (night) {
		b.fillCircle(sx, 6, 3.5, SNOW);
		b.fillCircle(sx + 2, 5, 3, sky);
		for (let i = 0; i < 6; i++) b.set(Math.floor(r() * w), Math.floor(r() * (horizon - 4)), SNOW);
	} else if (r() < 0.6) {
		b.fillCircle(sx, 6, 3.5, SUN);
	}
	// On the horizon: one or two of a house, a tree, a mountain, a castle.
	const things = water ? ['boat', 'boat'] : ['house', 'tree', 'mountain', 'castle', 'tree'];
	const count = 1 + Math.floor(r() * 2);
	for (let i = 0; i < count; i++) {
		const kind = pick(things);
		const x = Math.floor(((i + 0.5 + (r() - 0.5) * 0.6) / count) * w);
		const g = horizon + 1;
		if (kind === 'house') {
			b.fillRect(x - 5, g - 7, 10, 7, WALL);
			b.fillPoly([x - 7, g - 7, x + 7, g - 7, x, g - 13], ROOF);
			b.fillRect(x - 1, g - 4, 2, 4, WOOD);
		} else if (kind === 'tree') {
			b.fillRect(x - 1, g - 6, 2, 6, WOOD);
			b.fillCircle(x, g - 9, 4.5, LEAF);
		} else if (kind === 'mountain') {
			b.fillPoly([x - 12, g, x + 12, g, x, g - 16], STONE);
			b.fillPoly([x - 3.5, g - 11, x + 3.5, g - 11, x, g - 16], SNOW);
		} else if (kind === 'castle') {
			b.fillRect(x - 7, g - 10, 14, 10, STONE);
			for (let k = -7; k < 7; k += 4) b.fillRect(x + k, g - 12, 2, 2, STONE);
			b.fillRect(x - 1, g - 5, 2, 5, hex('#3a3a44'));
			b.fillRect(x + 5, g - 17, 1, 5, WOOD);
			b.fillRect(x + 6, g - 17, 3, 2, ROOF);
		} else {
			b.fillPoly([x - 8, g - 2, x + 8, g - 2, x + 5, g + 2, x - 5, g + 2], WOOD);
			b.fillRect(x, g - 12, 1, 10, WOOD);
			b.fillPoly([x + 1, g - 12, x + 1, g - 3, x + 7, g - 3], SNOW);
		}
	}
	// In front: a few people (the cards are full of them).
	const people = n === 1 ? 1 : 1 + Math.floor(r() * 3);
	for (let i = 0; i < people; i++) {
		const x = Math.floor(((i + 0.5) / people) * w + (r() - 0.5) * 6);
		const y = h - 3 - Math.floor(r() * Math.max(1, h - horizon - 13));
		const coat = pick(CLOTHES);
		b.fillRect(x - 1, y - 11, 3, 3, SKIN);
		b.fillRect(x - 2, y - 8, 5, 6, coat);
		b.fillRect(x - 2, y - 2, 2, 3, hex('#3a2a20'));
		b.fillRect(x + 1, y - 2, 2, 3, hex('#3a2a20'));
		if (r() < 0.5) b.fillRect(x - 2, y - 12, 5, 1, pick(CLOTHES)); // a hat
	}
	return b;
}

/** The grey ornament band, with the number in a cream box at one end. */
function band(b: Bitmap, y: number, h: number, num: string[], numLeft: boolean, color: Color) {
	for (let j = 0; j < h; j++)
		for (let i = 3; i < FW - 3; i++) {
			// A small lattice, like engraved scrollwork.
			const on = (i + j) % 4 === 0 || (i - j + 400) % 4 === 0;
			b.set(i, y + j, on ? GREY_D : GREY);
		}
	const nw = num[0].length;
	const bx = numLeft ? 4 : FW - 6 - nw;
	b.fillRect(bx - 1, y + 1, nw + 3, h - 2, P.cream);
	b.sprite(num, S.solid(color), bx, y + Math.floor((h - num.length) / 2), { flip: !numLeft });
}

function tarotTrump(b: Bitmap, card: Card, color: Color) {
	const pal = S.solid(color);
	if (card.rank === cards.EXCUSE) {
		// A jester's hat, three points with bells, over a star.
		const hat = [hex('#c8323c'), hex('#2c5fa8'), hex('#e0a42a')];
		b.fillPoly([24, 54, 56, 54, 52, 46, 28, 46], hex('#e0a42a'));
		b.fillPoly([28, 47, 34, 47, 18, 22], hat[0]);
		b.fillPoly([36, 47, 44, 47, 40, 18], hat[1]);
		b.fillPoly([46, 47, 52, 47, 62, 22], hat[0]);
		for (const [x, y] of [[18, 22], [40, 18], [62, 22]]) b.fillCircle(x, y, 2.5, SUN);
		void hat;
		const pts: number[] = [];
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + (i * Math.PI) / 5,
				rr = i % 2 === 0 ? 13 : 5.5;
			pts.push(40 + Math.cos(a) * rr, 74 + Math.sin(a) * rr);
		}
		b.fillPoly(pts, color);
		b.sprite(STAR7, pal, 4, 5);
		b.sprite(STAR7, pal, FW - 4 - 7, FH - 5 - 7, { flip: true });
		return;
	}
	const num = numberSprite(card.rank);
	const top = 3,
		bandH = 14,
		sy = top + bandH + 1,
		sh = Math.floor((FH - 2 * (top + bandH + 1) - 1) / 2);
	band(b, top, bandH, num, true, color);
	band(b, FH - top - bandH, bandH, num, false, color);
	// The scene, and its mirror below.
	const sc = scene(card.rank, FW - 6, sh);
	for (let y = 0; y < sh; y++)
		for (let x = 0; x < FW - 6; x++) {
			const c = sc.get(x, y);
			if (!c) continue;
			b.set(3 + x, sy + y, c);
			b.set(FW - 4 - x, sy + 2 * sh - y, c);
		}
	b.fillRect(3, sy + sh, FW - 6, 1, P.ink);
	if (card.rank === 1 || card.rank === 21) {
		b.rect(2, 2, FW - 4, FH - 4, P.gold);
		b.rect(3, sy - 1, FW - 6, 2 * sh + 3, P.goldLight);
	}
}

/** The gold sunburst ring the aces sit in. */
function ace2Ring(b: Bitmap, r = 28) {
	const cx = 40,
		cy = 57;
	const n = 16;
	for (let i = 0; i < n; i++) {
		const a0 = (i / n) * Math.PI * 2,
			a1 = ((i + 1) / n) * Math.PI * 2;
		b.fillPoly([cx, cy, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r], i % 2 === 0 ? P.gold : P.goldLight);
	}
	b.fillCircle(cx, cy, r - 7, P.gold);
	b.fillCircle(cx, cy, r - 9, P.cream);
}

/** Build the bitmap for a face-up card (80x112). */
export function faceBitmap(card: Card, trump: boolean, fourColor: boolean): Bitmap {
	const b = newBitmap(FW, FH);
	const color = suitColor(card.suit, fourColor);
	body2(b, trump ? P.trumpCream : P.cream);
	if (card.suit === cards.TRUMPS) {
		tarotTrump(b, card, color);
		return b;
	}
	if (card.rank === 14) ace2(b, card, color);
	else if (card.rank === 1) bigSuit(b, card.suit, 40, 57, 30, color);
	else if (card.rank >= 11) court2(b, card, color);
	else pips2(b, card, color);
	if (trump) trumpMark2(b);
	index2(b, card, color);
	return b;
}

/** The look of each deck's back: field colors, trim, pattern and emblem. */
export interface BackStyle {
	deep: Color;
	field: Color;
	light: Color;
	trim: Color;
	trimLight: Color;
	trimDeep: Color;
	/** The card's outer edge, if not the field color. */
	edge?: Color;
	pattern: 'sunburst' | 'lattice' | 'stripes' | 'rings' | 'dots';
	emblem: string[];
}

const FLAME = ['..#..', '..##.', '.###.', '.####', '#####', '#####', '.###.'];
const DOLLAR = ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'];
const CROWN = ['#.#.#', '#####', '#####', '.###.'];
const KEY = ['.##..', '#..#.', '.##..', '..#..', '..##.', '..#..', '..##.'];
const SPARK = ['..#..', '..#..', '##.##', '..#..', '..#..'];

const BACKS: Record<string, BackStyle> = {
	standard: { edge: P.wine, deep: P.wineDeep, field: P.wineDeep, light: P.wineLight, trim: P.gold, trimLight: P.goldLight, trimDeep: P.goldDeep, pattern: 'sunburst', emblem: S.V },
	burned: { deep: hex('#1a1314'), field: hex('#241b1c'), light: hex('#3a2a29'), trim: hex('#d9771f'), trimLight: hex('#f2b45a'), trimDeep: hex('#7a3510'), pattern: 'sunburst', emblem: FLAME },
	gilded: { deep: hex('#5c4416'), field: P.goldDeep, light: hex('#a8822f'), trim: P.goldLight, trimLight: P.cream, trimDeep: hex('#5c4416'), pattern: 'lattice', emblem: DOLLAR },
	royal: { deep: hex('#141d4a'), field: hex('#1d2a66'), light: hex('#2c3f8c'), trim: P.gold, trimLight: P.goldLight, trimDeep: P.goldDeep, pattern: 'stripes', emblem: CROWN },
	schemer: { deep: hex('#1e1533'), field: hex('#2b1f4a'), light: hex('#45326f'), trim: hex('#c2adf0'), trimLight: hex('#efe8ff'), trimDeep: hex('#6b54a3'), pattern: 'rings', emblem: S.SUIT7[1] },
	wild: { deep: hex('#140f2e'), field: hex('#1f1747'), light: hex('#3b2a7a'), trim: hex('#ff4fd8'), trimLight: hex('#7ff2ff'), trimDeep: hex('#8a2577'), pattern: 'rings', emblem: SPARK },
	collector: { deep: hex('#0d2b25'), field: hex('#123b33'), light: hex('#1f5e50'), trim: P.gold, trimLight: P.goldLight, trimDeep: P.goldDeep, pattern: 'dots', emblem: KEY }
};

/** A deck's back colors, for the smooth card style too. */
export function backStyle(deck = 'standard'): BackStyle {
	return BACKS[deck] ?? BACKS.standard;
}

/** Build the bitmap for a card back (drawn at 40x56, doubled to 80x112 to
 *  match the faces). */
export function backBitmap(deck = 'standard'): Bitmap {
	const small = backBitmap1(deck);
	const b = newBitmap(FW, FH);
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const c = small.get(x, y);
		if (c) b.fillRect(x * 2, y * 2, 2, 2, c);
	}
	return b;
}

function backBitmap1(deck = 'standard'): Bitmap {
	const st = BACKS[deck] ?? BACKS.standard;
	const b = newBitmap(W, H);
	body(b, st.edge ?? st.field);
	b.fillRect(4, 4, W - 8, H - 8, st.field);
	const cx = 20,
		cy = 28;
	const x0 = 4,
		y0 = 4,
		x1 = W - 5,
		y1 = H - 5;
	if (st.pattern === 'sunburst') {
		const edge = (a: number): [number, number] => {
			const c = Math.cos(a),
				s = Math.sin(a);
			const tx = c !== 0 ? ((c > 0 ? x1 + 1 : x0) - cx) / c : Infinity;
			const ty = s !== 0 ? ((s > 0 ? y1 + 1 : y0) - cy) / s : Infinity;
			const t = Math.min(Math.abs(tx), Math.abs(ty));
			return [cx + c * t, cy + s * t];
		};
		const n = 20;
		for (let i = 0; i < n; i += 2) {
			const [ax, ay] = edge((i / n) * Math.PI * 2);
			const [bx, by] = edge(((i + 1) / n) * Math.PI * 2);
			b.fillPoly([cx, cy, ax, ay, bx, by], st.light);
		}
	} else {
		for (let y = y0; y <= y1; y++)
			for (let x = x0; x <= x1; x++) {
				const dx = x - cx,
					dy = y - cy;
				const on =
					st.pattern === 'lattice'
						? (x + y) % 6 === 0 || (x - y + 60) % 6 === 0
						: st.pattern === 'stripes'
							? x % 4 < 2
							: st.pattern === 'rings'
								? Math.floor((Math.abs(dx) + Math.abs(dy)) / 3) % 2 === 0
								: x % 4 === 1 && y % 4 === 1;
				if (on) b.set(x, y, st.light);
			}
	}
	b.rect(2, 2, W - 4, H - 4, st.trim);
	b.rect(4, 4, W - 8, H - 8, st.trimDeep);
	b.fillPoly([cx, cy - 12, cx + 9, cy, cx, cy + 12, cx - 9, cy], st.trim);
	b.fillPoly([cx, cy - 10, cx + 7, cy, cx, cy + 10, cx - 7, cy], st.deep);
	const ew = st.emblem[0].length,
		eh = st.emblem.length;
	b.sprite(st.emblem, S.solid(st.trimLight), cx - Math.ceil(ew / 2), cy - Math.floor(eh / 2));
	return b;
}
