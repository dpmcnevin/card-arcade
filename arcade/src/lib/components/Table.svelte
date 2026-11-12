<!-- The table, drawn from a game's TableView: four seats, the trick in the
     middle, your hand along the bottom. Each card is a sprite that springs to
     where the view puts it; a new hand deals in from the deck. Your hand can
     be sorted, dragged into any order, or a card dragged onto the table to
     play it. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as cards from '$kit/src/core/rules/cards.ts';
	import * as R from '$kit/src/run/run.ts';
	import type { Card } from '$kit/src/core/rules/cards.ts';
	import { pickCount, type Pos } from '../games/types.ts';
	import CardSprite from './CardSprite.svelte';
	import Button from './Button.svelte';
	import { HAND_S } from '../layout.ts';
	import * as sound from '../audio/sound.ts';
	import { CARD_EDITIONS } from '$kit/src/run/content.ts';
	import { editionColor } from './editions.ts';

	const CW = 80,
		CH = 112;
	const L = $derived(arcade.layout);
	const CX = $derived(L.cx),
		CY = $derived(L.cy);

	const run = $derived((void arcade.v, arcade.run!));
	const view = $derived((void arcade.v, arcade.ui!.view(arcade.run!)));
	const pre = $derived((void arcade.v, arcade.run!.phase === R.PHASE.PRE));
	const key = (c: Card) => `${c.suit}-${c.rank}`;
	// The Standard Deck wears the game's own back; other decks their own.
	const back = $derived(run.deck === 'standard' ? arcade.ui!.back : (R.allDecks(run.module).find((d) => d.key === run.deck)?.back ?? arcade.ui!.back));
	// One key per deal, so every hand deals in fresh (the same card in the next
	// hand is a new sprite flying from the deck).
	const deal = $derived((void arcade.v, `${run.table}.${run.board}.${run.stats.hands - (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY ? 0 : 1)}.${run.ext.redeals ?? 0}`));

	interface Sprite {
		k: string;
		card: Card;
		up: boolean;
		x: number;
		y: number;
		s: number;
		z: number;
		order: number;
		click?: () => void;
		down?: (e: PointerEvent) => void;
		dim?: boolean;
		lift?: number;
		r?: number;
		hovered?: boolean;
		idle?: number | null;
		mine?: boolean;
		/** A colored ring: the trick's winner, a card just passed to you. */
		ring?: string;
	}

	const TRICK: Record<Pos, [number, number]> = { N: [0, -92], S: [0, 88], W: [-130, 0], E: [130, 0] };
	/** A played card lands a little askew, the same way each time. */
	const tilt = (c: Card) => ((((c.suit * 13 + c.rank) * 37) % 11) - 5) * 0.013;

	// ---- your hand: order and dragging
	let drag = $state<{ k: string; x: number; y: number; moved: boolean; sx: number; sy: number } | null>(null);
	let suppress = false;
	let stage: HTMLElement | null = null;
	function toStage(e: PointerEvent): [number, number] {
		stage ??= document.querySelector('.stage');
		const r = stage!.getBoundingClientRect();
		const k = L.W / r.width;
		return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
	}

	/** Your hand in your order: by suit (each low to high), by rank (low to
	 *  high), or as you dragged it. */
	function ordered(hand: Card[]): Card[] {
		const o = arcade.order;
		if (o.length && hand.every((c) => o.includes(key(c)))) return hand.slice().sort((a, b) => o.indexOf(key(a)) - o.indexOf(key(b)));
		const rk = (c: Card) => arcade.ui?.rankOrder?.(c) ?? c.rank;
		const bySuit = (a: Card, b: Card) => b.suit - a.suit || rk(a) - rk(b);
		const byRank = (a: Card, b: Card) => rk(a) - rk(b) || b.suit - a.suit;
		return hand.slice().sort(arcade.sortBy === 'rank' ? byRank : bySuit);
	}

	/** Where n cards of your hand go: a gentle arc, the middle highest. */
	function fan(n: number) {
		const w = CW * HAND_S,
			h = CH * HAND_S;
		// A short hand spreads out; a long one overlaps to fit.
		const gap = n > 1 ? Math.min(w * 0.82, (L.handW - w) / (n - 1)) : 0;
		const x0 = CX - (w + gap * (n - 1)) / 2 + w / 2;
		return {
			w, h, gap, x0,
			at: (i: number) => {
				const k = i + 1 - (n + 1) / 2;
				return { x: x0 + i * gap, y: L.handY + k * k * 0.45, r: k * 0.02 };
			},
			/** The place a card dropped at x would take. */
			index: (x: number) => Math.max(0, Math.min(n - 1, Math.round((x - x0) / Math.max(1, gap))))
		};
	}

	/** Your hand as shown: in order, with a dragged card already in its new place. */
	const hand = $derived.by(() => {
		void arcade.v;
		const seat = view.seats.find((s) => s.pos === 'S');
		if (!seat) return [] as Card[];
		const list = ordered(seat.cards);
		const d = drag;
		if (!d?.moved) return list;
		const card = list.find((c) => key(c) === d.k);
		if (!card) return list;
		const rest = list.filter((c) => c !== card);
		rest.splice(fan(list.length).index(d.x), 0, card);
		return rest;
	});

	// ---- the card under the pointer, and what a card in your hand does
	let hover = $state<string | null>(null);
	/** The hand card under the pointer, playable or not: its mods show above it. */
	let under = $state<string | null>(null);
	const picking = $derived((void arcade.v, pre && pickCount(arcade.ui, arcade.run) > 0));
	const south = $derived(view.seats.find((s) => s.pos === 'S'));
	function actionable(k: string): boolean {
		if (arcade.busy) return false;
		return picking || (!!south?.playable && view.legal.has(k));
	}
	function activate(c: Card) {
		const k = key(c);
		if (suppress || !actionable(k)) return;
		if (picking) {
			arcade.togglePick(k);
			sound.play('select', { jitter: 0.1, volume: 0.6 });
		} else playCard(c);
	}

	/** Play a card from your hand, asking first if the game has a question. */
	let asking = $state<{ k: string; list: { label: string; action: unknown }[] } | null>(null);
	function playCard(c: Card) {
		const list = arcade.ui?.choices?.(arcade.run!, c);
		if (list?.length) asking = { k: key(c), list };
		else arcade.game({ t: 'play', card: cards.code(c) });
	}
	function answer(action: unknown) {
		asking = null;
		arcade.game(action);
	}
	$effect(() => {
		// A question about a card that's no longer playable goes away.
		void arcade.v;
		if (asking && !actionable(asking.k)) asking = null;
	});
	let lastHover: string | null = null;
	$effect(() => {
		if (hover && hover !== lastHover) sound.play('card_hover', { jitter: 0.15, volume: 0.6 });
		lastHover = hover;
	});
	$effect(() => {
		// A hovered card that can no longer act (it was played, the turn passed) lets go.
		void arcade.v;
		if (hover && !actionable(hover)) hover = null;
	});

	function resort(by: 'suit' | 'rank') {
		arcade.sort(by);
		sound.play('card_play', { jitter: 0.1, volume: 0.5 });
	}

	const sprites = $derived.by(() => {
		const out: Sprite[] = [];
		let n0 = 0;
		for (const seat of view.seats) {
			const n = seat.cards.length;
			if (seat.pos === 'S') {
				// Your hand: fanned; the card under the pointer rises, grows and
				// straightens; picked cards stand up with a ploy-purple frame.
				const f = fan(n);
				const yourTurn = !pre && !arcade.busy && seat.playable && view.legal.size > 0;
				hand.forEach((c, i) => {
					const k = key(c);
					const legal = view.legal.has(k) && seat.playable;
					const dragging = drag?.k === k && drag.moved;
					const picked = arcade.picked.includes(k);
					const hovered = hover === k && !drag?.moved;
					const at = f.at(i);
					out.push({
						// Face down in your own hand only in Whist 22's forehead round.
						k, card: c, up: seat.faceUp, order: n0 + i, mine: true,
						s: HAND_S * (dragging ? 1.14 : hovered ? 1.1 : 1),
						z: dragging ? 200 : hovered ? 45 : 10 + i,
						x: dragging ? drag!.x : at.x,
						y: dragging ? drag!.y : at.y,
						r: dragging || hovered || picked ? 0 : at.r,
						lift: picked ? 30 : hovered ? 22 : yourTurn && legal ? 8 : 0,
						hovered,
						ring: picked ? 'var(--ploy)' : view.ringed?.has(k) ? 'var(--brass)' : dragging && legal && drag!.y < L.handY - 90 ? 'var(--good)' : undefined,
						dim: yourTurn && !legal
					});
				});
			} else if (seat.pos === 'N') {
				const s = seat.faceUp ? 0.9 : 0.55,
					gap = seat.faceUp ? 40 : 22;
				const x0 = CX - (gap * (n - 1)) / 2;
				seat.cards.forEach((c, i) => {
					const k = key(c);
					const legal = view.legal.has(k) && seat.playable;
					out.push({
						k, card: c, up: seat.faceUp, x: x0 + i * gap, y: L.northY + (seat.faceUp ? 14 : 0), s, z: 5 + i, order: n0 + i,
						dim: seat.playable && view.legal.size > 0 && !legal,
						click: legal && !arcade.busy ? () => arcade.game({ t: 'play', card: cards.code(c) }) : undefined
					});
				});
			} else {
				const x = seat.pos === 'W' ? L.westX : L.eastX;
				// A big hand (Tarot's eighteen) packs tighter to stay clear of the name.
				const step = n > 1 ? Math.min(16, 230 / (n - 1)) : 0;
				const y0 = CY - (step * (n - 1)) / 2;
				seat.cards.forEach((c, i) => out.push({ k: key(c), card: c, up: seat.faceUp, x, y: y0 + i * step, s: seat.faceUp ? 0.8 : 0.55, z: 5 + i, order: n0 + i }));
			}
			n0 += n;
		}
		// The trick; once finished, its winner's card is ringed, and then it
		// slides to their seat.
		const winner = view.trickDone ? view.lastTrick?.winner : undefined;
		const SEAT: Record<Pos, [number, number]> = { N: [CX, L.northY], S: [CX, L.handY - 40], W: [L.westX, CY], E: [L.eastX, CY] };
		view.trick.forEach((t, i) => {
			const [dx, dy] = TRICK[t.pos];
			const going = arcade.sweep && winner;
			out.push({
				k: key(t.card), card: t.card, up: !view.hidden?.has(key(t.card)), order: 0,
				x: going ? SEAT[winner][0] : CX + dx,
				y: going ? SEAT[winner][1] : CY + dy,
				r: going ? 0 : tilt(t.card),
				s: going ? 0.6 : 1.15,
				z: 50 + i,
				ring: winner === t.pos && !going ? 'var(--brass)' : undefined
			});
		});
		return out;
	});

	function move(e: PointerEvent) {
		if (!drag) return;
		const [x, y] = toStage(e);
		if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) < 8) return;
		drag = { ...drag, x, y, moved: true };
	}
	function up() {
		const d = drag;
		drag = null;
		if (!d?.moved) return;
		suppress = true;
		setTimeout(() => (suppress = false), 0);
		const seat = view.seats.find((s) => s.pos === 'S')!;
		const card = seat.cards.find((c) => key(c) === d.k)!;
		// Dropped on the table: play it, if you may.
		if (d.y < L.handY - 90 && view.legal.has(d.k) && seat.playable && !arcade.busy) return playCard(card);
		// Otherwise, put it where it was dropped.
		const rest = ordered(seat.cards).filter((c) => key(c) !== d.k);
		rest.splice(fan(seat.cards.length).index(d.x), 0, card);
		arcade.order = rest.map(key);
		sound.play('card_play', { jitter: 0.08, volume: 0.6 });
	}
	const LABEL = $derived(L.label);
