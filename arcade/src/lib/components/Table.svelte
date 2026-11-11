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
	import type { Pos } from '../games/types.ts';
	import CardSprite from './CardSprite.svelte';

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
	const deal = $derived((void arcade.v, `${run.table}.${run.board}.${run.stats.hands - (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY ? 0 : 1)}`));

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
		mine?: boolean;
		/** A colored ring: the trick's winner, a card just passed to you. */
		ring?: string;
	}

	const TRICK: Record<Pos, [number, number]> = { N: [0, -96], S: [0, 96], W: [-130, 0], E: [130, 0] };

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

	/** Your hand in your order (sorted, or as you dragged it). */
	function ordered(hand: Card[]): Card[] {
		const o = arcade.order;
		if (o.length && hand.every((c) => o.includes(key(c)))) return hand.slice().sort((a, b) => o.indexOf(key(a)) - o.indexOf(key(b)));
		const bySuit = (a: Card, b: Card) => b.suit - a.suit || b.rank - a.rank;
		const byRank = (a: Card, b: Card) => b.rank - a.rank || b.suit - a.suit;
		return hand.slice().sort(arcade.sortBy === 'rank' ? byRank : bySuit);
	}

	const sprites = $derived.by(() => {
		const out: Sprite[] = [];
		let n0 = 0;
		for (const seat of view.seats) {
			const n = seat.cards.length;
			if (seat.pos === 'S') {
				const s = 1.3,
					w = CW * s;
				const hand = ordered(seat.cards);
				const gap = n > 1 ? Math.min(58, (L.handW - w) / (n - 1)) : 0;
				const x0 = CX - (w + gap * (n - 1)) / 2 + w / 2;
				hand.forEach((c, i) => {
					const k = key(c);
					const picking = pre && !!arcade.ui!.pick;
					const legal = view.legal.has(k) && seat.playable;
					const dragging = drag?.k === k && drag.moved;
					out.push({
						k, card: c, up: true, s, z: dragging ? 200 : 10 + i, order: n0 + i, mine: true,
						x: dragging ? drag!.x : x0 + i * gap,
						y: dragging ? drag!.y : L.handY,
						lift: arcade.picked.includes(k) ? 26 : 0,
						ring: view.ringed?.has(k) ? 'var(--good)' : undefined,
						dim: !pre && !arcade.busy && view.legal.size > 0 && seat.playable && !legal,
						click: picking ? () => arcade.togglePick(k) : legal && !arcade.busy ? () => arcade.game({ t: 'play', card: cards.code(c) }) : undefined,
						down: (e) => {
							const [x, y] = toStage(e);
							drag = { k, x, y, sx: x, sy: y, moved: false };
						}
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
				const y0 = CY - (16 * (n - 1)) / 2;
				seat.cards.forEach((c, i) => out.push({ k: key(c), card: c, up: false, x, y: y0 + i * 16, s: 0.55, z: 5 + i, order: n0 + i }));
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
		const hand = view.seats.find((s) => s.pos === 'S')!;
		const card = hand.cards.find((c) => key(c) === d.k)!;
		// Dropped on the table: play it, if you may.
		if (d.y < L.handY - 90 && view.legal.has(d.k) && hand.playable && !arcade.busy) return arcade.game({ t: 'play', card: cards.code(card) });
		// Otherwise, put it where it was dropped.
		const rest = ordered(hand.cards).filter((c) => key(c) !== d.k);
		const n = hand.cards.length,
			w = CW * 1.3;
		const gap = n > 1 ? Math.min(58, (L.handW - w) / (n - 1)) : 0;
		const x0 = CX - (w + gap * (n - 1)) / 2 + w / 2;
		const at = Math.max(0, Math.min(rest.length, Math.round((d.x - x0) / Math.max(1, gap))));
		rest.splice(at, 0, card);
		arcade.order = rest.map(key);
	}
	const LABEL = $derived(L.label);
</script>

<svelte:window onpointermove={move} onpointerup={up} />

<div class="table">
	{#each view.seats as seat (seat.pos)}
		<div class="label" class:active={seat.active} style:left="{LABEL[seat.pos][0]}px" style:top="{LABEL[seat.pos][1]}px">
			{#if seat.dealer}<span class="dealer" title="Dealer">D</span>{/if}{seat.name}{#if seat.tally}<span class="tally">{seat.tally}</span>{/if}
		</div>
	{/each}
	{#if view.banner}<div class="banner" style:left="{CX}px" style:top="{L.bannerY}px">{view.banner}</div>{/if}
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
	<div class="peek" style:right="{L.W - L.peekAt[0]}px" style:top="{L.peekAt[1]}px">
		<button disabled={!view.lastTrick} onclick={() => (arcade.overlay = 'last')}>Last trick</button>
		<button onclick={() => (arcade.overlay = 'deck')}>Deck</button>
	</div>
	{#if (view.seats.find((x) => x.pos === 'S')?.cards.length ?? 0) > 1}
		<div class="sort" style:left="{L.sortAt[0]}px" style:top="{L.sortAt[1]}px">
			<span>Sort</span>
			<button class:on={arcade.sortBy === 'suit' && !arcade.order.length} onclick={() => arcade.sort('suit')}>Suit</button>
			<button class:on={arcade.sortBy === 'rank' && !arcade.order.length} onclick={() => arcade.sort('rank')}>Rank</button>
		</div>
	{/if}
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
	.peek button {
		font: inherit;
		font-size: 14px;
		padding: 4px 12px;
		border: none;
		background: var(--panel-edge);
		color: var(--ink);
		cursor: pointer;
	}
	.peek button:disabled {
		color: var(--ink-faint);
		cursor: default;
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
	.sort button {
		font: inherit;
		font-size: 14px;
		padding: 3px 12px;
		border: none;
		background: var(--panel-edge);
		color: var(--ink);
		cursor: pointer;
	}
	.sort button.on {
		background: var(--brass);
		color: var(--bg);
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
	.tally {
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
