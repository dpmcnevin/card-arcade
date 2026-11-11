// A compact, readable log of any run, to download and send for analysis.
// Built by replaying the save: each board, each hand (the game's own line
// for it, then the score line by line), each club (offers and buys), skips,
// payouts and the result. The save goes last, on one line, for an exact
// replay.

import * as R from './run.ts';
import { apply, type Save } from './save.ts';
import type { Breakdown, GameModule, ShopItem } from './run.ts';
import { TAGS } from './content.ts';

const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

function scoreLine(b: Breakdown): string {
	const parts = b.lines.map((l) => {
		const bits = [l.chips ? `${l.chips > 0 ? '+' : ''}${n(l.chips)}c` : '', l.mult ? `+${n(l.mult)}m` : '', l.xmult && l.xmult !== 1 ? `x${n(l.xmult)}` : '', l.money ? `+$${l.money}` : '']
			.filter(Boolean)
			.join(' ');
		return `${l.label}${bits ? ' ' + bits : ''}`;
	});
	return `${parts.join(' | ')} = ${n(b.chips)} x ${n(b.mult)} = ${b.total}`;
}

const offer = (it: ShopItem) => `${it.name}${it.kind === 'relic' && it.edition ? ` (${it.edition})` : ''} [${it.kind}] $${it.cost}`;

export function buildLog(module: GameModule, save: Save): string {
	const run = R.newRun(module, save.seed, { deck: save.deck });
	const out: string[] = [];
	out.push(`${module.title.toUpperCase()} log · ${module.id} · seed ${run.seed} · deck ${run.deck}`);
	let lastBoard = '';
	const boardHead = () => {
		const k = `${run.table}.${run.board}`;
		if (k === lastBoard) return;
		lastBoard = k;
		out.push('');
		out.push(`== ${module.words.table} ${run.table} ${R.boardName(run)} · goal ${run.target} · ${run.handsLeft} ${module.words.hands} · $${run.money}${R.bossActive(run) ? ` · boss ${run.boss!.name}` : ''}`);
		if (run.relics.length) out.push(`   relics: ${run.relics.map((r) => r.name + (r.edition ? ` (${r.edition})` : '')).join(', ')}`);
		const lv = Object.entries(run.levels).filter(([, v]) => v > 1);
		if (lv.length) out.push(`   levels: ${lv.map(([k, v]) => `${k} ${v}`).join(', ')}`);
	};
	boardHead();
	for (const a of save.actions) {
		const before = run.phase;
		if (a.t === 'skip') {
			const t = R.skipTag(run);
			out.push(`   skipped ${R.boardName(run)} for ${t ? TAGS[t].name : '?'}`);
		} else if (a.t === 'buy') {
			const it = run.shop?.items[a.slot];
			const card = a.card !== undefined ? run.pack.find((c) => c.id === a.card) : undefined;
			if (it) out.push(`   bought ${it.name}${card ? ` on ${card.suit}-${card.rank}` : ''} $${it.cost}`);
		} else if (a.t === 'ploy') out.push(`   used ${R.ployDef(run, run.ploys[a.slot])?.name ?? '?'}`);
		else if (a.t === 'pick') {
			const o = run.opening?.options[a.index];
			out.push(`   took ${!o ? 'nothing' : o.kind === 'edition' ? `${o.edition} on card ${o.cardId}` : o.def.name}`);
		} else if (a.t === 'sell') out.push(`   sold ${run.relics[a.slot]?.name ?? '?'}`);
		else if (a.t === 'reroll') out.push(`   reroll $${run.rerollCost}`);
		apply(run, a);
		if (run.phase === R.PHASE.SCORED && before !== R.PHASE.SCORED && run.result) {
			const desc = module.describeHand?.(run);
			out.push(`-- ${module.words.hand} ${run.handsThisBoard - run.handsLeft}${desc ? ` · ${desc}` : ''}`);
			out.push(`   ${run.result.title}: ${scoreLine(run.result)} · board ${run.score}/${run.target}`);
		}
		if (run.phase === R.PHASE.WON && before !== R.PHASE.WON && run.lastPayout) {
			const p = run.lastPayout;
			out.push(`   WON · paid $${p.total} (board ${p.board}, unused ${p.unused}, interest ${p.interest}, relics ${p.relics}, boss ${p.boss}) → $${run.money}`);
		}
		if ((a.t === 'shop' || a.t === 'reroll') && run.shop) out.push(`   club ($${run.money}): ${run.shop.items.map(offer).join(' · ')}`);
		if (run.phase === R.PHASE.OVER && before !== R.PHASE.OVER) out.push(`   LOST on ${module.words.table} ${run.table} ${R.boardName(run)}: ${run.score}/${run.target}`);
		if (run.phase === R.PHASE.VICTORY && before !== R.PHASE.VICTORY) out.push(`   VICTORY`);
		if (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY) boardHead();
	}
	out.push('');
	out.push(`Now: ${module.words.table} ${run.table} ${R.boardName(run)} · ${run.phase} · score ${run.score}/${run.target} · $${run.money} · ${module.words.hands} ${run.stats.hands} · best ${run.stats.best}`);
	out.push(`save: ${JSON.stringify(save)}`);
	return out.join('\n');
}
