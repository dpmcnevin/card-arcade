// Bridge for the native iPad app. Bundled with esbuild into game-bundle.js and
// run in a JavaScriptCore context. It reuses the kit and every game's module
// and shared view unmodified, and exposes a flat JSON-in/JSON-out API on
// `globalThis.CardArcade`. The run lives here; Swift sends actions and draws
// the snapshot `view()` returns.
//
// Every action goes through the same `apply` the web arcade uses and is
// appended to the save, so saves are interchangeable with the web build's.
// Game moves are applied stepwise: Swift paces the other seats with stepAI().

import './polyfills.ts';
import * as cards from '../src/core/rules/cards.ts';
import type { Card } from '../src/core/rules/cards.ts';
import * as R from '../src/run/run.ts';
import type { Run, ShopItem, BundleChoice } from '../src/run/run.ts';
import * as C from '../src/run/content.ts';
import { apply, replay, undo, type Action, type Save } from '../src/run/save.ts';
import { buildLog } from '../src/run/gamelog.ts';
import * as profileLib from '../src/run/profile.ts';
import { faceBitmap, backBitmap } from '../src/core/ui/pixelcards.ts';
import { bitmap as iconBitmap, artBitmap } from '../src/core/ui/icons.ts';
import { sealBitmap } from '../src/core/ui/sealart.ts';
import { toRGBA, type Bitmap } from '../src/core/ui/pixel.ts';
import type { GameView, TableView } from '../src/view/types.ts';
import { cardKey } from '../src/view/helpers.ts';
import { newRng } from '../src/core/rules/rng.ts';
import { heartsView } from '../games/hearts/view.ts';
import { bridgeView } from '../games/bridge/view.ts';
import { euchreView } from '../games/euchre/view.ts';
import { tarotView } from '../games/tarot/view.ts';
import { whist22View } from '../games/whist22/view.ts';

const GAMES: GameView[] = [heartsView, bridgeView, euchreView, tarotView, whist22View];
const byId = (id: string) => GAMES.find((g) => g.module.id === id);

let ui: GameView | null = null;
let run: Run | null = null;
let save: Save | null = null;
/** The game's memo for cues (reset each hand). */
let memo: Record<string, any> = {};
let memoHand = -1;

// ------------------------------------------------------------------ encoding

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes: Uint8Array | Uint8ClampedArray): string {
	let out = '';
	let i = 0;
	for (; i + 2 < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
	}
	const rest = bytes.length - i;
	if (rest === 1) {
		const n = bytes[i] << 16;
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
	} else if (rest === 2) {
		const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
	}
	return out;
}

function image(b: Bitmap): string {
	return JSON.stringify({ w: b.w, h: b.h, rgba: base64(toRGBA(b, 1)) });
}

// ------------------------------------------------------------------ snapshot

function sealView(s: C.SealDef | undefined) {
	return s ? { key: s.key, name: s.name, text: s.text, glyph: s.glyph, color: s.color } : null;
}

function cardView(c: Card, tv?: TableView) {
	const r = run!;
	const m = R.mod(r, c);
	const trump = tv ? (tv.isTrump ? tv.isTrump(c) : tv.trump !== undefined && c.suit === tv.trump) : false;
	return { id: c.id ?? 0, suit: c.suit, rank: c.rank, code: cards.code(c), key: cardKey(c), name: cards.name(c), edition: m.edition ?? null, seal: sealView(R.sealOf(r, c)), trump, suitOrder: cards.suitRank(c.suit), rankOrder: ui?.rankOrder?.(c) ?? c.rank };
}

function relicEdition(key: C.RelicEditionKey | undefined) {
	if (!key) return null;
	const e = C.RELIC_EDITIONS[key];
	return { key: e.key, name: e.name, text: e.text };
}

