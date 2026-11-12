// Small things every game module needs: its goals table, finding a card by
// its code, the played-cards list scoring reads (seals, editions), and the
// loop that lets the AI seats play until it's the player's turn.

import * as cards from '../core/rules/cards.ts';
import type { Card } from '../core/rules/cards.ts';
import type { GameModule } from './run.ts';

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** A goal for each board: a base per table (past the last, the last one)
 *  times a scale per board, rounded to `step`. */
export function goals(base: number[], scale: number[], step = 10): GameModule['goal'] {
	return (table, board) => roundTo(base[Math.min(table, base.length) - 1] * scale[board - 1], step);
}

/** The card in a hand with this code ("10S", "21T", "EX"), if it's there. */
export const findCard = (hand: Card[], code: string) => hand.find((c) => cards.code(c) === code);

export interface PlayedCard {
	card: Card;
	/** Played by the player (or their dummy). */
	mine: boolean;
	/** Its trick went to the player's side. */
	wonByUs: boolean;
	/** It won its trick. */
	winning: boolean;
}

/** Every card played this hand, for what scores per card (seals, editions). */
export function playedCards(tricks: { plays: { seat: number; card: Card }[]; winner: number }[], mine: (seat: number) => boolean, ours: (seat: number) => boolean): PlayedCard[] {
	return tricks.flatMap((t) => t.plays.map((p) => ({ card: p.card, mine: mine(p.seat), wonByUs: ours(t.winner), winning: p.seat === t.winner })));
}

/** Step the AI until `done`; a game that never gets there is a bug, so stop
 *  after `limit` steps and say so. */
export function aiUntil(done: () => boolean, step: () => void, limit: number, what: string) {
	for (let i = 0; !done(); i++) {
		if (i >= limit) throw new Error(`${what} stuck`);
		step();
	}
}
