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

/** A Tarot trump: its number on a tinted deco panel, stars, and a gold
 *  sunburst behind the oudlers (1 and 21). The Excuse is a star. */
function tarotTrump(b: Bitmap, card: Card, color: Color) {
	const pal = S.solid(color);
	const tint: Color = [P.cream[0] + (color[0] - P.cream[0]) * 0.14, P.cream[1] + (color[1] - P.cream[1]) * 0.14, P.cream[2] + (color[2] - P.cream[2]) * 0.14, 1];
	if (card.rank === cards.EXCUSE) {
		ace2Ring(b);
		const pts: number[] = [];
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + (i * Math.PI) / 5,
				r = i % 2 === 0 ? 15 : 6.5;
			pts.push(40 + Math.cos(a) * r, 57 + Math.sin(a) * r);
		}
		b.fillPoly(pts, color);
		b.sprite(STAR7, pal, 4, 5);
		b.sprite(STAR7, pal, FW - 4 - 7, FH - 5 - 7, { flip: true });
		return;
	}
	// The panel, edged in gold.
	for (let y = 18; y < 96; y++) for (let x = 18; x < 62; x++) b.set(x, y, tint);
	b.rect(18, 18, 44, 78, P.gold);
	const oudler = card.rank === 1 || card.rank === 21;
	if (oudler) ace2Ring(b, 18);
	const num = numberSprite(card.rank);
	const nw = num[0].length;
	b.sprite(num, pal, Math.round(40 - nw / 2), 52);
	b.sprite(STAR7, S.solid(oudler ? P.goldDeep : P.gold), 37, 26);
	b.sprite(STAR7, S.solid(oudler ? P.goldDeep : P.gold), 37, 80, { flip: true });
	// The index: the number with a star under it.
	b.sprite(num, pal, 4, 5);
	b.sprite(STAR7, pal, 4, 18);
	const flipped = num.map((r) => [...r].reverse().join('')).reverse();
	b.sprite(flipped, pal, FW - 4 - nw, FH - 5 - 11);
	b.sprite(STAR7, pal, FW - 4 - 7, FH - 18 - 7, { flip: true });
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

const BACKS: Record<string, BackStyle> = {
	standard: { edge: P.wine, deep: P.wineDeep, field: P.wineDeep, light: P.wineLight, trim: P.gold, trimLight: P.goldLight, trimDeep: P.goldDeep, pattern: 'sunburst', emblem: S.V },
	burned: { deep: hex('#1a1314'), field: hex('#241b1c'), light: hex('#3a2a29'), trim: hex('#d9771f'), trimLight: hex('#f2b45a'), trimDeep: hex('#7a3510'), pattern: 'sunburst', emblem: FLAME },
	gilded: { deep: hex('#5c4416'), field: P.goldDeep, light: hex('#a8822f'), trim: P.goldLight, trimLight: P.cream, trimDeep: hex('#5c4416'), pattern: 'lattice', emblem: DOLLAR },
	royal: { deep: hex('#141d4a'), field: hex('#1d2a66'), light: hex('#2c3f8c'), trim: P.gold, trimLight: P.goldLight, trimDeep: P.goldDeep, pattern: 'stripes', emblem: CROWN },
	schemer: { deep: hex('#1e1533'), field: hex('#2b1f4a'), light: hex('#45326f'), trim: hex('#c2adf0'), trimLight: hex('#efe8ff'), trimDeep: hex('#6b54a3'), pattern: 'rings', emblem: S.SUIT7[1] },
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
