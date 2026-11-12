// How a card moves, after Balatro's Moveable: no spring. Each frame the
// velocity is smoothed hard toward what's left of the distance and capped at
// a top speed, so a card snaps across and stops dead instead of bouncing.
// It leans into its motion (rotation follows horizontal speed) and
// straightens as it stops. `juice` squashes it and lets it ring back, for a
// hover or a moment that matters.

export interface Pose {
	x: number;
	y: number;
	/** Rotation in radians. */
	r: number;
	/** Scale. */
	s: number;
}

/** Stage pixels per Balatro "tile" for a card at scale 1 (a card is 2.05 tiles wide). */
const TILE = 80 / 2.05;
/** The most a card leans in flight. */
const MAX_LEAN = 0.35;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Mover {
	current = $state<Pose>({ x: 0, y: 0, r: 0, s: 1 });
	target: Pose;
	private v = { x: 0, y: 0, r: 0, s: 0 };
	private j: { amt: number; rot: number; t0: number } | null = null;
	private raf = 0;
	private last = 0;

	constructor(start: Pose) {
		this.current = { ...start };
		this.target = { ...start };
	}

	set(target: Pose) {
		this.target = target;
		this.wake();
	}

	/** A squash that rings back over 0.4s (Balatro's juice_up). */
	juice(amount = 0.4, rot?: number) {
		if (reduced()) return;
		this.j = { amt: amount, rot: rot ?? (Math.random() < 0.5 ? -1 : 1) * 0.6 * amount, t0: performance.now() };
		this.current = { ...this.current, s: this.target.s * (1 - 0.6 * amount) };
		this.wake();
	}

	stop() {
		cancelAnimationFrame(this.raf);
		this.raf = 0;
	}

	private wake() {
		if (this.raf || typeof requestAnimationFrame === 'undefined') return;
		this.last = performance.now();
		this.raf = requestAnimationFrame(this.tick);
	}

	private tick = (now: number) => {
		const dt = Math.min(1 / 30, Math.max(1 / 240, (now - this.last) / 1000));
		this.last = now;
		const c = { ...this.current },
			t = this.target,
			v = this.v;
		const tile = TILE * Math.max(0.3, t.s);

		// Position: smoothed velocity toward the target, capped.
		const axy = Math.exp(-50 * dt);
		v.x = axy * v.x + (1 - axy) * (t.x - c.x) * 35 * dt;
		v.y = axy * v.y + (1 - axy) * (t.y - c.y) * 35 * dt;
		const top = 70 * dt * tile,
			speed = Math.hypot(v.x, v.y);
		if (speed > top) {
			v.x *= top / speed;
			v.y *= top / speed;
		}
		c.x += v.x;
		c.y += v.y;
		if (Math.abs(t.x - c.x) < 0.05 && Math.abs(v.x) < 0.05) (c.x = t.x), (v.x = 0);
		if (Math.abs(t.y - c.y) < 0.05 && Math.abs(v.y) < 0.05) (c.y = t.y), (v.y = 0);

		// Juice.
		let js = 0,
			jr = 0;
		if (this.j) {
			const T = (now - this.j.t0) / 1000;
			if (T > 0.4) this.j = null;
			else {
				const rem = 1 - T / 0.4;
				js = this.j.amt * Math.sin(50.8 * T) * rem ** 3;
				jr = this.j.rot * Math.sin(40.8 * T) * rem ** 2;
			}
		}

		// Rotation: the pose's, plus a lean with horizontal speed, plus juice.
		const lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, (0.015 * (v.x / tile)) / dt));
		const desR = t.r + lean + jr * 2;
		const ar = Math.exp(-190 * dt);
		v.r = ar * v.r + (1 - ar) * (desR - c.r);
		c.r += v.r;

		// Scale.
		const desS = t.s * (1 + js);
		const as = Math.exp(-60 * dt);
		v.s = as * v.s + (1 - as) * (desS - c.s);
		c.s += v.s;

		const still = !this.j && c.x === t.x && c.y === t.y && Math.abs(t.r - c.r) < 0.001 && Math.abs(v.r) < 0.001 && Math.abs(t.s - c.s) < 0.0005 && Math.abs(v.s) < 0.0005;
		if (still) {
			this.current = { ...t };
			this.v = { x: 0, y: 0, r: 0, s: 0 };
			this.raf = 0;
			return;
		}
		this.current = c;
		this.raf = requestAnimationFrame(this.tick);
	};
}
