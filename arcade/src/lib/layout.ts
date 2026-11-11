// The stage, landscape or portrait: its size, where the sidebar and table
// go, and the table's geometry (seats, the trick, your hand). Every
// component reads it, from here or from the CSS variables the stage sets
// (--tx --ty --tw --th for the table, --sw --sh for the sidebar).

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Layout {
	portrait: boolean;
	W: number;
	H: number;
	side: Rect;
	table: Rect;
	/** The trick's centre. */
	cx: number;
	cy: number;
	/** The centre line of your hand. */
	handY: number;
	/** How wide your hand may spread. */
	handW: number;
	/** North's row, West's and East's columns. */
	northY: number;
	westX: number;
	eastX: number;
	/** Where new cards come from. */
	deck: { x: number; y: number };
	/** Seat name labels. */
	label: { N: [number, number]; S: [number, number]; W: [number, number]; E: [number, number] };
	/** Sort buttons; Last trick and Deck; Play it out. */
	sortAt: [number, number];
	peekAt: [number, number];
	outAt: [number, number];
	bannerY: number;
}

/** Your hand's card scale, and its height. */
export const HAND_S = 1.5;
const HAND_H = 112 * HAND_S;

export const LANDSCAPE: Layout = (() => {
	const W = 1280,
		H = 720,
		side = { x: 0, y: 0, w: 270, h: H },
		table = { x: 270, y: 0, w: W - 270, h: H };
	const cx = table.x + table.w / 2,
		cy = 300;
	return {
		portrait: false, W, H, side, table, cx, cy,
		handY: H - HAND_H / 2 - 20, handW: 880,
		northY: 72, westX: table.x + 60, eastX: table.x + table.w - 60,
		deck: { x: table.x + table.w - 70, y: 640 },
		label: { N: [cx, 16], S: [cx, 484], W: [table.x + 60, cy - 150], E: [table.x + table.w - 60, cy - 150] },
		sortAt: [table.x + 24, 446], peekAt: [table.x + table.w - 24, 470], outAt: [table.x + table.w - 24, 420],
		bannerY: 450
	};
})();

export const PORTRAIT: Layout = (() => {
	const W = 800,
		H = 1280,
		side = { x: 0, y: 0, w: W, h: 300 },
		table = { x: 0, y: 300, w: W, h: H - 300 };
	const cx = W / 2,
		cy = table.y + 380;
	return {
		portrait: true, W, H, side, table, cx, cy,
		handY: H - HAND_H / 2 - 40, handW: 760,
		northY: table.y + 70, westX: 46, eastX: W - 46,
		deck: { x: W - 70, y: H - 330 },
		label: { N: [cx, table.y + 14], S: [cx, H - HAND_H - 90], W: [50, cy - 190], E: [W - 50, cy - 190] },
		sortAt: [24, H - HAND_H - 130], peekAt: [W - 24, H - HAND_H - 140], outAt: [W - 24, H - HAND_H - 186],
		bannerY: cy + 180
	};
})();

/** Portrait when the window is taller than it is wide (with some margin). */
export function layoutFor(w: number, h: number): Layout {
	return h > w * 1.15 ? PORTRAIT : LANDSCAPE;
}

/** The CSS variables the stage sets for its children. */
export function cssVars(L: Layout): string {
	const t = L.table,
		s = L.side;
	return `--W:${L.W}px;--H:${L.H}px;--tx:${t.x}px;--ty:${t.y}px;--tw:${t.w}px;--th:${t.h}px;--tcx:${t.x + t.w / 2}px;--sw:${s.w}px;--sh:${s.h}px`;
}
