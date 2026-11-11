<!-- Euchre: the turned-up card and the calls so far; order it up (round 1)
     or name another suit (round 2), alone if you dare, or pass. -->
<script lang="ts">
	import Button from '../components/Button.svelte';
	import * as cards from '$kit/src/core/rules/cards.ts';
	import { seatName } from '$kit/games/euchre/ai.ts';
	import type { EuchreHand } from '$kit/games/euchre/rules.ts';
	import { cardFace } from '../ui/images.ts';
	import type { PreProps } from './types.ts';

	let { run, act, v }: PreProps = $props();
	const h = $derived((void v, run.hand as EuchreHand));
	let alone = $state(false);
	const stuck = $derived(h.round === 2 && h.dealer === 3);
	const suits = $derived([4, 3, 2, 1].filter((s) => s !== h.upcard.suit));
</script>

<div class="panel">
	<div class="top">
		<img class="up" class:gone={h.round === 2} src={cardFace(h.upcard)} alt="" />
		<div>
			<div class="title">{h.round === 1 ? 'Order it up?' : stuck ? 'You’re stuck: name trump' : 'Name a suit?'}</div>
			<div class="dim">{seatName(h.dealer)} dealt{#each h.calls as c}<br />{seatName(c.seat)} {c.text}{/each}</div>
		</div>
	</div>
	<div class="row">
		{#if h.round === 1}
			<Button onclick={() => act({ t: 'call', suit: h.upcard.suit, alone })} style="width: 200px">Order up {cards.SUITS[h.upcard.suit].glyph}</Button>
		{:else}
			{#each suits as s}
				<Button onclick={() => act({ t: 'call', suit: s, alone })} style="width: 64px"><span class:red={cards.SUITS[s].red}>{cards.SUITS[s].glyph}</span></Button>
			{/each}
		{/if}
		<Button variant="plain" enabled={!stuck} onclick={() => act({ t: 'pass' })} style="width: 110px">Pass</Button>
	</div>
	<label><input type="checkbox" bind:checked={alone} /> Go alone (partner sits out)</label>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 22px;
		background: rgba(10, 18, 14, 0.94);
		border: 2px solid var(--brass-dim);
	}
	.top {
		display: flex;
		gap: 18px;
		align-items: center;
	}
	.up {
		width: 80px;
		height: 112px;
		image-rendering: pixelated;
	}
	.up.gone {
		filter: brightness(0.4);
	}
	.title {
		font-size: 26px;
		font-weight: 700;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 14px;
		line-height: 1.35;
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.red {
		color: var(--bad);
	}
	label {
		color: var(--ink-dim);
		font-size: 15px;
	}
</style>
