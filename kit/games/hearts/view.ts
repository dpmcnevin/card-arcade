import * as H from './rules/hearts.ts';
import { hearts } from './module.ts';
import type { HeartsHand } from './module.ts';
import type { Run } from '../../src/run/run.ts';
import * as R from '../../src/run/run.ts';
import type { GameView, TableView } from '../../src/view/types.ts';
import { POS } from '../../src/view/types.ts';
import { keys, trickView } from '../../src/view/helpers.ts';

function view(run: Run<HeartsHand>): TableView {
	const h = run.hand;
	const st = h.state;
	const pts = st ? H.pointsTaken(st) : [0, 0, 0, 0, 0];
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: s === H.PLAYER ? 'You' : H.SEAT_NAMES[s],
		cards: st ? st.hands[s] : h.dealt[s],
		// Spyglass shows the opponents' cards for the rest of its trick.
		// Blindfold: you pass without seeing your hand.
		faceUp: (s === H.PLAYER && !(!st && R.bossIs(run, 'blindfold'))) || (!!st && h.spyTrick === st.tricks.length),
		// Card Counter: the suits each opponent has shown they're out of.
		tally: st ? `${pts[s]}${s !== H.PLAYER && R.hasRule(run, 'cardCounter') ? ' ' + [1, 2, 3, 4].filter((x) => st.voids[s][x]).map((x) => '♣♦♥♠'[x - 1]).join('') : ''}` : undefined,
		active: !!st && !st.complete && st.turn === s,
		playable: s === H.PLAYER
	}));
	return {
		seats,
		...trickView(st?.trick, st?.tricks),
		// The cards passed to you, ringed until the first trick is done.
		ringed: st && st.tricks.length === 0 ? keys(h.received) : undefined,
		// The Fog: cards after the lead stay face down until the trick is done.
		hidden: R.bossIs(run, 'fog') && st && st.trick.length ? keys(st.trick.slice(1).filter((p) => p.seat !== H.PLAYER).map((p) => p.card)) : undefined,
		legal: keys(st && !st.complete && st.turn === H.PLAYER ? H.legalPlays(st, H.PLAYER) : []),
		banner: !st ? `Pass ${h.passDir}` : h.passDir === 'hold' ? 'No passing this hand' : undefined
	};
}

export const heartsView: GameView = {
	module: hearts,
	blurb: 'Pass three, dodge every point, or take them all and shoot the moon.',
	back: 'standard',
	view: view as GameView['view'],
	handInfo(run) {
		const h = run.hand as HeartsHand;
		const st = h.state;
		const pts = st ? H.pointsTaken(st) : [0, 0, 0, 0, 0];
		const pass = h.passDir === 'hold' ? 'No passing' : `Pass ${h.passDir} to ${H.SEAT_NAMES[H.passTarget(H.PLAYER, h.passDir)]}`;
		return {
			title: `This hand · ${pass}`,
			rows: [3, 4, 1, 2].map((s) => ({ label: s === H.PLAYER ? 'You' : H.SEAT_NAMES[s], value: String(pts[s]), hot: s === H.PLAYER && pts[s] > 0 }))
		};
	},
	scoreLine(run) {
		const st = (run.hand as HeartsHand).state;
		if (!st) return '';
		const pts = H.pointsTaken(st);
		return [3, 4, 1, 2].map((s) => `${s === H.PLAYER ? 'You' : H.SEAT_NAMES[s]} ${pts[s]}`).join(' · ');
	},
	cue(run, memo) {
		const st = (run.hand as HeartsHand).state;
		if (!st) return null;
		const out: ReturnType<NonNullable<GameView['cue']>> = {};
		if (st.heartsBroken && !memo.broken) {
			memo.broken = true;
			Object.assign(out, { toast: 'Hearts are broken!', tone: 'bad', sound: 'hearts_broken' });
		}
		// Someone is taking every point so far: the moon may be on.
		const on = st.tricks.length >= 5 ? H.moonOnCourse(st) : null;
		if (on !== null && on !== H.PLAYER && !memo.moon) {
			memo.moon = true;
			return { toast: `${H.SEAT_NAMES[on]} is going for the moon!`, tone: 'bad', sound: 'doubled' };
		}
		if (on === H.PLAYER && !memo.myMoon) {
			memo.myMoon = true;
			return { toast: 'You have every point so far: shoot the moon?', tone: 'good', sound: 'mult' };
		}
		const queen = st.played.find((p) => H.isQueenOfSpades(p.card));
		if (queen && !memo.queen) {
			memo.queen = true;
			Object.assign(out, { sound: 'queen_played', shake: 4 });
		}
		const t = st.tricks.find((x) => x.plays.some((p) => H.isQueenOfSpades(p.card)));
		if (t && !memo.queenTaken) {
			memo.queenTaken = true;
			const you = t.winner === H.PLAYER;
			return { toast: you ? 'You took the queen of spades!' : `${H.SEAT_NAMES[t.winner]} took the queen`, tone: you ? 'bad' : 'good', sound: you ? 'queen_taken' : 'queen_dodged', shake: you ? 9 : 0 };
		}
		return out.toast || out.sound ? out : null;
	},
	// The pass: three cards from your hand.
	prompt(run) {
		const h = run.hand as HeartsHand;
		if (h.state || h.passDir === 'hold') return null;
		const blind = R.bossIs(run, 'blindfold');
		return {
			title: `Pass three cards ${h.passDir} to ${H.SEAT_NAMES[H.passTarget(H.PLAYER, h.passDir)]}`,
			choices: [],
			pick: { count: 3, label: 'Pass', action: { t: 'pass', cards: '$picked' } },
			hint: blind ? 'Blindfolded: you pass without seeing your hand' : 'Tap three cards to pick them'
		};
	},
	help: [
		{ title: 'The hand', text: 'Pass three cards (left, right, across, then a hand with no passing). Follow suit if you can; the highest card of the led suit wins the trick. Hearts are 1 point each and the queen of spades 13; you can’t lead hearts until one has been played.' },
		{ title: 'Scoring', text: 'Every hand scores the 26 points you dodged as chips, +10 for a clean hand (no points). Take all 26 and you shoot the moon: 78 chips, x2.' },
		{ title: 'Upgrades', text: 'The Dodge levels every hand, Clean Sheet hands where you take nothing, Moonshot the moon.' }
	],
	pick: 3
};
