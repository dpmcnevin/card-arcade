import * as T from '$kit/games/tarot/rules.ts';
import { tarot } from '$kit/games/tarot/module.ts';
import { seatName } from '$kit/games/tarot/ai.ts';
import type { TarotHand } from '$kit/games/tarot/rules.ts';
import type { Run } from '$kit/src/run/run.ts';
import type { Card } from '$kit/src/core/rules/cards.ts';
import type { GameUI, TableView } from './types.ts';
import { POS } from './types.ts';
import TarotBid from './TarotBid.svelte';

const key = (c: Card) => `${c.suit}-${c.rank}`;
const bidName = (b: number) => T.BIDS[b - 1].name;

function view(run: Run<TarotHand>): TableView {
	const h = run.hand;
	const playing = h.stage === 'play';
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: `${seatName(s) === 'You' ? 'You' : seatName(s)}${s === h.taker ? ' · taker' : ''}`,
		dealer: s === h.dealer,
		cards: h.hands[s],
		faceUp: s === T.PLAYER,
		tally: playing ? `${Math.round(T.halfTaken(h, s) / 2)} pts` : undefined,
		active: !h.complete && h.turn === s && (playing || h.stage === 'bid'),
		playable: s === T.PLAYER
	}));
	const shown = h.trick.length ? h.trick : (h.tricks.at(-1)?.plays ?? []);
	const yourTurn = playing && !h.complete && h.turn === T.PLAYER;
	return {
		seats,
		trick: shown.map((p) => ({ pos: POS[p.seat], card: p.card })),
		trickDone: !h.trick.length && h.tricks.length > 0,
		lastTrick: (() => { const t = h.tricks.at(-1); return t ? { plays: t.plays.map((p) => ({ pos: POS[p.seat], card: p.card })), winner: POS[t.winner] } : undefined; })(),
		played: h.tricks.flatMap((t) => t.plays.map((p) => p.card)).concat(h.trick.map((p) => p.card)),
		legal: new Set(yourTurn ? T.legalPlays(h, T.PLAYER).map(key) : []),
		// Trumps have their own faces; nothing to tint.
		isTrump: () => false,
		// The dog's cards, ringed in your hand while you choose what to set aside.
		ringed: h.stage === 'dog' && h.taker === T.PLAYER ? new Set(h.shownDog.map(key)) : undefined,
		banner: h.taker ? `${seatName(h.taker)} ${h.taker === T.PLAYER ? 'take' : 'takes'} a ${bidName(h.contract!)}` : undefined
	};
}

export const tarotUI: GameUI = {
	module: tarot,
	blurb: 'Bid to take the dog and play alone against three, or defend with the table: oudlers, the Petit, and the Excuse.',
	back: 'schemer',
	view: view as GameUI['view'],
	Pre: TarotBid,
	pick: (run) => {
		const h = run.hand as TarotHand;
		return h.stage === 'dog' && h.taker === T.PLAYER ? T.DOG_SIZE : 0;
	},
	rankOrder: (c) => T.order(c),
	handInfo(run) {
		const h = run.hand as TarotHand;
		if (h.stage === 'bid') {
			return { title: `This hand · ${seatName(h.dealer)} dealt`, rows: h.bids.length ? h.bids.map((b) => ({ label: seatName(b.seat), value: b.bid ? bidName(b.bid) : 'pass' })) : [{ label: 'Bids', value: 'none yet' }] };
		}
		const taker = h.taker!;
		const takerHalf = T.halfTaken(h, taker);
		const oudlers = h.won[taker].filter(T.isOudler).length;
		return {
			title: `This hand · ${seatName(taker)} ${taker === T.PLAYER ? 'take' : 'takes'} a ${bidName(h.contract!)}`,
			rows: [
				{ label: 'Taker', value: String(Math.round(takerHalf / 2)), hot: taker === T.PLAYER && takerHalf / 2 >= T.NEEDED[oudlers] },
				{ label: 'Needs', value: String(T.NEEDED[oudlers]) },
				{ label: 'Defence', value: String(Math.round([1, 2, 3, 4].filter((s) => s !== taker).reduce((n, s) => n + T.halfTaken(h, s), 0) / 2)) }
			]
		};
	},
	scoreLine(run) {
		const h = run.hand as TarotHand;
		const o = T.outcome(h);
		const gp = h.taker === T.PLAYER ? o.score * 3 : -o.score;
		return `${seatName(h.taker!)} ${h.taker === T.PLAYER ? 'took' : 'took'} ${Math.round(o.takerHalf / 2)} of ${o.needed} with ${o.oudlers} oudler${o.oudlers === 1 ? '' : 's'} · ${o.made ? 'made' : 'down'} by ${o.margin} · ${gp >= 0 ? '+' : ''}${gp} game points`;
	},
	help: [
		{ title: 'The cards', text: 'Seventy-eight: four suits of fourteen (1 to 10, jack, knight, queen, king), twenty-one trumps, and the Excuse. Eighteen each, six face down: the dog.' },
		{ title: 'Bidding', text: 'One round, each bid higher than the last: Prise, Garde (x2), Garde sans (x4: the dog unseen but yours), Garde contre (x6: the dog goes to the defence). The highest bidder takes and plays alone against the other three. Everyone passes: deal again.' },
		{ title: 'The dog', text: 'After a Prise or Garde the taker takes the dog and sets six cards aside: never a king or an oudler, a trump only if nothing else will do. What’s set aside counts for the taker.' },
		{ title: 'Play', text: 'Follow suit. Can’t? Then you must trump, going higher than any trump already played if you can. When trumps are led, go higher if you can. The Excuse can be played any time: it never wins, and goes back to its owner (unless it’s played to the last trick).' },
		{ title: 'Points', text: 'Oudlers (trump 1, the 21, the Excuse) and kings are worth 4.5, queens 3.5, knights 2.5, jacks 1.5, everything else 0.5: 91 in all. The taker needs 56 with no oudlers, 51 with one, 41 with two, 36 with all three.' },
		{ title: 'Scoring', text: 'Your side’s card points score 2 chips each. Make your contract, or set the taker as a defender, for 40 more plus 6 a point of margin, multiplied for a Garde or better. Bring the Petit home in the last trick for 40; hold ten or more trumps for a poignée. Take and go down: nothing.' }
	]
};
