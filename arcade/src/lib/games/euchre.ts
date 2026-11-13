// The web arcade's euchre: the kit's view (shared with the iPad app) and the
// Svelte panel for the step before play.
import { euchreView } from '$kit/games/euchre/view.ts';
import type { GameUI } from './types.ts';
import EuchreCall from './EuchreCall.svelte';

export const euchreUI: GameUI = { ...euchreView, Pre: EuchreCall };
