// The arcade's controller: which game, its run, and every action, saved as
// seed + actions per game so a run picks up where it left off.

import * as R from '$kit/src/run/run.ts';
import { apply, replay, undo, type Action, type Save } from '$kit/src/run/save.ts';
import type { Run } from '$kit/src/run/run.ts';
import { byId } from './games/index.ts';
import { LANDSCAPE, type Layout } from './layout.ts';
import { pickCount } from './games/types.ts';
import * as sound from './audio/sound.ts';
import { fx } from './fx.svelte.ts';
import { hex } from '$kit/src/core/ui/theme.ts';
import { settings } from './settings.svelte.ts';
import { emptyProfile, noteRun, parseProfile, type Profile } from '$kit/src/run/profile.ts';
import { buildLog } from '$kit/src/run/gamelog.ts';
import type { GameUI } from './games/types.ts';

const KEY = (id: string) => `cardkit-arcade-${id}`;

class Arcade {
	screen = $state<'menu' | 'run'>('menu');
	/** Landscape or portrait, from the window's shape. */
	layout = $state.raw<Layout>(LANDSCAPE);
	ui = $state.raw<GameUI | null>(null);
	run = $state.raw<Run | null>(null);
	/** Bumped on every change: views read it to refresh. */
	v = $state(0);
	picked = $state<string[]>([]);
	/** Your hand's order: how it's sorted, or the order you dragged it into. */
	sortBy = $state<'suit' | 'rank'>('suit');
	order = $state<string[]>([]);
	sort(by: 'suit' | 'rank') {
		this.sortBy = by;
		this.order = [];
	}
	toast = $state('');
	/** The AI seats are playing (paced); the player waits. */
	busy = $state(false);
	private save: Save | null = null;

	saved(id: string): boolean {
		try {
			const s = localStorage.getItem(KEY(id));
			if (!s) return false;
			const run = replay(byId(id)!.module, JSON.parse(s));
			return run.phase !== R.PHASE.OVER && run.phase !== R.PHASE.VICTORY;
		} catch {
			return false;
		}
	}

	/** The starting deck picked for each game. */
	decks = $state<Record<string, string>>((() => {
		try {
			return JSON.parse(localStorage.getItem('cardkit-arcade-decks') ?? '{}');
		} catch {
			return {};
		}
	})());

	setDeck(id: string, deck: string) {
		this.decks = { ...this.decks, [id]: deck };
		try {
			localStorage.setItem('cardkit-arcade-decks', JSON.stringify(this.decks));
		} catch {}
	}

	start(id: string, resume = false) {
		const ui = byId(id)!;
		let save: Save | null = null;
		if (resume) {
			try {
				save = JSON.parse(localStorage.getItem(KEY(id)) ?? 'null');
			} catch {}
		}
		if (save) {
			// A save from an older build may not replay; start fresh then.
			try {
				this.run = replay(ui.module, save);
			} catch {
				save = null;
			}
		}
		if (!save) {
			const deck = this.decks[id] ?? 'standard';
			this.run = R.newRun(ui.module, undefined, { deck });
			save = { version: 1, game: id, seed: this.run.seed, deck, actions: [] };
		}
		this.save = save;
		this.ui = ui;
		this.runId = resume ? (this.profile(id).history.find((e) => e.seed === String(save!.seed))?.id ?? '') : '';
		this.picked = [];
		this.screen = 'run';
		this.busy = false;
		this.persist();
		this.v++;
		void this.pump();
	}

	do(a: Action) {
		const run = this.run!;
		if (this.busy) return;
		// Undo: rewind the save to before your last card, and replay it.
		if (a.t === 'ploy' && run.ploys[a.slot] === 'undo') {
			const ok = R.canUsePloy(run, a.slot);
			const back = ok[0] ? undo(this.save!) : null;
			if (!back) return this.flash(`Can't: ${ok[1] ?? 'nothing to take back'}`);
			this.save = back;
			this.run = replay(this.ui!.module, back);
			this.picked = [];
			this.persist();
			this.v++;
			sound.play('flip');
			this.checkClaim();
			return this.flash('Taken back', 'good');
		}
		const before = run.phase;
		try {
			// Game moves leave the AI to us, so it can be paced and seen.
			const out = a.t === 'game' ? R.act(run, a.a, { stepwise: true }) : apply(run, a);
			if (Array.isArray(out) && out[0] === false) return this.flash(`Can't: ${out[1]}`);
		} catch (e) {
			return this.flash((e as Error).message);
		}
		this.save!.actions.push(a);
		this.picked = [];
		this.persist();
		this.v++;
		this.cue(a, before);
		this.gameCue();
		void this.pump();
	}

