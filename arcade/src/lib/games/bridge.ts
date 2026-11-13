// The web arcade's bridge: the kit's view (shared with the iPad app) and the
// Svelte panel for the step before play.
import { bridgeView } from '$kit/games/bridge/view.ts';
import type { GameUI } from './types.ts';
import BridgeBid from './BridgeBid.svelte';

export const bridgeUI: GameUI = { ...bridgeView, Pre: BridgeBid };
