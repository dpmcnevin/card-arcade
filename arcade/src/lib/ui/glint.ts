// A clock the decorations share, so they don't animate all the time: it
// ticks every few seconds (while the page is visible), and on every other
// tick each element that uses the `glint` action gets the class `go` for one
// short flourish (a ripple: a little stagger, all together), then holds
// still. Its CSS plays the flourish once under `.go` and shows a still look
// otherwise. All together, not spread out, so the page is completely still
// most of the time: without a GPU, anything moving at all costs a lot. The
// class is toggled on the element directly: nothing re-renders.

const TICK_MS = 3200;

const subs = new Set<(n: number) => void>();
let n = 0;
if (typeof window !== 'undefined') {
	setInterval(() => {
		if (document.hidden) return;
		n++;
		for (const f of subs) f(n);
	}, TICK_MS);
}

export interface GlintOpts {
	/** How long the flourish lasts (the `go` class stays this long). */
	ms: number;
	/** Skip the flourish while this says so (a dimmed card, a hovered button). */
	off?: () => boolean;
	/** Called as each flourish starts, with how many it has had (for looks
	 *  that step on, like a foil's shift or the snow's frame). */
	start?: (node: HTMLElement, count: number) => void;
	/** And as it ends. */
	end?: (node: HTMLElement, count: number) => void;
	/** Most delay after the tick, ms (each element picks its own; a ripple). */
	stagger?: number;
	/** Every tick instead of every other. */
	everyTick?: boolean;
}

export function glint(node: HTMLElement, opts: GlintOpts) {
	let o = opts;
	const delay = Math.random() * (o.stagger ?? 400);
	let count = 0;
	let t1: ReturnType<typeof setTimeout> | undefined;
	let t2: ReturnType<typeof setTimeout> | undefined;
	const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const tick = (k: number) => {
		if (!o.everyTick && k % 2) return;
		if (o.off?.() || reduced()) return;
		clearTimeout(t1);
		t1 = setTimeout(() => {
			count++;
			o.start?.(node, count);
			node.classList.remove('go');
			// Restart the CSS animation even if the class was just removed.
			void node.offsetWidth;
			node.classList.add('go');
			clearTimeout(t2);
			t2 = setTimeout(() => {
				node.classList.remove('go');
				o.end?.(node, count);
			}, o.ms);
		}, delay);
	};
	subs.add(tick);
	return {
		update(next: GlintOpts) {
			o = next;
		},
		destroy() {
			subs.delete(tick);
			clearTimeout(t1);
			clearTimeout(t2);
		}
	};
}
