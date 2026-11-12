<!-- The front door: every game (the arcade), or one game on its own page. -->
<script lang="ts">
	import { base } from '$app/paths';
	let { only }: { only?: string } = $props();
	import { arcade } from '../app.svelte.ts';
	import { GAMES as ALL } from '../games/index.ts';
	import { cardBack, cardFace } from '../ui/images.ts';
	import Shine from './Shine.svelte';
	import * as sound from '../audio/sound.ts';
	import * as cards from '$kit/src/core/rules/cards.ts';
	// The fan's cards can be picked up and dropped anywhere; a tap flips one.
	let moved = $state([0, 1, 2, 3].map(() => ({ x: 0, y: 0 })));
	let up = $state([true, true, true, true]);
	let drag = $state<{ k: number; sx: number; sy: number; ox: number; oy: number; went: boolean } | null>(null);
	const scale = () => {
		const r = document.querySelector('.stage')?.getBoundingClientRect();
		return r ? r.width / (document.querySelector('.stage') as HTMLElement).offsetWidth : 1;
	};
	function grab(e: PointerEvent, k: number) {
		e.preventDefault();
		drag = { k, sx: e.clientX, sy: e.clientY, ox: moved[k].x, oy: moved[k].y, went: false };
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const k = scale();
		const dx = (e.clientX - drag.sx) / k,
			dy = (e.clientY - drag.sy) / k;
		if (!drag.went && Math.hypot(dx, dy) < 5) return;
		drag.went = true;
		moved[drag.k] = { x: drag.ox + dx, y: drag.oy + dy };
	}
	function drop() {
		if (!drag) return;
		if (!drag.went) {
			up[drag.k] = !up[drag.k];
			sound.play('flip', { jitter: 0.08 });
		} else sound.play('card_play', { jitter: 0.08, volume: 0.7 });
		drag = null;
	}
	const scattered = $derived(moved.some((m) => m.x || m.y) || up.some((u) => !u));
	function tidy() {
		moved = [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));
		up = [true, true, true, true];
	}
	// Four random cards around the title, some with an edition's shine.
	const FAN = (() => {
		const deck = cards.newDeck().sort(() => Math.random() - 0.5).slice(0, 4);
		return deck.map((card) => ({ card, edition: Math.random() < 0.35 ? (['etched', 'lacquered', 'prismatic'] as const)[Math.floor(Math.random() * 3)] : undefined }));
	})();
	import Button from './Button.svelte';
	import * as R from '$kit/src/run/run.ts';
	import Collection from './Collection.svelte';
	import { settings } from '../settings.svelte.ts';
	import type { GameUI } from '../games/types.ts';
	let showing = $state<GameUI | null>(null);
	const GAMES = $derived(only ? ALL.filter((g) => g.module.id === only) : ALL);
	const solo = $derived(only ? GAMES[0] : null);
	const deckOf = (id: string, m: R.GameModule) => R.allDecks(m).find((d) => d.key === (arcade.decks[id] ?? 'standard')) ?? R.allDecks(m)[0];
	function cycle(id: string, m: R.GameModule, step: number) {
		const all = R.allDecks(m);
		const i = all.findIndex((d) => d.key === deckOf(id, m).key);
		arcade.setDeck(id, all[(i + step + all.length) % all.length].key);
	}
</script>

<svelte:window onpointermove={move} onpointerup={drop} />

