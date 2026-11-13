// The debug menu (press D five times): performance switches that degrade or
// strip effects to see what they cost, and gameplay cheats. Switches are
// remembered between visits; cheats that change the run go through the save
// as `debug` actions, so a run still replays exactly (and its log says so).

import * as R from '$kit/src/run/run.ts';
import { newRng } from '$kit/src/core/rules/rng.ts';
import { arcade } from './app.svelte.ts';
import { settings } from './settings.svelte.ts';
import { fx } from './fx.svelte.ts';

const KEY = 'cardkit-arcade-debug';
type Flag = 'stepped' | 'noConfetti' | 'noShake' | 'noIdle' | 'noAnim' | 'fps' | 'peek';

class Debug {
	open = $state(false);
	/** Edition shine in pixel steps (a debug option: degrades it, saves CPU). */
	stepped = $state(false);
	/** No confetti bursts. */
	noConfetti = $state(false);
	/** No screen shake. */
	noShake = $state(false);
	/** No idle motion: swaying cards, floating wares, bobbing buttons. */
	noIdle = $state(false);
	/** No CSS animation or transition at all. */
	noAnim = $state(false);
	/** A frame-rate meter in the corner. */
	fps = $state(false);
	/** Every hand face up. */
	peek = $state(false);
	/** The bot plays for you (not remembered). */
	autoplay = $state(false);

	private presses: number[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private botN = 0;

	constructor() {
		try {
			const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
			for (const k of ['stepped', 'noConfetti', 'noShake', 'noIdle', 'noAnim', 'fps', 'peek'] as Flag[]) if (typeof s[k] === 'boolean') this[k] = s[k];
		} catch {}
		// ?debug=stepped-shine still works, for this visit.
		try {
			if (new URLSearchParams(location.search).getAll('debug').some((d) => d.split(',').includes('stepped-shine'))) this.stepped = true;
		} catch {}
		this.sync();
	}

	/** A key press: five D's within two seconds open (or close) the menu. */
	key(k: string): boolean {
		if (k !== 'd') {
			this.presses = [];
			return false;
		}
		const now = performance.now();
		this.presses = [...this.presses.filter((t) => now - t < 2000), now];
		if (this.presses.length >= 5) {
			this.presses = [];
			this.open = !this.open;
			return true;
		}
		return false;
	}

	toggle(k: Flag) {
		this[k] = !this[k];
		this.sync();
		try {
			const s: Record<string, boolean> = {};
			for (const f of ['stepped', 'noConfetti', 'noShake', 'noIdle', 'noAnim', 'fps', 'peek'] as Flag[]) s[f] = this[f];
			localStorage.setItem(KEY, JSON.stringify(s));
		} catch {}
	}

	/** Push the switches to where they take effect. */
	private sync() {
		settings.stepped = this.stepped;
		fx.off = { confetti: this.noConfetti, shake: this.noShake };
	}

	// ------------------------------------------------------------------ cheats

	cheat(d: R.DebugOp) {
		if (!arcade.run) return;
		arcade.do({ t: 'debug', ...d });
	}

	toggleAutoplay() {
		this.autoplay = !this.autoplay;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		if (this.autoplay) this.timer = setInterval(() => this.autoStep(), 250);
	}

	/** One step of autoplay: the bot's move, or the obvious next button. */
	private autoStep() {
		const run = arcade.run;
		if (!run || arcade.screen !== 'run') return;
		if (run.phase === R.PHASE.OVER || run.phase === R.PHASE.VICTORY) return void (this.autoplay && this.toggleAutoplay());
		if (arcade.busy || arcade.hold || arcade.overlay) return;
		// The board overview waits for a tap: dismiss it.
		arcade.seen = `${run.table}.${run.board}`;
		if (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY) {
			if (run.phase === R.PHASE.PLAY && R.aiToMove(run)) return;
			arcade.game(run.module.bot(run, newRng(`debug-auto-${this.botN++}`)));
		} else if (run.phase === R.PHASE.SCORED) arcade.do({ t: 'next' });
		else if (run.phase === R.PHASE.WON) arcade.do({ t: 'shop' });
		else if (run.phase === R.PHASE.SHOP) {
			if (run.opening) {
				const before = run.opening;
				arcade.do({ t: 'pick', index: 0 });
				if (run.opening === before) arcade.do({ t: 'pick', index: -1 });
			} else arcade.do({ t: 'leave' });
		}
	}
}

export const debug = new Debug();