function choiceView(c: BundleChoice) {
	const r = run!;
	if (c.kind === 'relic') return { kind: 'relic', name: c.def.name, text: c.def.text, icon: c.def.icon, rarity: c.def.rarity, rarityName: R.RARITY_NAME[c.def.rarity], edition: relicEdition(c.edition), card: null, cardEdition: null };
	if (c.kind === 'ploy') return { kind: 'ploy', name: c.def.name, text: c.def.text, icon: c.def.icon, rarity: null, rarityName: null, edition: null, card: null, cardEdition: null };
	const card = r.pack.find((x) => x.id === c.cardId)!;
	const e = C.CARD_EDITIONS[c.edition];
	return { kind: 'edition', name: `${e.name} ${cards.name(card)}`, text: e.text, icon: null, rarity: null, rarityName: null, edition: null, card: cardView(card), cardEdition: c.edition };
}

function shopItem(it: ShopItem, i: number) {
	const r = run!;
	const [ok, why] = R.canBuy(r, i);
	const base = { slot: i, kind: it.kind, name: it.name, cost: it.cost, sold: !!it.sold, canBuy: ok, why: why ?? null, needsCard: R.needsCard(it) };
	switch (it.kind) {
		case 'relic':
			return { ...base, text: it.def.text, icon: it.def.icon, rarity: it.def.rarity, rarityName: R.RARITY_NAME[it.def.rarity], edition: relicEdition(it.edition) };
		case 'upgrade': {
			const lvl = r.levels[it.def.key] ?? 1;
			return { ...base, text: it.def.text, icon: it.def.icon, glyph: it.def.glyph ?? null, level: lvl, chips: it.def.chips, mult: it.def.mult };
		}
		case 'seal':
			return { ...base, text: it.def.text, seal: sealView(it.def) };
		case 'edition':
			return { ...base, text: it.def.text, cardEdition: it.def.key };
		case 'bundle':
		case 'ploy':
		case 'pack':
			return { ...base, text: it.def.text, icon: it.def.icon };
	}
}

function tableView(tv: TableView) {
	return {
		seats: tv.seats.map((s) => ({ pos: s.pos, name: s.name, cards: s.cards.map((c) => cardView(c, tv)), faceUp: s.faceUp, tally: s.tally ?? null, active: !!s.active, dealer: !!s.dealer, playable: !!s.playable })),
		trick: tv.trick.map((p) => ({ pos: p.pos, card: cardView(p.card, tv), note: p.note ?? null })),
		/** Card keys ("suit-rank") the player may play now; ringed and hidden too. */
		legal: [...tv.legal],
		trump: tv.trump ?? null,
		banner: tv.banner ?? null,
		ringed: tv.ringed ? [...tv.ringed] : [],
		hidden: tv.hidden ? [...tv.hidden] : [],
		trickDone: !!tv.trickDone,
		lastTrick: tv.lastTrick ? { plays: tv.lastTrick.plays.map((p) => ({ pos: p.pos, card: cardView(p.card, tv) })), winner: tv.lastTrick.winner } : null,
		played: (tv.played ?? []).map((c) => cardKey(c))
	};
}

