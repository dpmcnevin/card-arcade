// The web arcade's hearts: the kit's view (shared with the iPad app) and the
// Svelte panel for the step before play.
import { heartsView } from '$kit/games/hearts/view.ts';
import type { GameUI } from './types.ts';
import HeartsPass from './HeartsPass.svelte';

export const heartsUI: GameUI = { ...heartsView, Pre: HeartsPass };
