import * as E from './rules.ts';
import { euchre } from './module.ts';
import { seatName } from './ai.ts';
import type { EuchreHand } from './rules.ts';
import type { Run } from '../../src/run/run.ts';
import * as cards from '../../src/core/rules/cards.ts';
import type { GameView, TableView } from '../../src/view/types.ts';
import { POS } from '../../src/view/types.ts';
import { keys, trickView } from '../../src/view/helpers.ts';

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

export const euchreView: GameView = {
	module: euchre,
	blurb: 'Order it up or name trump, ride the bowers, march your partnership, and euchre the other side.',
	back: 'collector',
	view: view as GameView['view'],
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
	// Order it up (round 1) or name a suit (round 2), alone if you dare, or pass.
	prompt(run) {
		const h = run.hand as EuchreHand;
		if (h.trump !== null || h.turn !== E.PLAYER) return null;
		const stuck = h.round === 2 && h.dealer === E.PLAYER;
		const g = (s: number) => cards.SUITS[s].glyph;
		type Choice = { label: string; action: unknown; primary?: boolean; enabled?: boolean };
		const choices: Choice[] =
			h.round === 1
				? [
						{ label: `Order up ${g(h.upcard.suit)}`, action: { t: 'call', suit: h.upcard.suit, alone: false }, primary: true },
						{ label: `Order up alone`, action: { t: 'call', suit: h.upcard.suit, alone: true } }
					]
				: cards.SUIT_ORDER.filter((s) => s !== h.upcard.suit).flatMap((s) => [
						{ label: g(s), action: { t: 'call', suit: s, alone: false }, primary: true },
						{ label: `${g(s)} alone`, action: { t: 'call', suit: s, alone: true } }
					]);
		choices.push({ label: 'Pass', action: { t: 'pass' }, enabled: !stuck });
		return {
			title: h.round === 1 ? 'Order it up?' : stuck ? 'You’re stuck: name trump' : 'Name a suit?',
			lines: [`${seatName(h.dealer)} dealt`, ...h.calls.map((c) => `${seatName(c.seat)} ${c.text}`)],
			cards: h.round === 1 ? [h.upcard] : [],
			choices
		};
	},
	help: [
		{ title: 'The hand', text: 'Twenty-four cards, nine to ace; you and partner (North) against East and West, five cards each. A card is turned up: order it up as trump, or pass; in the second round name another suit. The dealer is stuck and must name one.' },
		{ title: 'Trumps', text: 'The jack of trumps (the right bower) is highest, then the other jack of the same color (the left bower, which counts as a trump), then A K Q 10 9. Follow the led suit if you can.' },
		{ title: 'Scoring', text: 'Your side scores 25 chips a trick. Making trump and taking all five is a march (+50, x2 alone); euchring them (they made trump, you took three) +60. Make trump and take fewer than three, and the hand scores nothing.' }
	]
};