	/** The game's memo for cues, and the hand it belongs to. */
	private memo: Record<string, any> = {};
	private memoHand = -1;

	/** The game's own moments (hearts broken, the queen taken). */
	private gameCue() {
		const run = this.run!,
			ui = this.ui!;
		if (!ui.cue) return;
		if (this.memoHand !== run.stats.hands) {
			this.memo = {};
			this.memoHand = run.stats.hands;
		}
		const c = ui.cue(run, this.memo);
		if (!c) return;
		if (c.sound) sound.play(c.sound);
		if (c.shake) fx.shake(c.shake);
		if (c.toast) this.flash(c.toast, c.tone);
	}

	/** Sounds for what just happened. */
	private cue(a: Action, before: R.Phase) {
		const run = this.run!;
		if (a.t === 'game') sound.play('card_play', { jitter: 0.08 });
		else if (a.t === 'buy') sound.play('coin');
		else if (a.t === 'sell') sound.play('sell');
		else if (a.t === 'reroll') sound.play('reroll');
		else if (a.t === 'ploy') sound.play('ploy');
		else if (a.t === 'shop') sound.play('coin');
		else if (a.t === 'next' || a.t === 'leave') sound.play('deal', { volume: 0.7 });
		if (run.phase !== before) this.phaseCue(run.phase);
	}

	private phaseCue(phase: R.Phase) {
		const run = this.run!;
		// The score panel plays its own sounds as it counts up.
		if (phase === R.PHASE.WON) {
			sound.play('board_won');
			fx.burst(775, 260, 60, [hex('#e8c873'), hex('#4fbf7a'), hex('#ece6d6'), hex('#d9a441')], 380, { life: 1.3, size: 8 });
		}
		else if (phase === R.PHASE.VICTORY) sound.play('board_won');
		else if (phase === R.PHASE.OVER) sound.play('game_over');
	}

	/** Play the AI seats' cards one at a time, holding each finished trick
	 *  long enough to see who took it (the last one too, before the score). */
	private async pump() {
		const run = this.run!,
			ui = this.ui!;
		const sleep = (ms: number) => this.pause(ms);
		this.busy = true;
		try {
			for (let guard = 0; guard < 80; guard++) {
				const done = ui.view(run).trickDone;
				if (run.phase !== R.PHASE.PLAY) {
					if (done && run.phase === R.PHASE.SCORED) {
						this.hold = true;
						this.v++;
						await sleep(850 / settings.speed);
						await this.sweepTrick(sleep);
						this.hold = false;
					}
					break;
				}
				if (!R.aiToMove(run)) {
					// Your lead next (you took it): still sweep the trick to you.
					if (done && this.swept !== this.lastTrickKey()) {
						await sleep(750 / settings.speed);
						if (this.run === run) await this.sweepTrick(sleep);
					}
					break;
				}
				if (done) {
					// See who took it, then the cards go to them.
					await sleep(750 / settings.speed);
					await this.sweepTrick(sleep);
				} else await sleep(430 / settings.speed);
				if (this.run !== run) return;
				const before = run.phase;
				const r = R.stepAI(run);
				sound.play(r === 'trick' ? 'trick_win' : 'card_play', { jitter: 0.08, volume: r === 'trick' ? 0.6 : 1 });
				this.v++;
				this.gameCue();
				if (run.phase !== before) this.phaseCue(run.phase);
			}
		} finally {
			this.busy = false;
			this.v++;
			this.checkClaim();
		}
	}

	/** Every way to play the rest of the hand ends the same: the player may
	 *  claim it. The search behind it can take tens of milliseconds, so it runs
	 *  once per turn, just after the table settles, not on every redraw. */
	claim = $state(false);
	private claimKey = '';
	private checkClaim() {
		const run = this.run;
		if (!run || run.phase !== R.PHASE.PLAY || R.aiToMove(run) || !run.module.settled) return void (this.claim = false);
		const key = `${run.game}|${this.save?.actions.length}|${run.stats.hands}`;
		if (key === this.claimKey) return;
		this.claimKey = key;
		this.claim = false;
		setTimeout(() => {
			if (this.run === run && this.claimKey === key && run.phase === R.PHASE.PLAY && !R.aiToMove(run)) this.claim = run.module.settled!(run);
		}, 60);
	}

