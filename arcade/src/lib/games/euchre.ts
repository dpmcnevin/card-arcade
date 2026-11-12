import * as E from '$kit/games/euchre/rules.ts';
import { euchre } from '$kit/games/euchre/module.ts';
import { seatName } from '$kit/games/euchre/ai.ts';
import type { EuchreHand } from '$kit/games/euchre/rules.ts';
import type { Run } from '$kit/src/run/run.ts';
import * as cards from '$kit/src/core/rules/cards.ts';
import type { GameUI, TableView } from './types.ts';
import { POS } from './types.ts';
import { keys, trickView } from './view.ts';
import EuchreCall from './EuchreCall.svelte';

function view(run: Run<EuchreHand>): TableView {
	const h = run.hand;
	const out = E.sittingOut(h);
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: `${seatName(s)}${s === out ? ' · sitting out' : ''}`,
		dealer: s === h.dealer,
		cards: h.hands[s],
		faceUp: s === E.PLAYER,
		tally: h.trump !== null && (s === E.PLAYER || s === cards.EAST) ? `${E.tricksFor(h, s)} tricks` : undefined,
		active: !h.complete && h.turn === s,
		playable: s === E.PLAYER
	}));
	const yourTurn = h.trump !== null && !h.complete && h.turn === E.PLAYER;
	const maker = h.maker ? `${seatName(h.maker)} made ${cards.SUITS[h.trump!].name.toLowerCase()}${h.alone ? ', alone' : ''}` : '';
	return {
		seats,
		...trickView(h.trick, h.tricks),
		legal: keys(yourTurn ? E.legalPlays(h, E.PLAYER) : []),
		trump: h.trump ?? undefined,
		// Both bowers are trumps: the left one is the other jack of trump's color.
		isTrump: h.trump !== null ? (c) => E.isTrump(c, h.trump!) : undefined,
		banner: h.trump !== null ? maker : undefined
	};
}

export const euchreUI: GameUI = {
	module: euchre,
	blurb: 'Order it up or name trump, ride the bowers, march your partnership, and euchre the other side.',
	back: 'collector',
	view: view as GameUI['view'],
	Pre: EuchreCall,
	handInfo(run) {
		const h = run.hand as EuchreHand;
		if (h.trump === null) return { title: `This hand · ${seatName(h.dealer)} dealt`, rows: [{ label: 'Turned up', value: cards.name(h.upcard) }] };
		return {
			title: `This hand · ${cards.SUITS[h.trump].name} trump`,
			rows: [
				{ label: 'Makers', value: `${seatName(h.maker!)}${h.alone ? ' alone' : ''}` },
				{ label: 'Your side', value: String(E.tricksFor(h, E.PLAYER)), hot: E.tricksFor(h, E.PLAYER) >= 3 },
				{ label: 'Theirs', value: String(5 - E.tricksFor(h, E.PLAYER) - (5 - h.tricks.length)) }
			]
		};
	},
	scoreLine(run) {
		const h = run.hand as EuchreHand;
		const [us, them] = E.points(h);
		return `${seatName(h.maker!)} made ${cards.SUITS[h.trump!].name.toLowerCase()} · your side took ${E.tricksFor(h, E.PLAYER)} · game points ${us}–${them}`;
	},
	help: [
		{ title: 'The hand', text: 'Twenty-four cards, nine to ace; you and partner (North) against East and West, five cards each. A card is turned up: order it up as trump, or pass; in the second round name another suit. The dealer is stuck and must name one.' },
		{ title: 'Trumps', text: 'The jack of trumps (the right bower) is highest, then the other jack of the same color (the left bower, which counts as a trump), then A K Q 10 9. Follow the led suit if you can.' },
		{ title: 'Scoring', text: 'Your side scores 25 chips a trick. Making trump and taking all five is a march (+50, x2 alone); euchring them (they made trump, you took three) +60. Make trump and take fewer than three, and the hand scores nothing.' }
	]
};
