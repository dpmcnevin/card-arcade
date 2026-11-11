// One page per game: /hearts/, /bridge/, /euchre/, prerendered for Pages.

import { error } from '@sveltejs/kit';
import { GAMES, byId } from '$lib/games/index.ts';

export const entries = () => GAMES.map((g) => ({ game: g.module.id }));

export function load({ params }) {
	if (!byId(params.game)) error(404, 'No such game');
	return { game: params.game };
}
