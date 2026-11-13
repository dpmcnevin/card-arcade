import * as cards from '../../src/core/rules/cards.ts';
import { bidOptions, recommendBid } from './module.ts';
import * as play from './rules/play.ts';
import { bridge, isPlayerTurn } from './module.ts';
import type { Deal } from './module.ts';
import type { Run } from '../../src/run/run.ts';
import type { GameView, TableView } from '../../src/view/types.ts';
import { POS } from '../../src/view/types.ts';
import { keys, trickView } from '../../src/view/helpers.ts';

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
	const c = d.contract;
	return {
		seats,
		...trickView(st?.trick, st?.tricks),
		legal: keys(st && isPlayerTurn(run) ? play.legalPlays(st, st.turn) : []),
		trump: c && c.strain !== cards.NOTRUMP ? c.strain : undefined,
		banner: c ? `${cards.contractName(c)}${c.doubled ? ' doubled' : ''} · need ${6 + c.level} tricks` : undefined
	};
}

export const bridgeView: GameView = {
	module: bridge,
	blurb: 'Bid from your hand and partner’s, declare, play dummy, and score by the duplicate table.',
	back: 'royal',
	view: view as GameView['view'],
	handInfo(run) {
		const d = run.hand as Deal;
		if (!d.contract) return { title: 'This deal · bidding', rows: [{ label: 'Partner', value: d.partnerInfo.range.name }, { label: 'Your HCP', value: String(cards.hcp(d.hands[d.declarer])) }] };
		const st = d.state!;
		const need = 6 + d.contract.level;
		return {
			title: `This deal · ${cards.contractName(d.contract)}${d.contract.doubled ? ' doubled' : ''}`,
			rows: [
				{ label: 'You', value: String(st.nsTricks), hot: st.nsTricks >= need },
				{ label: 'Need', value: String(need) },
				{ label: 'They', value: String(st.ewTricks) }
			]
		};
	},
	scoreLine(run) {
		const d = run.hand as Deal;
		const st = d.state;
		return st && d.contract ? `${cards.contractName(d.contract)} · you took ${st.nsTricks} of 13 · needed ${6 + d.contract.level}` : '';
	},
	// The bid grid: every contract with its chance to make and projected score.
	prompt(run) {
		const d = run.hand as Deal;
		if (d.contract) return null;
		const opts = bidOptions(run);
		const rec = recommendBid(run, opts);
		const need = run.target - run.score;
		const choices = [];
		for (let level = 1; level <= 7; level++)
			for (let strain = 1; strain <= 5; strain++) {
				const o = opts.find((x) => x.contract.level === level && x.contract.strain === strain)!;
				choices.push({
					label: `${level}${cards.STRAINS[strain].glyph}`,
					sub: `${Math.round(o.chance * 100)}% · ${o.projected}`,
					action: { t: 'bid', level, strain },
					star: rec.level === level && rec.strain === strain,
					primary: o.projected >= need
				});
			}
		return {
			title: 'Your bid',
			lines: [`Partner: ${d.partnerInfo.text} · you hold ${cards.hcp(d.hands[d.declarer])} HCP`, `Need ${need} more on this board`],
			grid: 5,
			choices,
			hint: '★ the best bet · gold: enough to clear the board'
		};
	},
	help: [
		{ title: 'The deal', text: 'You declare every deal from South and play dummy (North) too, against two defenders. Partner’s hand is shown only as a bid: a point range, a long suit, balanced or not.' },
		{ title: 'Bidding', text: 'Pick a contract: a level (tricks over six) and a strain. The grid shows each contract’s chance of making and the least it would score; the star is the recommended bid. Bid too high and the defenders may double you.' },
		{ title: 'Scoring', text: 'A made contract scores by the duplicate table (contract points, overtricks, part-score, game and slam bonuses, vulnerability) as points. A failed contract scores nothing. Conventions level up a strain.' }
	]
};