function view() {
	const r = run,
		g = ui;
	if (!r || !g) return { hasRun: false };
	const m = r.module;
	const tv = g.view(r);
	const deck = R.allDecks(m).find((d) => d.key === r.deck);
	const playing = r.phase === R.PHASE.PLAY || r.phase === R.PHASE.PRE;
	const prompt = r.phase === R.PHASE.PRE ? (g.prompt?.(r) ?? null) : null;
	const scored = r.phase === R.PHASE.SCORED || r.phase === R.PHASE.WON || r.phase === R.PHASE.OVER || r.phase === R.PHASE.VICTORY;
	// Cards that ask a question when played (Whist 22's Fool).
	const cardChoices: Record<string, { label: string; action: string }[]> = {};
	if (g.choices && r.phase === R.PHASE.PLAY)
		for (const s of tv.seats)
			for (const c of s.cards) {
				const code = cards.code(c);
				if (!tv.legal.has(cardKey(c))) continue;
				const ch = g.choices(r, c);
				if (ch) cardChoices[code] = ch.map((x) => ({ label: x.label, action: JSON.stringify(x.action) }));
			}
	return {
		hasRun: true,
		game: m.id,
		title: m.title,
		words: m.words,
		seed: String(r.seed),
		deck: r.deck,
		deckName: deck?.name ?? r.deck,
		back: !deck || deck.back === 'standard' ? g.back : deck.back,
		phase: r.phase,
		table: r.table,
		tables: m.tables,
		board: r.board,
		boardsPerTable: m.boardsPerTable,
		boardName: R.boardName(r),
		target: r.target,
		score: r.score,
		money: r.money,
		handsLeft: r.handsLeft,
		handsThisBoard: r.handsThisBoard,
		endless: r.endless,
		aiToMove: r.phase === R.PHASE.PLAY && R.aiToMove(r),
		boss: r.boss ? { key: r.boss.key, name: r.boss.name, text: r.boss.text, icon: r.boss.icon ?? null, active: R.bossActive(r) } : null,
		jinxed: R.bossActive(r) ? (r.jinxed ?? null) : null,
		tableBoards: Array.from({ length: m.boardsPerTable }, (_, i) => {
			const b = i + 1;
			const boss = b === m.boardsPerTable ? r.boss : null;
			const t = !boss && r.tagOffers[b - 1] ? C.TAGS[r.tagOffers[b - 1]] : null;
			return { board: b, name: m.boardName?.({ ...r, board: b }) ?? `Board ${b}`, goal: R.boardGoal(r, b), hands: boss?.hands ?? m.handsPerBoard, reward: R.MONEY_PER_BOARD + (boss ? R.BOSS_BONUS : 0), boss: boss ? { name: boss.name, text: boss.text } : null, tag: t ? { key: t.key, name: t.name, text: t.text, icon: t.icon } : null };
		}),
		skipTag: (() => {
			const t = R.skipTag(r);
			return t ? { key: t, name: C.TAGS[t].name, text: C.TAGS[t].text, icon: C.TAGS[t].icon } : null;
		})(),
		relics: r.relics.map((x, i) => ({ slot: i, key: x.key, name: x.name, rarity: x.def.rarity, rarityName: R.RARITY_NAME[x.def.rarity], icon: x.def.icon, text: x.def.describe?.(x as never) ?? x.def.text, sell: Math.max(1, Math.floor(x.cost / 2)), edition: relicEdition(x.edition) })),
		relicSlots: R.relicSlots(r),
		relicSlotsUsed: R.relicSlotsUsed(r),
		ploys: r.ploys.map((k, i) => {
			const d = R.ployDef(r, k);
			const [can, why] = R.canUsePloy(r, i);
			return { slot: i, key: k, name: d?.name ?? k, text: d?.text ?? '', icon: d?.icon ?? 'redeal', canUse: can, why: why ?? null };
		}),
		ploySlots: R.PLOY_SLOTS,
		levels: m.upgrades.map((u) => {
			const lvl = r.levels[u.key] ?? 1;
			return { key: u.key, name: u.name, icon: u.icon, glyph: u.glyph ?? null, text: u.text, level: lvl, chips: u.chips * (lvl - 1), mult: u.mult * (lvl - 1) };
		}),
		spotlight: !!r.spotlight,
		interest: R.interest(r),
		rerollCost: r.rerollCost,
		shop: r.shop ? r.shop.items.map(shopItem) : null,
		opening: r.opening ? { bundle: r.opening.bundle, name: C.BUNDLES[r.opening.bundle].name, options: r.opening.options.map(choiceView) } : null,
		payout: r.lastPayout ?? null,
		stats: r.stats,
		pack: r.pack.map((c) => cardView(c)),
		tableView: playing || scored ? tableView(tv) : null,
		handInfo: playing || scored ? (g.handInfo?.(r) ?? null) : null,
		// Actions go to Swift as JSON text, sent back as they are.
		prompt: prompt
			? {
					title: prompt.title,
					lines: prompt.lines ?? [],
					cards: (prompt.cards ?? []).map((c) => cardView(c, tv)),
					grid: prompt.grid ?? 0,
					choices: prompt.choices.map((c) => ({ label: c.label, sub: c.sub ?? null, action: JSON.stringify(c.action), enabled: c.enabled !== false, primary: !!c.primary, star: !!c.star, note: c.note ?? null })),
					pick: prompt.pick ? { count: prompt.pick.count, label: prompt.pick.label, action: JSON.stringify(prompt.pick.action) } : null,
					hint: prompt.hint ?? null
				}
			: null,
		pickCount: prompt?.pick?.count ?? 0,
		cardChoices,
		canPlayOut: r.phase === R.PHASE.PLAY && !R.aiToMove(r) && tv.legal.size > 0,
		canClaim: claimable(),
		result: r.result && scored ? { title: r.result.title, made: r.result.made, lines: r.result.lines, chips: r.result.chips, mult: r.result.mult, total: r.result.total, money: r.result.money } : null,
		scoreLine: r.result && scored ? (g.scoreLine?.(r) ?? null) : null,
		scoreChips: r.result && scored ? (g.scoreChips?.(r) ?? null) : null
	};
}

