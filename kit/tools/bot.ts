// Plays any game module through a run, recording its actions: tests use it
// to check that every game runs end to end and replays exactly.

import * as R from '../src/run/run.ts';
import { apply, type Action, type Save } from '../src/run/save.ts';
import type { GameModule, Run } from '../src/run/run.ts';
import { newRng } from '../src/core/rules/rng.ts';

export function playRun(module: GameModule, seed: string | number, maxSteps = 20000, deck?: string, ai = R.AI_VERSION): { run: Run; save: Save } {
	const run = R.newRun(module, seed, { deck, ai });
	const save: Save = { version: 1, game: module.id, seed, ...(deck ? { deck } : {}), ai, actions: [], tape: run.ext.tape };
	const rng = newRng(`${seed}|bot`);
	const go = (a: Action) => {
		save.actions.push(a);
		apply(run, a);
	};
	for (let step = 0; step < maxSteps; step++) {
		const p = run.phase;
		if (p === R.PHASE.OVER || p === R.PHASE.VICTORY) break;
		if ((p === R.PHASE.PRE || p === R.PHASE.PLAY) && (R.skipTag(run) === 'cash' || R.skipTag(run) === 'edition')) go({ t: 'skip' });
		else if (p === R.PHASE.PRE || p === R.PHASE.PLAY) {
			// Use a held ploy when it can help (Spotlight, Encore on the last hand).
			// (Not Undo or Hand Swap: the bot can't judge those, so it would use them blind.)
			const slot = run.ploys.findIndex((k, i) => k !== 'undo' && k !== 'hand_swap' && (k !== 'encore' || run.handsLeft <= 1) && R.canUsePloy(run, i)[0]);
			if (slot >= 0) go({ t: 'ploy', slot });
			else go({ t: 'game', a: module.bot(run, rng) });
		} else if (p === R.PHASE.SCORED) go({ t: 'next' });
		else if (p === R.PHASE.WON) go({ t: 'shop' });
		else if (p === R.PHASE.SHOP && !run.opening) {
			// Shop by value, as Shoot the Moon's bot does: relics by the game's
			// measured value (else rarity and cost), replacing the weakest when
			// full; a few other things worth having; then move on.
			const v = (d: R.RelicDef) => 4 * (module.relicValue?.[d.key] ?? (d.rarity * 10 + d.cost) / 5);
			const worth = (it: R.ShopItem): number => {
				if (it.sold || run.money < it.cost) return -1;
				if (it.kind === 'relic') {
					const s = v(it.def) + (it.edition ? 8 : 0);
					if (it.edition !== 'phantom' && !it.def.extraSlot && R.relicSlotsUsed(run) >= R.relicSlots(run)) {
						const weakest = Math.min(...run.relics.map((r) => v(r.def)));
						return s > weakest + 5 ? s : -1;
					}
					return s;
				}
				if (it.kind === 'upgrade') return 18;
				if (it.kind === 'bundle') return it.def.key === 'relic' ? (R.relicSlotsUsed(run) < R.relicSlots(run) ? 24 : -1) : it.def.key === 'edition' ? 9 : run.ploys.length < R.PLOY_SLOTS ? 10 : -1;
				if (it.kind === 'ploy') return run.ploys.length < R.PLOY_SLOTS && (it.def.key === 'encore' || it.def.key === 'spotlight') ? 16 : -1;
				if (it.kind === 'edition') return it.def.key === 'prismatic' ? 16 : it.def.key === 'lacquered' ? 11 : 8;
				return -1;
			};
			const items = run.shop!.items;
			const best = items.reduce((b, it, i) => (worth(it) > (b < 0 ? 0 : worth(items[b])) ? i : b), -1);
			if (best < 0) {
				if (run.money >= 20 && run.money >= run.rerollCost + 10 && !run.ext.botRerolled) {
					run.ext.botRerolled = true;
					go({ t: 'reroll' });
				} else {
					run.ext.botRerolled = false;
					go({ t: 'leave' });
				}
				continue;
			}
			const it = items[best];
			if (it.kind === 'relic' && it.edition !== 'phantom' && !it.def.extraSlot && R.relicSlotsUsed(run) >= R.relicSlots(run)) {
				const wi = run.relics.reduce((w, r, i) => (v(r.def) < v(run.relics[w].def) ? i : w), 0);
				go({ t: 'sell', slot: wi });
			}
			const free = run.pack.filter((c) => !R.mod(run, c).edition);
			const card = R.needsCard(it) ? rng.pick(free.length ? free : run.pack)?.id : undefined;
			go({ t: 'buy', slot: best, card });
		} else if (p === R.PHASE.SHOP) {
			if (run.opening) {
				const ok = run.opening.options.findIndex((o) => (o.kind === 'relic' ? R.relicSlotsUsed(run) < R.relicSlots(run) : o.kind === 'ploy' ? run.ploys.length < R.PLOY_SLOTS : true));
				go({ t: 'pick', index: ok });
				continue;
			}
			const i = run.shop!.items.findIndex((_, k) => R.canBuy(run, k)[0]);
			if (i < 0) go({ t: 'leave' });
			else {
				const it = run.shop!.items[i];
				const fits = it.kind === 'pack' ? run.pack.filter((c) => R.canApplyPack(run, it.def, c)[0]) : run.pack;
				if (R.needsCard(it) && !fits.length) go({ t: 'leave' });
				else go({ t: 'buy', slot: i, card: R.needsCard(it) ? rng.pick(fits)!.id : undefined });
			}
		}
	}
	return { run, save };
}
