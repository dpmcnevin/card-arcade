// The player's record across runs of one game: totals, the relics found and
// bosses beaten (the Collection's marks), the game's own counters (moons,
// slams, marches) and recent runs. Stored per game, as JSON.
//
// `noteRun` is called after every action. It's idempotent: a run's entry is
// updated in place, and totals grow only by what changed since last time.

import * as R from './run.ts';
import type { Run } from './run.ts';

export type RunResult = 'playing' | 'won' | 'lost' | 'abandoned';

export interface RunRecord {
	id: string;
	seed: string;
	deck: string;
	started: number;
	ended?: number;
	result: RunResult;
	table: number;
	board: number;
	bestHand: number;
	hands: number;
	relics: string[];
	counters: Record<string, number>;
}

export interface Profile {
	version: 2;
	runs: number;
	wins: number;
	bestTable: number;
	bestHand: number;
	handsPlayed: number;
	relicsFound: string[];
	bossesBeaten: string[];
	counters: Record<string, number>;
	/** Most recent first, at most HISTORY entries. */
	history: RunRecord[];
}

export const HISTORY = 30;

export function emptyProfile(): Profile {
	return { version: 2, runs: 0, wins: 0, bestTable: 0, bestHand: 0, handsPlayed: 0, relicsFound: [], bossesBeaten: [], counters: {}, history: [] };
}

export function parseProfile(json: string | null | undefined): Profile {
	if (!json) return emptyProfile();
	try {
		const p = JSON.parse(json) as Profile;
		return p && p.version === 2 && Array.isArray(p.history) ? { ...emptyProfile(), ...p } : emptyProfile();
	} catch {
		return emptyProfile();
	}
}

const addTo = (list: string[], key: string) => {
	if (!list.includes(key)) list.push(key);
};

/** Bring the profile up to date with this run. */
export function noteRun(p: Profile, run: Run, id: string, now = Date.now()): Profile {
	let entry = p.history.find((e) => e.id === id);
	if (!entry) {
		for (const e of p.history) if (e.result === 'playing') e.result = 'abandoned';
		entry = { id, seed: String(run.seed), deck: run.deck, started: now, result: 'playing', table: 1, board: 1, bestHand: 0, hands: 0, relics: [], counters: {} };
		p.history.unshift(entry);
		p.history.length = Math.min(p.history.length, HISTORY);
		p.runs++;
	}
	p.handsPlayed += Math.max(0, run.stats.hands - entry.hands);
	entry.hands = run.stats.hands;
	for (const [k, v] of Object.entries(run.module.counters?.(run) ?? {})) {
		p.counters[k] = (p.counters[k] ?? 0) + Math.max(0, v - (entry.counters[k] ?? 0));
		entry.counters[k] = v;
	}
	entry.table = run.table;
	entry.board = run.board;
	entry.bestHand = Math.max(entry.bestHand, run.stats.best);
	for (const r of run.relics) {
		addTo(entry.relics, r.key);
		addTo(p.relicsFound, r.key);
	}
	p.bestHand = Math.max(p.bestHand, run.stats.best);
	p.bestTable = Math.max(p.bestTable, entry.table);
	if ((run.phase === R.PHASE.WON || run.phase === R.PHASE.VICTORY) && R.bossActive(run) && run.boss) addTo(p.bossesBeaten, run.boss.key);
	if (entry.result === 'playing' && (run.phase === R.PHASE.VICTORY || run.phase === R.PHASE.OVER)) {
		entry.result = run.phase === R.PHASE.VICTORY ? 'won' : 'lost';
		entry.ended = now;
		if (entry.result === 'won') p.wins++;
	}
	return p;
}
