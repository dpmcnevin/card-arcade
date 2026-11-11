// What the shell needs from each game beyond its module: how to draw the
// table, and the panel for the step before play (passing, bidding).

import type { Component } from 'svelte';
import type { Card } from '$kit/src/core/rules/cards.ts';
import type { GameModule, Run } from '$kit/src/run/run.ts';

export type Pos = 'N' | 'E' | 'S' | 'W';
export const POS: Record<number, Pos> = { 1: 'N', 2: 'E', 3: 'S', 4: 'W' };

export interface SeatView {
	pos: Pos;
	name: string;
	cards: Card[];
	faceUp: boolean;
	/** Points or tricks to show by the name. */
	tally?: string;
	/** Whose turn it is. */
	active?: boolean;
	/** This seat dealt (a dealer button by it). */
	dealer?: boolean;
	/** The player plays from this seat now (South, or Bridge's dummy). */
	playable?: boolean;
}

export interface TableView {
	seats: SeatView[];
	/** The trick on the table (the last one finished, until the next lead). */
	trick: { pos: Pos; card: Card }[];
	/** Card codes the player may play now. */
	legal: Set<string>;
	/** Trump suit, for the badge. */
	trump?: number;
	/** Which cards are trumps, to tint them (default: the trump suit). */
	isTrump?: (c: Card) => boolean;
	/** A line over the table (the contract, the pass). */
	banner?: string;
	/** Trick cards to keep face down (the Fog). */
	hidden?: Set<string>;
	/** The trick shown is a finished one (no card led to the next yet). */
	trickDone?: boolean;
	/** The last finished trick and who won it (the Last trick viewer). */
	lastTrick?: { plays: { pos: Pos; card: Card }[]; winner: Pos };
	/** Cards played so far this hand (the deck view greys them). */
	played?: Card[];
}

export interface PreProps {
	run: Run;
	/** Card codes picked in the player's hand (for passing). */
	picked: string[];
	act: (a: unknown) => void;
	/** Bumped whenever the run changes, so panels re-read it. */
	v: number;
}

export interface GameUI {
	module: GameModule;
	/** A sentence for the game picker. */
	blurb: string;
	/** Deck back for this game. */
	back: string;
	view(run: Run): TableView;
	/** The pre-play panel. */
	Pre: Component<PreProps>;
	/** The game's own moments after each move (hearts broken, the queen):
	 *  `memo` keeps what it needs between calls (reset each hand). */
	cue?(run: Run, memo: Record<string, any>): { toast?: string; tone?: 'good' | 'bad'; sound?: string; shake?: number } | null;
	/** How to play this game: titled sections for the help screen. */
	help: { title: string; text: string }[];
	/** In the pre-play step, picking this many cards from your hand. */
	pick?: number;
}
