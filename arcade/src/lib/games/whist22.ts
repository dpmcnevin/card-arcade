// The web arcade's whist22: the kit's view (shared with the iPad app) and the
// Svelte panel for the step before play.
import { whist22View } from '$kit/games/whist22/view.ts';
import type { GameUI } from './types.ts';
import WhistBid from './WhistBid.svelte';

export const whist22UI: GameUI = { ...whist22View, Pre: WhistBid };
