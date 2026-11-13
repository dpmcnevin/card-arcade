// A run is its game, seed and actions: replaying the actions through the
// engine rebuilds it exactly, whatever the game.

import * as R from './run.ts';
import type { GameModule, Run } from './run.ts';

export type Action =
	| { t: 'game'; a: unknown }
	| { t: 'next' }
	| { t: 'shop' }
	| { t: 'buy'; slot: number; card?: number }
	| { t: 'pick'; index: number }
	| { t: 'skip' }
	| { t: 'endless' }
	| { t: 'sell'; slot: number }
	| { t: 'reroll' }
	| { t: 'leave' }
	| { t: 'ploy'; slot: number }
	/** An Undo spent: the play it took back is gone from the save. */
	| { t: 'drop'; key: string }
	/** A debug cheat (R.debug). */
	| ({ t: 'debug' } & R.DebugOp);

export interface Save {
	version: 1;
	game: string;
	seed: string | number;
	/** The starting deck (Standard if absent). */
	deck?: string;
	actions: Action[];
}

export function apply(run: Run, a: Action) {
	switch (a.t) {
		case 'game':
			return R.act(run, a.a);
		case 'next':
			return R.next(run);
		case 'shop':
			return R.enterShop(run);
		case 'buy':
			return R.buy(run, a.slot, a.card);
		case 'pick':
			return R.pick(run, a.index);
		case 'skip':
			return R.skipBoard(run);
		case 'endless':
			return R.goEndless(run);
		case 'sell':
			return R.sellRelic(run, a.slot);
		case 'reroll':
			return R.reroll(run);
		case 'leave':
			return R.leaveShop(run);
		case 'ploy':
			return R.usePloy(run, a.slot);
		case 'debug':
			return R.debug(run, a);
		case 'drop': {
			const i = run.ploys.indexOf(a.key);
			if (i >= 0) run.ploys.splice(i, 1);
			run.stats.ploysUsed++;
			return;
		}
	}
}

/** Undo: the save without your last card play (and anything after it), and
 *  with the Undo spent. Replaying it puts the hand back as it was before
 *  that card, the other seats' cards included. */
export function undo(save: Save): Save | null {
	let i = save.actions.length - 1;
	while (i >= 0 && !(save.actions[i].t === 'game' && (save.actions[i] as { a: { t?: string } }).a?.t === 'play')) i--;
	if (i < 0) return null;
	return { ...save, actions: [...save.actions.slice(0, i), { t: 'drop', key: 'undo' }] };
}

export function replay(module: GameModule, save: Save): Run {
	if (save.game !== module.id) throw new Error(`save is for ${save.game}, not ${module.id}`);
	const run = R.newRun(module, save.seed, { deck: save.deck });
	for (const a of save.actions) apply(run, a);
	return run;
}
