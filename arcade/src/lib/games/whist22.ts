import * as W from '$kit/games/whist22/rules.ts';
import { whist22 } from '$kit/games/whist22/module.ts';
import { seatName } from '$kit/games/whist22/ai.ts';
import type { WhistHand } from '$kit/games/whist22/rules.ts';
import type { Run } from '$kit/src/run/run.ts';
import * as R from '$kit/src/run/run.ts';
import * as cards from '$kit/src/core/rules/cards.ts';
import type { GameUI, TableView } from './types.ts';
import { POS } from './types.ts';
import { keys, trickView } from './view.ts';
import WhistBid from './WhistBid.svelte';

function view(run: Run<WhistHand>): TableView {
	const h = run.hand;
	// The one-card round: everyone's card on their forehead, yours hidden from you.
	const forehead = h.blind && !h.complete && h.trick.length + h.tricks.length * 4 < 4;
	// The Fog: the other bids hidden until the round is over.
	const fog = R.bossIs(run, 'fog_bids') && !h.complete;
	const shownBid = (s: number) => (h.bids[s] === null ? null : fog && s !== W.PLAYER ? '?' : String(h.bids[s]));
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: seatName(s),
		dealer: s === h.dealer,
		cards: h.hands[s],
		// Second Sight: everyone's cards in view (your own too, on your forehead).
		faceUp: h.spy ? true : forehead ? s !== W.PLAYER : s === W.PLAYER,
		tally: shownBid(s) !== null ? `${h.won[s]}/${shownBid(s)}` : undefined,
		active: !h.complete && h.turn === s,
		playable: s === W.PLAYER
	}));
	const yourTurn = h.stage === 'play' && !h.complete && h.turn === W.PLAYER;
	return {
		seats,
		// The Fool says what it counted for.
		...trickView(h.trick, h.tricks, { note: (p) => (W.isFool(p.card) ? { text: p.value === 22 ? 'as 22' : 'as 0', high: p.value === 22 } : undefined) }),
		legal: keys(yourTurn ? h.hands[W.PLAYER] : []),
		isTrump: () => false,
		banner: `${h.size}-card round${h.blind ? ' · on your forehead' : ''}`
	};
}

export const whist22UI: GameUI = {
	module: whist22,
	blurb: 'Twenty-one trumps and the Fool, no suits: bid exactly the tricks you’ll take, then take exactly that. One round, on your forehead.',
	back: 'burned',
	view: view as GameUI['view'],
	Pre: WhistBid,
	choices(run, card) {
		if (!W.isFool(card)) return null;
		return [
			{ label: 'Fool as 22: win', action: { t: 'play', card: cards.code(card), fool: 22 } },
			{ label: 'Fool as 0: lose', action: { t: 'play', card: cards.code(card), fool: 0 } }
		];
	},
	handInfo(run) {
		const h = run.hand as WhistHand;
		const fog = R.bossIs(run, 'fog_bids') && !h.complete;
		const rows = [1, 2, 3, 4].map((s) => ({ label: seatName(s), value: h.bids[s] === null ? '–' : fog && s !== W.PLAYER ? `${h.won[s]}/?` : `${h.won[s]}/${h.bids[s]}`, hot: s === W.PLAYER && h.bids[s] !== null && h.won[s] > h.bids[s]! }));
		return { title: `This round · ${h.size} card${h.size === 1 ? '' : 's'} · ${fog ? 'bids hidden' : `bids ${W.bidTotal(h)} of ${h.size}`}`, rows: [rows[2], rows[3], rows[0], rows[1]] };
	},
	scoreChips(run) {
		const h = run.hand as WhistHand;
		return [3, 4, 1, 2].map((s) => {
			const made = W.madeBid(h, s);
			return { text: `${seatName(s)} ${h.won[s]}/${h.bids[s]} ${made ? '✓' : '✗'}`, tone: made ? 'good' : 'bad', me: s === W.PLAYER };
		});
	},
	scoreLine(run) {
		const h = run.hand as WhistHand;
		return [3, 4, 1, 2].map((s) => `${seatName(s)} ${h.won[s]}/${h.bids[s]}${W.madeBid(h, s) ? ' ✓' : ''}`).join(' · ');
	},
	help: [
		{ title: 'The cards', text: 'Just the twenty-one trumps and the Fool: no suits, nothing to follow. The highest card takes the trick. The Fool counts 0 or 22: you say which when you play it.' },
		{ title: 'Rounds', text: 'Round by round the hands shrink, 5, 4, 3, 2, 1 cards each, then grow back through 2, 3, 4 to 5, and around again. In the one-card round you hold your card to your forehead: you see everyone else’s, never your own.' },
		{ title: 'Bidding', text: 'Starting left of the dealer, everyone says exactly how many tricks they’ll take. The dealer bids last and may not make the bids add up to the cards dealt, so someone always misses.' },
		{ title: 'Scoring', text: 'Take exactly your bid: 40 chips plus 40 a trick bid, more for a clean zero or for making the blind round. Off by one trick scores a quarter of that; further off, nothing.' }
	]
};
