import * as T from './rules.ts';
import * as cards from '../../src/core/rules/cards.ts';
import type { Card } from '../../src/core/rules/cards.ts';
import { handCount } from './ai.ts';
import { tarot } from './module.ts';
import { seatName } from './ai.ts';
import type { TarotHand } from './rules.ts';
import type { Run } from '../../src/run/run.ts';
import type { GameView, TableView } from '../../src/view/types.ts';
import { POS } from '../../src/view/types.ts';
import { keys, trickView } from '../../src/view/helpers.ts';

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
	const yourTurn = playing && !h.complete && h.turn === T.PLAYER;
	return {
		seats,
		...trickView(h.trick, h.tricks),
		legal: keys(yourTurn ? T.legalPlays(h, T.PLAYER) : []),
		// Trumps have their own faces; nothing to tint.
		isTrump: () => false,
		// The dog's cards, ringed in your hand while you choose what to set aside.
		ringed: h.stage === 'dog' && h.taker === T.PLAYER ? keys(h.shownDog) : undefined,
		banner: h.taker ? `${seatName(h.taker)} ${h.taker === T.PLAYER ? 'take' : 'takes'} a ${bidName(h.contract!)}` : undefined
	};
}

export const tarotView: GameView = {
	module: tarot,
	blurb: 'Bid to take the dog and play alone against three, or defend with the table: oudlers, the Petit, and the Excuse.',
	back: 'schemer',
	view: view as GameView['view'],
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
	// Bidding, then (if you take a Prise or Garde) the dog: six to set aside.
	prompt(run) {
		const h = run.hand as TarotHand;
		if (h.stage === 'bid' && h.turn === T.PLAYER) {
			const high = T.highBid(h);
			return {
				title: 'Your bid',
				lines: [`${seatName(h.dealer)} dealt`, ...h.bids.map((b) => `${seatName(b.seat)}: ${b.bid ? T.BIDS[b.bid - 1].name : 'pass'}`)],
				choices: [
					...T.BIDS.map((b, i) => ({ label: b.name, sub: b.mult > 1 ? `x${b.mult}` : undefined, action: { t: 'bid', bid: i + 1 }, enabled: i + 1 > high, primary: i === 0 })),
					{ label: 'Pass', action: { t: 'bid', bid: 0 } }
				],
				hint: `Hand count ${handCount(h.hands[T.PLAYER])}: about 36 to take, 52 to guard`
			};
		}
		if (h.stage === 'dog' && h.taker === T.PLAYER) {
			return {
				title: 'The dog is yours',
				lines: ['Pick six cards in your hand to set aside: no kings or oudlers. They count for you.'],
				cards: h.shownDog,
				choices: [],
				pick: { count: T.DOG_SIZE, label: 'Set aside', action: { t: 'aside', cards: '$picked' } }
			};
		}
		return null;
	},
	checkPick(run, codes) {
		const h = run.hand as TarotHand;
		const hand = h.hands[T.PLAYER];
		const sofar: Card[] = [];
		for (const code of codes) {
			const c = hand.find((x) => cards.code(x) === code);
			if (!c) return 'Not in your hand';
			if (!T.canSetAside(hand, c, sofar)) return `You can’t set aside ${cards.name(c)}${T.isKing(c) ? ' (a king)' : T.isOudler(c) ? ' (an oudler)' : ' while you have other cards'}`;
			sofar.push(c);
		}
		return null;
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
