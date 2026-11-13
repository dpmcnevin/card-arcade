// Pieces every game's table view builds the same way.

import type { Card } from '../core/rules/cards.ts';
import type { Pos, TableView } from './types.ts';
import { POS } from './types.ts';

/** A card's key on the table (sprites, legal plays, picks). */
export const cardKey = (c: Card) => `${c.suit}-${c.rank}`;

/** A set of card keys. */
export const keys = (list: Card[]) => new Set(list.map(cardKey));

type Play = { seat: number; card: Card };
type Note = { text: string; high?: boolean } | undefined;

/** The trick fields of a table view, from the trick in progress and the
 *  tricks finished so far: the trick shown (the last finished one until the
 *  next lead), whether it's finished, the Last trick viewer, every card
 *  played. Seats map to positions with `pos` (default: North at the top);
 *  `note` puts a word on a played card (the Fool's value). */
export function trickView<P extends Play>(current: P[] | undefined, finished: { plays: P[]; winner: number }[] | undefined, opts: { pos?: Record<number, Pos>; note?: (p: P) => Note } = {}): Pick<TableView, 'trick' | 'trickDone' | 'lastTrick' | 'played'> {
	const pos = opts.pos ?? POS;
	const cur = current ?? [];
	const done = finished ?? [];
	const last = done.at(-1);
	const shown = cur.length ? cur : (last?.plays ?? []);
	return {
		trick: shown.map((p) => ({ pos: pos[p.seat], card: p.card, note: opts.note?.(p) })),
		trickDone: !cur.length && done.length > 0,
		lastTrick: last ? { plays: last.plays.map((p) => ({ pos: pos[p.seat], card: p.card })), winner: pos[last.winner] } : undefined,
		played: done.flatMap((t) => t.plays.map((p) => p.card)).concat(cur.map((p) => p.card))
	};
}