	/** The board whose overview was last dismissed ("table.board"). */
	seen = $state('');

	/** Holding the last trick of a hand: the score panel waits. */
	hold = $state(false);
	/** A finished trick sliding to whoever took it. */
	sweep = $state(false);
	/** The player asked to hurry: the current pause ends now. */
	private hurry: (() => void) | null = null;

	/** A pause the player can cut short (a tap, Space). */
	private pause(ms: number): Promise<void> {
		return new Promise((done) => {
			const t = setTimeout(() => ((this.hurry = null), done()), ms);
			this.hurry = () => {
				clearTimeout(t);
				this.hurry = null;
				done();
			};
		});
	}

	/** Hurry the other seats or a held trick along. True if there was anything to hurry. */
	skip(): boolean {
		if (!this.hurry) return false;
		this.hurry();
		return true;
	}

	/** Space or Enter: the obvious next step. */
	advance() {
		const run = this.run;
		if (!run || this.screen !== 'run') return;
		if (this.skip()) return;
		if (this.overlay) return;
		if (run.phase === R.PHASE.SCORED && !this.hold) this.do({ t: 'next' });
		else if (run.phase === R.PHASE.WON) this.do({ t: 'shop' });
	}

	/** Escape: close what's open, else back to the menu. */
	escape() {
		if (this.overlay) this.overlay = null;
		else if (this.screen === 'run') this.toMenu();
	}

	/** The finished trick already swept to its winner (so it stays off the table). */
	swept = $state<string | null>(null);
	/** A key for the last finished trick on the table. */
	lastTrickKey(): string | null {
		const t = this.ui && this.run ? this.ui.view(this.run).lastTrick : undefined;
		return t ? t.plays.map((p) => `${p.card.suit}-${p.card.rank}`).join(',') : null;
	}

	private async sweepTrick(sleep: (ms: number) => Promise<unknown>) {
		this.sweep = true;
		this.v++;
		sound.play('deal', { volume: 0.5, pitch: 0.85 });
		await sleep(320 / settings.speed);
		this.swept = this.lastTrickKey();
		this.sweep = false;
	}

	game(a: unknown) {
		this.do({ t: 'game', a });
	}

	togglePick(key: string) {
		const max = pickCount(this.ui, this.run);
		if (this.picked.includes(key)) this.picked = this.picked.filter((k) => k !== key);
		else if (this.picked.length < max) this.picked = [...this.picked, key];
	}

	toastTone = $state<'good' | 'bad' | undefined>(undefined);
	flash(text: string, tone?: 'good' | 'bad') {
		this.toast = text;
		this.toastTone = tone;
		setTimeout(() => this.toast === text && (this.toast = ''), 2000);
	}

	/** This run's id in the profile (one per run, made when it starts). */
	private runId = '';

	private persist() {
		try {
			localStorage.setItem(KEY(this.save!.game), JSON.stringify(this.save));
			const id = this.save!.game;
			if (!this.runId) this.runId = `${Date.now().toString(36)}-${this.save!.seed}`;
			const p = this.profile(id);
			noteRun(p, this.run!, this.runId);
			localStorage.setItem(`cardkit-arcade-profile-${id}`, JSON.stringify(p));
		} catch {}
	}

	/** A game's profile: totals, collection marks, recent runs. */
	profile(id: string): Profile {
		try {
			return parseProfile(localStorage.getItem(`cardkit-arcade-profile-${id}`));
		} catch {
			return emptyProfile();
		}
	}

	/** Download this run's log as a text file. */
	downloadLog() {
		if (!this.save || !this.ui) return;
		const text = buildLog(this.ui.module, this.save);
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
		a.download = `${this.ui.module.id}-${this.save.seed}.txt`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	/** Overlays: help, the collection, the last trick, the deck. */
	overlay = $state<'help' | 'collection' | 'last' | 'deck' | 'table' | null>(null);

	toMenu() {
		this.screen = 'menu';
	}
}

export const arcade = new Arcade();
