import * as cards from '$kit/src/core/rules/cards.ts';
import * as play from '$kit/games/bridge/rules/play.ts';
import { bridge, isPlayerTurn } from '$kit/games/bridge/module.ts';
import type { Deal } from '$kit/games/bridge/module.ts';
import type { Run } from '$kit/src/run/run.ts';
import type { GameUI, TableView } from './types.ts';
import { POS } from './types.ts';
import BridgeBid from './BridgeBid.svelte';

function view(run: Run<Deal>): TableView {
	const d = run.hand;
	const st = d.state;
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: s === d.declarer ? 'You' : s === d.dummy ? 'Dummy' : cards.SEATS[s].name,
		cards: st ? st.hands[s] : d.hands[s],
		faceUp: s === d.declarer || (s === d.dummy && d.dummyVisible),
		tally: st && s === d.declarer ? `${st.nsTricks} tricks` : st && s === cards.EAST ? `${st.ewTricks} tricks` : undefined,
		active: !!st && !st.complete && st.turn === s,
		playable: !!st && isPlayerTurn(run) && st.turn === s
	}));
	const shown = st ? (st.trick.length ? st.trick : (st.tricks.at(-1)?.plays ?? [])) : [];
	const c = d.contract;
	return {
		seats,
		trick: shown.map((p) => ({ pos: POS[p.seat], card: p.card })),
		trickDone: !!st && !st.trick.length && st.tricks.length > 0,
		lastTrick: (() => { const t = st?.tricks.at(-1); return t ? { plays: t.plays.map((p) => ({ pos: POS[p.seat], card: p.card })), winner: POS[t.winner] } : undefined; })(),
		played: st ? st.played.map((p) => p.card) : [],
		legal: new Set(st && isPlayerTurn(run) ? play.legalPlays(st, st.turn).map((x) => `${x.suit}-${x.rank}`) : []),
		trump: c && c.strain !== cards.NOTRUMP ? c.strain : undefined,
		banner: c ? `${cards.contractName(c)}${c.doubled ? ' doubled' : ''} · need ${6 + c.level} tricks` : undefined
	};
}

export const bridgeUI: GameUI = {
	module: bridge,
	blurb: 'Bid from your hand and partner’s, declare, play dummy, and score by the duplicate table.',
	back: 'royal',
	view: view as GameUI['view'],
	Pre: BridgeBid,
	help: [
		{ title: 'The deal', text: 'You declare every deal from South and play dummy (North) too, against two defenders. Partner’s hand is shown only as a bid: a point range, a long suit, balanced or not.' },
		{ title: 'Bidding', text: 'Pick a contract: a level (tricks over six) and a strain. The grid shows each contract’s chance of making and the least it would score; the star is the recommended bid. Bid too high and the defenders may double you.' },
		{ title: 'Scoring', text: 'A made contract scores by the duplicate table (contract points, overtricks, part-score, game and slam bonuses, vulnerability) as points. A failed contract scores nothing. Conventions level up a strain.' }
	]
};
