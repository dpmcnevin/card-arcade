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
	/** `note`: a word on a played card, when the card alone doesn't say (Whist 22's Fool: 22 or 0). */
	trick: { pos: Pos; card: Card; note?: { text: string; high?: boolean } }[];
	/** Card codes the player may play now. */
	legal: Set<string>;
	/** Trump suit, for the badge. */
	trump?: number;
	/** Which cards are trumps, to tint them (default: the trump suit). */
	isTrump?: (c: Card) => boolean;
	/** A line over the table (the contract, the pass). */
	banner?: string;
	/** Cards in your hand to ring (Hearts: the ones just passed to you). */
	ringed?: Set<string>;
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
	/** This hand at a glance, for the sidebar: a heading and label/value rows
	 *  (Hearts: the pass and each seat's points; Bridge: the contract). */
	handInfo?(run: Run): { title: string; rows: { label: string; value: string; hot?: boolean }[] } | null;
	/** One line under a hand's score title (who took what). */
	scoreLine?(run: Run): string;
	/** The same, as colored chips (Whist 22: each seat's bid, made or missed). */
	scoreChips?(run: Run): { text: string; tone?: 'good' | 'bad'; me?: boolean }[];
	/** How to play this game: titled sections for the help screen. */
	help: { title: string; text: string }[];
	/** In the pre-play step, picking this many cards from your hand (a
	 *  number, or decided by the hand: Tarot's dog is set aside only by a taker). */
	pick?: number | ((run: Run) => number);
	/** Playing this card asks a question first (Whist 22's Fool: 0 or 22):
	 *  the answers, each with the action it plays. */
	choices?(run: Run, card: Card): { label: string; action: unknown }[] | null;
	/** Order within a suit for sorting your hand, if not the rank (Tarot's knight). */
	rankOrder?(c: Card): number;
}

/** How many cards the player picks now (0: none). */
export function pickCount(ui: GameUI | undefined | null, run: Run | null | undefined): number {
	if (!ui?.pick || !run) return 0;
	return typeof ui.pick === 'number' ? ui.pick : ui.pick(run);
}
