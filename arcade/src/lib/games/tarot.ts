// The web arcade's tarot: the kit's view (shared with the iPad app) and the
// Svelte panel for the step before play.
import { tarotView } from '$kit/games/tarot/view.ts';
import type { GameUI } from './types.ts';
import TarotBid from './TarotBid.svelte';

export const tarotUI: GameUI = { ...tarotView, Pre: TarotBid };
