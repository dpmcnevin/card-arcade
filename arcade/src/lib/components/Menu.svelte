<!-- The front door: every game (the arcade), or one game on its own page. -->
<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	let { only }: { only?: string } = $props();
	import { arcade } from '../app.svelte.ts';
	import { GAMES as ALL } from '../games/index.ts';
	import { cardBack, cardFace } from '../ui/images.ts';
	import Shine from './Shine.svelte';
	import * as sound from '../audio/sound.ts';
	import * as cards from '$kit/src/core/rules/cards.ts';
	// The fan's cards can be picked up and dropped anywhere; a tap flips one.
	/** Cards in the fan, three a side. */
	const N = 6;
	let moved = $state(Array.from({ length: N }, () => ({ x: 0, y: 0 })));
	let up = $state(Array.from({ length: N }, () => true));
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
		moved = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
		up = Array.from({ length: N }, () => true);
	}
	// Four random cards around the title, some with an edition's shine.
	const FAN = (() => {
		// A game's own page fans its own pack (Tarot trumps, Euchre's nine to ace).
		const game = only ? ALL.find((g) => g.module.id === only) : null;
		const pack = game?.module.newPack ? game.module.newPack() : cards.newDeck();
		const deck = pack.sort(() => Math.random() - 0.5).slice(0, N);
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

<svelte:window
	onpointermove={move}
	onpointerup={drop}
	onkeydown={(e) => {
		// Escape: close the collection, else from a game's page back to all games.
		if (e.key !== 'Escape' || arcade.screen !== 'menu') return;
		if (showing) showing = null;
		else if (solo) goto(`${base}/`);
	}}
/>

<div class="menu">
	<div class="titlerow">
		<div class="fan left">{#each FAN.slice(0, 3) as f, i}{@const k = i + 0}<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="fc" class:held={drag?.k === k} style:transform="translate({moved[k].x}px, {moved[k].y}px) rotate({drag?.k === k ? 0 : -22 + i * 9}deg)" onpointerdown={(e) => grab(e, k)}>
				<span class="wob" style:animation-delay="{-k * 1.3}s">{#if up[k]}<Shine edition={f.edition}><img src={cardFace(f.card)} alt="" draggable="false" /></Shine>{:else}<img src={cardBack('standard')} alt="" draggable="false" />{/if}</span>
			</span>{/each}</div>
		<h1>{solo ? solo.module.title.toUpperCase() : 'CARD ARCADE'}</h1>
		<div class="fan right">{#each FAN.slice(3) as f, i}{@const k = i + 3}<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="fc" class:held={drag?.k === k} style:transform="translate({moved[k].x}px, {moved[k].y}px) rotate({drag?.k === k ? 0 : 4 + i * 9}deg)" onpointerdown={(e) => grab(e, k)}>
				<span class="wob" style:animation-delay="{-k * 1.3}s">{#if up[k]}<Shine edition={f.edition}><img src={cardFace(f.card)} alt="" draggable="false" /></Shine>{:else}<img src={cardBack('standard')} alt="" draggable="false" />{/if}</span>
			</span>{/each}</div>
	</div>
	{#if solo}
		<div class="back"><Button variant="plain" size="sm" onclick={() => goto(`${base}/`)} style="width: 140px">← All games</Button></div>
		<div class="dim">{solo.module.tagline}</div>
	{:else}
		<div class="dim">one engine, a game per page</div>
	{/if}
	{#if !solo}
		<!-- The front door: a tile per game. Each opens the game's own page,
		     which has the deck, the runs and the collection. -->
		<div class="tiles">
			{#each GAMES as g (g.module.id)}
				<a class="tile" href="{base}/{g.module.id}/" title={g.blurb}>
					<img src={cardBack(deckOf(g.module.id, g.module).back === 'standard' ? g.back : deckOf(g.module.id, g.module).back)} alt="" />
					<h2>{g.module.title}</h2>
					<div class="tag">{g.module.tagline}</div>
					{#if arcade.saved(g.module.id)}<div class="saved">Run in progress</div>{/if}
				</a>
			{/each}
		</div>
	{:else}
	<div class="games">
		{#each GAMES as g (g.module.id)}
			{@const deck = deckOf(g.module.id, g.module)}
			<div class="game">
				<img src={cardBack(deck.back === 'standard' ? g.back : deck.back)} alt="" />
				<!-- The page's heading already names the game. -->
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
	{/if}
	<div class="settings">
		<Button variant="plain" size="sm" onclick={() => settings.toggle('fourColor')} style="width: 120px">{settings.fourColor ? '4 colors' : '2 colors'}</Button>
		<Button variant="plain" size="sm" onclick={() => settings.toggle('pixel')} style="width: 120px">{settings.pixel ? 'Pixel' : 'Smooth'}</Button>
		<Button variant="plain" size="sm" onclick={() => settings.toggle('stepped')} style="width: 150px" title="How the shine on enhanced cards moves: smooth, or in pixel steps (much lighter on the CPU)">{settings.stepped ? 'Shine: stepped' : 'Shine: smooth'}</Button>
	</div>
	{#if scattered}<div class="tidy"><Button variant="plain" size="sm" onclick={tidy}>Tidy the cards</Button></div>{/if}
	{#if showing}<Collection ui={showing} close={() => (showing = null)} />{/if}
</div>

<style>
	.titlerow {
		display: flex;
		align-items: center;
		gap: 44px;
	}
	.fan {
		display: flex;
	}
	/* The card turns as a whole, so the shine's clipping can't cut it off. */
	.fc {
		position: relative;
		display: inline-flex;
		margin: 0 -22px;
		cursor: grab;
		touch-action: none;
		transition: transform 0.12s;
	}
	/* The shadow is on the card itself, not around the swaying layer, so the
	   sway only moves a layer instead of redrawing a filter every frame. */
	.fc img {
		width: 80px;
		height: 112px;
		display: block;
		image-rendering: auto;
		filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35));
	}
	/* An idle sway, each card out of step; a bigger wiggle under the pointer. */
	.wob {
		display: inline-flex;
		animation: sway 4.2s ease-in-out infinite;
		will-change: transform;
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
	.back {
		position: absolute;
		left: 24px;
		top: 20px;
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
		/* Centred top to bottom, but never cut off if it runs taller. */
		justify-content: safe center;
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
	.games {
		margin-top: 22px;
		display: flex;
		justify-content: center;
	}
	.tiles {
		margin-top: 34px;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 22px;
		max-width: 1220px;
	}
	.tile {
		width: 210px;
		box-sizing: border-box;
		padding: 18px 12px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		background: rgba(12, 22, 18, 0.9);
		border: 2px solid var(--brass-dim);
		color: inherit;
		text-decoration: none;
		transition: transform 0.12s, border-color 0.12s;
	}
	.tile:hover {
		transform: translateY(-6px);
		border-color: var(--brass);
	}
	.tile img {
		width: 80px;
		height: 112px;
		image-rendering: auto;
		filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35));
	}
	.tile h2 {
		font-size: 23px;
	}
	.saved {
		margin-top: 2px;
		padding: 2px 8px;
		font-size: 12px;
		background: var(--brass);
		color: var(--bg);
	}
	.game {
		width: 320px;
		box-sizing: border-box;
		padding: 14px 18px;
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
	h2 {
		margin: 0;
		color: var(--brass);
		font-size: 30px;
		white-space: nowrap;
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
