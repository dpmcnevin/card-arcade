import { heartsUI } from './hearts.ts';
import { bridgeUI } from './bridge.ts';
import { euchreUI } from './euchre.ts';
import type { GameUI } from './types.ts';

/** Every game in the arcade. Adding one: a kit module plus a GameUI. */
export const GAMES: GameUI[] = [heartsUI, bridgeUI, euchreUI];
export const byId = (id: string) => GAMES.find((g) => g.module.id === id);