<div class="menu">
	<div class="titlerow">
		<div class="fan left">{#each FAN.slice(0, 2) as f, i}{@const k = i + 0}<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="fc" class:held={drag?.k === k} style:transform="translate({moved[k].x}px, {moved[k].y}px) rotate({drag?.k === k ? 0 : -14 + i * 10}deg)" onpointerdown={(e) => grab(e, k)}>
				<span class="wob" style:animation-delay="{-k * 1.3}s">{#if up[k]}<Shine edition={f.edition}><img src={cardFace(f.card)} alt="" draggable="false" /></Shine>{:else}<img src={cardBack('standard')} alt="" draggable="false" />{/if}</span>
			</span>{/each}</div>
		<h1>{solo ? solo.module.title.toUpperCase() : 'CARD ARCADE'}</h1>
		<div class="fan right">{#each FAN.slice(2) as f, i}{@const k = i + 2}<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="fc" class:held={drag?.k === k} style:transform="translate({moved[k].x}px, {moved[k].y}px) rotate({drag?.k === k ? 0 : 4 + i * 10}deg)" onpointerdown={(e) => grab(e, k)}>
				<span class="wob" style:animation-delay="{-k * 1.3}s">{#if up[k]}<Shine edition={f.edition}><img src={cardFace(f.card)} alt="" draggable="false" /></Shine>{:else}<img src={cardBack('standard')} alt="" draggable="false" />{/if}</span>
			</span>{/each}</div>
	</div>
	{#if solo}
		<div class="dim">{solo.module.tagline} · <a href="{base}/">more games</a></div>
	{:else}
		<div class="dim">one engine, a game per page</div>
	{/if}
	<div class="games">
		{#each GAMES as g (g.module.id)}
			{@const deck = deckOf(g.module.id, g.module)}
			<div class="game">
				<img src={cardBack(deck.key === 'standard' ? g.back : deck.back)} alt="" />
				<h2>{#if solo}{g.module.title}{:else}<a class="title" href="{base}/{g.module.id}/">{g.module.title}</a>{/if}</h2>
				<div class="tag">{g.module.tagline}</div>
				<p>{g.blurb}</p>
				<div class="deck">
					<button class="arrow" title="Previous deck" onclick={() => cycle(g.module.id, g.module, -1)}><span class="tri left"></span></button>
					<div class="dn"><b>{deck.name}</b><span>{deck.text}</span></div>
					<button class="arrow" title="Next deck" onclick={() => cycle(g.module.id, g.module, 1)}><span class="tri right"></span></button>
				</div>
				{#if arcade.saved(g.module.id)}
					<Button onclick={() => arcade.start(g.module.id, true)} style="width: 100%">Continue</Button>
				{/if}
				<Button variant={arcade.saved(g.module.id) ? 'plain' : 'brass'} onclick={() => arcade.start(g.module.id)} style="width: 100%">New run</Button>
				<Button variant="plain" size="sm" onclick={() => (showing = g)} style="width: 100%">Collection & stats</Button>
			</div>
		{/each}
	</div>
	<div class="settings">
		<Button variant="plain" size="sm" onclick={() => settings.toggle('fourColor')} style="width: 120px">{settings.fourColor ? '4 colors' : '2 colors'}</Button>
		<Button variant="plain" size="sm" onclick={() => settings.toggle('pixel')} style="width: 120px">{settings.pixel ? 'Pixel' : 'Smooth'}</Button>
	</div>
	{#if scattered}<div class="tidy"><Button variant="plain" size="sm" onclick={tidy}>Tidy the cards</Button></div>{/if}
	{#if showing}<Collection ui={showing} close={() => (showing = null)} />{/if}
</div>

<style>
	.titlerow {
		display: flex;
		align-items: center;
		gap: 28px;
	}
	.fan {
		display: flex;
	}
	/* The card turns as a whole, so the shine's clipping can't cut it off. */
	.fc {
		position: relative;
		display: inline-flex;
		margin: 0 -8px;
		cursor: grab;
		touch-action: none;
		transition: transform 0.12s;
		filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35));
	}
	.fc img {
		width: 56px;
		height: 78px;
		display: block;
		image-rendering: auto;
	}
	/* An idle sway, each card out of step; a bigger wiggle under the pointer. */
	.wob {
		display: inline-flex;
		animation: sway 4.2s ease-in-out infinite;
	}
	.fc:hover .wob {
		animation: wiggle 0.5s ease-in-out;
	}
	.fc.held .wob {
		animation: none;
	}
	@keyframes sway {
		0%, 100% { transform: translateY(0) rotate(-2.5deg); }
		50% { transform: translateY(-5px) rotate(2.5deg); }
	}
	@keyframes wiggle {
		0%, 100% { transform: rotate(0) scale(1.06); }
		25% { transform: rotate(-6deg) scale(1.08); }
		50% { transform: rotate(5deg) scale(1.08); }
		75% { transform: rotate(-3deg) scale(1.07); }
	}
	@media (prefers-reduced-motion: reduce) {
		.wob, .fc:hover .wob { animation: none; }
	}
	.fc.held {
		cursor: grabbing;
		z-index: 50;
		transition: none;
	}
	.tidy {
		position: absolute;
		right: 24px;
		bottom: 18px;
	}
	.settings {
		display: flex;
		gap: 6px;
		position: absolute;
		right: 24px;
		top: 20px;
	}
	.menu {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 28px 0 20px;
		gap: 6px;
		/* Fits the stage; scrolls if a game's card ever runs taller. */
		overflow-y: auto;
	}
	h1 {
		margin: 0;
		font-size: 60px;
		color: var(--brass);
		text-shadow: 5px 5px 0 rgba(0, 0, 0, 0.6);
	}
	.dim {
		color: var(--ink-dim);
	}
	/* Every game in one row: four fit at 1280 wide. */
	.games {
		margin-top: 22px;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 18px;
		max-width: 1240px;
	}
	.game {
		width: 270px;
		box-sizing: border-box;
		padding: 14px 16px;
		background: rgba(12, 22, 18, 0.9);
		border: 2px solid var(--brass-dim);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
	}
	.game img {
		width: 60px;
		height: 84px;
		image-rendering: auto;
	}
	a {
		color: var(--ink-dim);
	}
	a.title {
		color: inherit;
		text-decoration: none;
	}
	a.title:hover {
		text-decoration: underline;
	}
	h2 {
		margin: 0;
		color: var(--brass);
		font-size: 30px;
	}
	.tag {
		color: var(--ink-dim);
	}
	p {
		margin: 0;
		text-align: center;
		font-size: 15px;
		min-height: 54px;
	}
	.deck {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.dn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		min-height: 44px;
	}
	.dn b {
		color: var(--brass);
	}
	.dn span {
		font-size: 12px;
		color: var(--ink-dim);
	}
	.arrow {
		width: 32px;
		height: 30px;
		border: none;
		background: var(--panel-edge);
		color: var(--ink);
		cursor: pointer;
	}
	/* Drawn arrows: the characters turn into emoji on Apple devices. */
	.tri {
		display: inline-block;
		width: 9px;
		height: 13px;
		background: currentColor;
	}
	.tri.left {
		clip-path: polygon(100% 0, 0 50%, 100% 100%);
	}
	.tri.right {
		clip-path: polygon(0 0, 100% 50%, 0 100%);
	}
</style>