/** Can the player claim the rest of the hand? The search behind it is slow
 *  without a JIT, so it's asked only on the player's turn, once per move. */
let claimAt = -1;
let claimWas = false;
function claimable(): boolean {
	const r = run!;
	if (r.phase !== R.PHASE.PLAY || R.aiToMove(r) || !r.module.settled) return false;
	const at = save!.actions.length * 1000 + r.stats.hands;
	if (claimAt !== at) {
		claimAt = at;
		claimWas = r.module.settled(r);
	}
	return claimWas;
}

/** The game's own moment after a move (hearts broken), if any. */
function cue() {
	const r = run!,
		g = ui!;
	if (!g.cue) return null;
	if (memoHand !== r.stats.hands) {
		memo = {};
		memoHand = r.stats.hands;
	}
	return g.cue(r, memo) ?? null;
}

// ------------------------------------------------------------------ API

function start(id: string, s: Save | null, deck?: string | null) {
	const g = byId(id);
	if (!g) throw new Error(`no game ${id}`);
	ui = g;
	if (s) {
		run = replay(g.module, s);
		save = { ...s, actions: s.actions.slice() };
	} else {
		const d = deck && R.allDecks(g.module).some((x) => x.key === deck) ? deck : 'standard';
		run = R.newRun(g.module, undefined, { deck: d });
		save = { version: 1, game: id, seed: run.seed, deck: d, actions: [] };
	}
	memo = {};
	memoHand = -1;
	claimAt = -1;
}

function act(json: string): string {
	if (!run || !save || !ui) throw new Error('no run');
	const a = JSON.parse(json) as Action;
	const before = run.phase;
	// Undo: rewind the save to before your last card, and replay it.
	if (a.t === 'ploy' && run.ploys[a.slot] === 'undo') {
		const ok = R.canUsePloy(run, a.slot);
		const back = ok[0] ? undo(save) : null;
		if (!back) return JSON.stringify({ ok: false, error: `Can't: ${ok[1] ?? 'nothing to take back'}`, view: view() });
		save = back;
		run = replay(ui.module, back);
		return JSON.stringify({ ok: true, undone: true, phaseChanged: false, cue: null, view: view() });
	}
	try {
		const out = a.t === 'game' ? R.act(run, a.a, { stepwise: true }) : apply(run, a);
		if (Array.isArray(out) && out[0] === false) return JSON.stringify({ ok: false, error: `Can't: ${out[1]}`, view: view() });
		if (out === false) return JSON.stringify({ ok: false, error: 'Can’t do that now', view: view() });
	} catch (e) {
		return JSON.stringify({ ok: false, error: (e as Error).message, view: view() });
	}
	save.actions.push(a);
	return JSON.stringify({ ok: true, phaseChanged: run.phase !== before, cue: a.t === 'game' ? cue() : null, view: view() });
}