</script>

<svelte:window onpointermove={move} onpointerup={up} />

<div class="table">
	{#each view.seats as seat (seat.pos)}
		<div class="label" class:active={seat.active} style:left="{LABEL[seat.pos][0]}px" style:top="{LABEL[seat.pos][1]}px">
			{#if seat.dealer}<span class="dealer" title="Dealer">D</span>{/if}{seat.name}{#if seat.active && seat.pos !== 'S' && arcade.busy}<span class="think"><i></i><i></i><i></i></span>{/if}{#if seat.tally}{#key seat.tally}<span class="tally">{seat.tally}</span>{/key}{/if}
		</div>
	{/each}
	{#if view.banner}<div class="banner" style:left="{L.bannerX ?? CX}px" style:top="{L.bannerY}px">{view.banner}</div>{/if}
	{#if view.trump}
		<div class="trump" style:left="{L.table.x + 20}px" style:top="{L.table.y + 16}px" class:red={cards.SUITS[view.trump].red} title="Trump: {cards.SUITS[view.trump].name}">
			<span class="tl">Trump</span><span class="tg">{cards.SUITS[view.trump].glyph + '\uFE0E'}</span>
		</div>
	{/if}
	{#each sprites as sp (deal + sp.k)}
		<CardSprite
			card={sp.card}
			x={sp.x}
			y={sp.y}
			s={sp.s}
			r={sp.r}
			hovered={sp.hovered}
			idle={sp.idle}
			z={sp.z}
			faceUp={sp.up}
			{back}
			lift={sp.lift}
			dim={sp.dim}
			highlight={sp.ring}
			trump={sp.up && (view.isTrump ? view.isTrump(sp.card) : view.trump === sp.card.suit)}
			edition={sp.up ? R.mod(run, sp.card).edition : undefined}
			seal={sp.up ? R.sealOf(run, sp.card) : undefined}
			spawn={{ x: L.deck.x, y: L.deck.y, faceUp: false, delay: sp.order * 0.035, sound: sp.order % 3 === 0 }}
			flipDelay={sp.mine ? 0.25 : 0}
			click={sp.click ? () => !suppress && sp.click!() : undefined}
			pointerdown={sp.down && !arcade.busy ? sp.down : undefined}
		/>
	{/each}
	<!-- Your hand's hit areas: a strip per card (the whole of the top one),
	     so overlapping, tilted cards are easy to point at. -->
	{#if south}
		{@const f = fan(hand.length)}
		{#each hand as c, i (key(c))}
			{@const k = key(c)}
			<button
				class="slot"
				class:act={actionable(k)}
				aria-label={cards.name(c)}
				style:left="{f.x0 - f.w / 2 + i * f.gap}px"
				style:top="{L.handY - f.h / 2 - 30}px"
				style:width="{i === hand.length - 1 ? f.w : f.gap}px"
				style:height="{f.h + 30}px"
				onpointerenter={(e) => {
					if (e.pointerType !== 'mouse') return;
					under = k;
					if (actionable(k)) hover = k;
				}}
				onpointerleave={(e) => {
					if (e.pointerType !== 'mouse') return;
					if (under === k) under = null;
					if (hover === k) hover = null;
				}}
				onpointerdown={(e) => {
					if (arcade.busy) return;
					const [x, y] = toStage(e);
					drag = { k, x, y, sx: x, sy: y, moved: false };
				}}
				onclick={() => activate(c)}
			></button>
		{/each}
	{/if}
	{#if asking}
		{@const i = hand.findIndex((c) => key(c) === asking!.k)}
		{#if i >= 0}
			{@const f = fan(hand.length)}
			<div class="ask" style:left="{f.at(i).x}px" style:top="{L.handY - f.h / 2 - 40}px">
				{#each asking.list as o}<button onclick={() => answer(o.action)}>{o.label}</button>{/each}
				<button class="no" onclick={() => (asking = null)}>Cancel</button>
			</div>
		{/if}
	{/if}
	{#if under}
		{@const i = hand.findIndex((c) => key(c) === under)}
		{@const c = hand[i]}
		{@const m = c ? R.mod(run, c) : {}}
		{@const ed = m.edition ? CARD_EDITIONS[m.edition as keyof typeof CARD_EDITIONS] : undefined}
		{@const seal = c ? R.sealOf(run, c) : undefined}
		{#if c && (ed || seal) && !drag?.moved}
			{@const f = fan(hand.length)}
			<div class="inspect" style:left="{f.at(i).x}px" style:top="{L.handY - f.h / 2 - 36}px">
				{#if ed}<div><b style:color={editionColor(ed.key)}>{ed.name}</b> {ed.text}</div>{/if}
				{#if seal}<div><b style:color={seal.color}>{seal.name}</b> {seal.text}</div>{/if}
			</div>
		{/if}
	{/if}
	<div class="peek" style:right="{L.W - L.peekAt[0]}px" style:top="{L.peekAt[1]}px">
		<Button variant="plain" size="sm" enabled={!!view.lastTrick} title="The last trick, card by card" onclick={() => (arcade.overlay = 'last')}>Last trick</Button>
	</div>
	<div class="sort" style:left="{L.sortAt[0]}px" style:top="{L.sortAt[1]}px">
		{#if hand.length > 1}
			<span>Sort</span>
			<Button variant={arcade.sortBy === 'suit' && !arcade.order.length ? 'brass' : 'plain'} size="sm" sound={false} title="Sort your hand by suit, each low to high" onclick={() => resort('suit')} style="width: 62px">Suit</Button>
			<Button variant={arcade.sortBy === 'rank' && !arcade.order.length ? 'brass' : 'plain'} size="sm" sound={false} title="Sort your hand by rank, low to high" onclick={() => resort('rank')} style="width: 62px">Rank</Button>
		{/if}
		<Button variant="plain" size="sm" title="The whole deck, with what's been played" onclick={() => (arcade.overlay = 'deck')} style="width: 62px; margin-left: 8px">Deck</Button>
	</div>
</div>

<style>
	.table {
		position: absolute;
		inset: 0;
	}
	.peek {
		position: absolute;
		right: 24px;
		top: 470px;
		display: flex;
		gap: 6px;
		z-index: 70;
	}
	/* A question before a card is played (the Fool: 0 or 22). */
	.ask {
		position: absolute;
		transform: translate(-50%, -100%);
		display: flex;
		gap: 6px;
		padding: 8px;
		background: var(--panel);
		border: 2px solid var(--brass);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.4);
		z-index: 130;
	}
	.ask button {
		font: inherit;
		font-size: 15px;
		padding: 5px 12px;
		border: none;
		background: var(--brass);
		color: var(--bg);
		cursor: pointer;
		white-space: nowrap;
	}
	.ask button.no {
		background: var(--panel-edge);
		color: var(--ink);
	}
	/* What an enhanced card does, over it while you point at it. */
	.inspect {
		position: absolute;
		transform: translate(-50%, -100%);
		max-width: 300px;
		width: max-content;
		padding: 6px 10px;
		background: var(--panel);
		border: 2px solid var(--panel-edge);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.4);
		font-size: 13px;
		color: var(--ink-dim);
		z-index: 120;
		pointer-events: none;
	}
	.inspect b {
		font-weight: 700;
	}
	@keyframes pop {
		0% {
			transform: scale(1.5);
			background: var(--brass);
			color: var(--bg);
		}
		100% {
			transform: scale(1);
		}
	}
	/* Someone else is thinking. */
	.think {
		display: inline-flex;
		gap: 3px;
		margin-left: 6px;
		vertical-align: middle;
	}
	.think i {
		width: 4px;
		height: 4px;
		background: var(--brass);
		animation: think 0.9s steps(2, jump-none) infinite;
	}
	.think i:nth-child(2) {
		animation-delay: 0.15s;
	}
	.think i:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes think {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 1;
		}
	}
	.slot {
		position: absolute;
		z-index: 90;
		padding: 0;
		border: none;
		background: none;
		touch-action: none;
		cursor: grab;
	}
	.slot.act {
		cursor: pointer;
	}
	.slot:focus-visible {
		outline: 2px solid var(--brass);
	}
	.sort {
		position: absolute;
		left: 300px;
		top: 512px;
		display: flex;
		gap: 6px;
		align-items: center;
		color: var(--ink-dim);
		font-size: 15px;
		z-index: 70;
	}

	.label {
		position: absolute;
		transform: translateX(-50%);
		font-size: 16px;
		color: var(--ink-dim);
		white-space: nowrap;
		z-index: 70;
	}
	.label.active {
		color: var(--brass);
	}
	.dealer {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		margin-right: 8px;
		border-radius: 50%;
		background: var(--brass);
		border: 3px solid #f3ead6;
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.4);
		color: #1b1d26;
		font-size: 15px;
		font-weight: 700;
		vertical-align: middle;
	}
	/* A tally that just changed pops. */
	.tally {
		display: inline-block;
		animation: pop 0.32s ease-out;
		margin-left: 8px;
		padding: 0 6px;
		background: var(--panel);
		color: var(--ink);
	}
	/* Any game with a trump suit shows it in the table's corner. */
	.trump {
		position: absolute;
		left: 290px;
		top: 16px;
		width: 84px;
		padding: 6px 0 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: #f3ead6;
		border: 3px solid var(--brass);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
		color: #1b1d26;
		z-index: 70;
	}
	.trump.red {
		color: #c8323c;
	}
	.tl {
		font-size: 13px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6b5a3a;
	}
	.tg {
		font-size: 44px;
		line-height: 1;
	}
	.banner {
		position: absolute;
		top: 468px;
		transform: translateX(-50%);
		font-size: 15px;
		color: var(--brass);
		letter-spacing: 0.06em;
		z-index: 60;
	}
</style>
