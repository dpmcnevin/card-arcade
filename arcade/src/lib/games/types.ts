// The web arcade's view of a game: the kit's GameView (shared with the iPad
// app) plus the Svelte panel for the step before play.

import type { Component } from 'svelte';
import type { Run } from '$kit/src/run/run.ts';
import type { GameView } from '$kit/src/view/types.ts';

export * from '$kit/src/view/types.ts';

export interface PreProps {
	run: Run;
	/** Card codes picked in the player's hand (for passing). */
	picked: string[];
	act: (a: unknown) => void;
	/** Bumped whenever the run changes, so panels re-read it. */
	v: number;
}

export interface GameUI extends GameView {
	/** The pre-play panel. */
	Pre: Component<PreProps>;
}