const api = {
	/** The games, for the menu: each with its decks and help. */
	games: () =>
		JSON.stringify(
			GAMES.map((g) => ({
				id: g.module.id,
				title: g.module.title,
				tagline: g.module.tagline,
				blurb: g.blurb,
				back: g.back,
				words: g.module.words,
				tables: g.module.tables,
				decks: R.allDecks(g.module).map((d) => ({ key: d.key, name: d.name, text: d.text, back: d.back === 'standard' ? g.back : d.back })),
				help: g.help
			}))
		),
	newRun(game: string, deck?: string | null): string {
		start(game, null, deck);
		return JSON.stringify(view());
	},
	restore(json: string): string {
		const s = JSON.parse(json) as Save;
		start(s.game, s);
		return JSON.stringify(view());
	},
	/** Is this save a run still going (replays cleanly, not over)? */
	resumable(json: string): boolean {
		try {
			const s = JSON.parse(json) as Save;
			const g = byId(s.game);
			if (!g) return false;
			const r = replay(g.module, s);
			return r.phase !== R.PHASE.OVER && r.phase !== R.PHASE.VICTORY;
		} catch {
			return false;
		}
	},
	save: () => (save ? JSON.stringify(save) : ''),
	/** A compact text log of this run, to send for analysis. */
	gameLog: () => (save && ui ? buildLog(ui.module, save) : ''),
	act,
	/** One AI seat plays: 'trick' if it finished a trick, 'card', or null. */
	stepAI(): string {
		if (!run) throw new Error('no run');
		const before = run.phase;
		const r = R.stepAI(run);
		return JSON.stringify({ step: r, phaseChanged: run.phase !== before, cue: cue(), view: view() });
	},
	view: () => JSON.stringify(view()),
	/** The bot's move now, as a game action (autoplay and tests). */
	bot(seed: string): string {
		if (!run || !ui) throw new Error('no run');
		return JSON.stringify(ui.module.bot(run, newRng(seed)));
	},
	/** Why these picked cards can't go (Tarot's dog), or '' if they can. */
	checkPick: (codes: string) => (run && ui?.checkPick ? (ui.checkPick(run, JSON.parse(codes)) ?? '') : ''),
	/** Can a pack item (burn, promote...) be used on this card? */
	canApply(slot: number, cardId: number): string {
		const it = run?.shop?.items[slot];
		if (!run || !it) return JSON.stringify([true]);
		const card = run.pack.find((c) => c.id === cardId);
		return JSON.stringify(it.kind === 'pack' ? R.canApplyPack(run, it.def, card) : [true]);
	},
	/** Bring a game's profile (stored JSON) up to date with this run. */
	noteProfile(json: string, id: string): string {
		const p = profileLib.parseProfile(json || null);
		if (run) profileLib.noteRun(p, run, id);
		return JSON.stringify(p);
	},
	/** Everything in a game, for its collection page. */
	catalog(game: string): string {
		const g = byId(game);
		if (!g) return '{}';
		const m = g.module;
		return JSON.stringify({
			relics: [...m.relics].sort((a, b) => a.rarity - b.rarity || a.cost - b.cost).map((d) => ({ key: d.key, name: d.name, text: d.text, rarity: d.rarity, rarityName: R.RARITY_NAME[d.rarity], cost: d.cost, icon: d.icon })),
			ploys: R.allPloys(m).map((p) => ({ key: p.key, name: p.name, text: p.text, cost: p.cost, icon: p.icon })),
			bosses: (m.bosses ?? []).map((b) => ({ key: b.key, name: b.name, text: b.text, icon: b.icon ?? null, tier: b.tier ?? 1 })),
			decks: R.allDecks(m).map((d) => ({ key: d.key, name: d.name, text: d.text, back: d.back === 'standard' ? g.back : d.back })),
			seals: R.allSeals(m).map((s) => sealView(s)),
			cardEditions: Object.values(C.CARD_EDITIONS).map((e) => ({ key: e.key, name: e.name, text: e.text, cost: e.cost })),
			relicEditions: Object.values(C.RELIC_EDITIONS).map((e) => ({ key: e.key, name: e.name, text: e.text, cost: e.cost })),
			upgrades: m.upgrades.map((u) => ({ key: u.key, name: u.name, text: u.text, icon: u.icon, glyph: u.glyph ?? null, chips: u.chips, mult: u.mult })),
			counterNames: m.counterNames ?? {}
		});
	},
	cardImage: (suit: number, rank: number, trump: boolean, fourColor: boolean) => image(faceBitmap({ suit, rank }, trump, fourColor)),
	backImage: (deck?: string) => image(backBitmap(deck)),
	iconImage: (key: string) => image(iconBitmap(key)),
	/** An icon's art alone, without its tile (to draw it large). */
	iconArt: (key: string) => image(artBitmap(key)),
	sealImage: (glyph: string, color: string) => image(sealBitmap(glyph, color))
};

(globalThis as Record<string, unknown>).CardArcade = api;
