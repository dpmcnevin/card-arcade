// Is the rest of a hand settled? True when every way the remaining cards
// could be played ends the hand the same way, as far as scoring can tell:
// then the player may claim the rest instead of playing it out. Works for
// any trick-taking game; the game says how to copy and advance its state
// and what "the same way" means (its outcome signature).

import type { Card } from '../core/rules/cards.ts';

export interface Lines<S> {
	clone(s: S): S;
	over(s: S): boolean;
	turn(s: S): number;
	legal(s: S, seat: number): Card[];
	play(s: S, seat: number, card: Card): void;
	/** Everything about the finished hand that scoring reads, as a string. */
	outcome(s: S): string;
}

/** Search every line of play (up to a budget of positions); false if two
 *  lines end differently or the search is too big to finish. */
export function settled<S>(start: S, lines: Lines<S>, budget = 25000): boolean {
	let first: string | null = null;
	let nodes = 0;
	let ok = true;
	const go = (s: S) => {
		if (!ok) return;
		if (++nodes > budget) {
			ok = false;
			return;
		}
		if (lines.over(s)) {
			const o = lines.outcome(s);
			if (first === null) first = o;
			else if (o !== first) ok = false;
			return;
		}
		const seat = lines.turn(s);
		for (const c of lines.legal(s, seat)) {
			const n = lines.clone(s);
			lines.play(n, seat, c);
			go(n);
			if (!ok) return;
		}
	};
	go(start);
	return ok;
}

/** What became of the player's own cards (for seals and the like): each one,
 *  whether its trick went to the player's side, and whether it won. */
export function fateOfMine(tricks: { plays: { seat: number; card: Card }[]; winner: number }[], mine: (seat: number) => boolean, ours: (seat: number) => boolean): string {
	const out: string[] = [];
	for (const t of tricks) for (const p of t.plays) if (mine(p.seat)) out.push(`${p.card.suit}.${p.card.rank}:${ours(t.winner) ? 1 : 0}${p.seat === t.winner ? 1 : 0}`);
	return out.sort().join(',');
}
