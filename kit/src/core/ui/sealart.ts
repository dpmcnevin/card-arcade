// Pixel-art wax seals, 14x14, in the same style as the cards and icons:
// a lumpy wax blob with a dark rim, a highlight at the top left, and the
// seal's letter in a 5x5 pixel font.

import { newBitmap, type Bitmap } from './pixel.ts';
import { hex, type Color } from './theme.ts';


export const SIZE = 14;

const GLYPHS: Record<string, string[]> = {
	G: ['.###.', '#....', '#.###', '#...#', '.###.'],
	W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
	T: ['#####', '..#..', '..#..', '..#..', '..#..'],
	C: ['.####', '#....', '#....', '#....', '.####'],
	H: ['#...#', '#...#', '#####', '#...#', '#...#']
};

function shade(c: Color, k: number): Color {
	return [c[0] * k, c[1] * k, c[2] * k, 1];
}
function tint(c: Color, t: number): Color {
	return [c[0] + (1 - c[0]) * t, c[1] + (1 - c[1]) * t, c[2] + (1 - c[2]) * t, 1];
}

/** A wax seal from its letter and color (any game's seals). */
export function sealBitmap(glyph: string, color: string): Bitmap {

	const base = hex(color);
	const dark = shade(base, 0.55);
	const light = tint(base, 0.45);
	const cream = hex('#fff3d6');
	const b = newBitmap(SIZE, SIZE);
	// The wax: a round blob with one drip at the lower left, outlined in dark wax.
	b.fillCircle(7, 7, 6.2, dark);
	b.fillCircle(3, 11.4, 2.2, dark);
	// Fill in the shadow tone, then the lit wax offset up-left, leaving a
	// crescent of shadow along the lower right inside the outline.
	b.fillCircle(7, 7, 5.2, shade(base, 0.75));
	b.fillCircle(3.2, 11.2, 1.2, shade(base, 0.75));
	b.fillCircle(6.6, 6.6, 4.6, base);
	for (const [x, y] of [[4, 3], [5, 3], [3, 4], [3, 5]]) b.set(x, y, light);
	// The letter, with a one-pixel shadow.
	const rows = GLYPHS[glyph] ?? GLYPHS.G;
	b.sprite(rows, { '#': dark }, 5, 6);
	b.sprite(rows, { '#': cream }, 4, 5);
	return b;
}
