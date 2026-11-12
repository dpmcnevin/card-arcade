<!-- The run's pack, a row per suit (trumps first), each card with its
     edition and seal, in the game's own order. Rows wrap, so any pack fits
     (Tarot's 78, a 22-card row of trumps). Cards can be greyed (played), or
     offered for picking (a card edition or seal from the club). -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import type { Run } from '$kit/src/run/run.ts';
	import type { Card } from '$kit/src/core/rules/cards.ts';
	import { CARD_EDITIONS } from '$kit/src/run/content.ts';
	import { cardFace } from '../ui/images.ts';
	import { editionColor } from './editions.ts';
	import { cardKey } from '../games/view.ts';
	import SealBadge from './SealBadge.svelte';

	let {
		run,
		gone,
		pick,
		usable
	}: {
		run: Run;
		/** Card keys to grey out (played this hand). */
		gone?: Set<string>;
		/** Make the cards buttons that pick this card. */
		pick?: (c: Card) => void;
		/** Which cards may be picked, and why not. */
		usable?: (c: Card) => [boolean, string?];
	} = $props();
	const rk = (c: Card) => arcade.ui?.rankOrder?.(c) ?? c.rank;
	const rows = $derived([5, 4, 3, 2, 1].map((s) => run.pack.filter((c) => c.suit === s).sort((a, b) => rk(b) - rk(a))).filter((r) => r.length));
</script>

{#each rows as row}
	<div class="row">
		{#each row as c (c.id)}
			{@const m = R.mod(run, c)}
			{@const seal = R.sealOf(run, c)}
			{@const ok: [boolean, string?] = usable ? usable(c) : [true]}
			{#if pick}
				<button class="card pickable" class:no={!ok[0]} disabled={!ok[0]} onclick={() => pick!(c)} title={!ok[0] ? ok[1] : m.edition ? CARD_EDITIONS[m.edition].text : ''}>
					<img src={cardFace(c)} alt="" style:outline={m.edition ? `3px solid ${editionColor(m.edition)}` : ''} />
					{#if seal}<span class="badge"><SealBadge {seal} size={16} /></span>{/if}
				</button>
			{:else}
				<div class="card" class:no={gone?.has(cardKey(c))}>
					<img src={cardFace(c)} alt="" style:outline={m.edition ? `3px solid ${editionColor(m.edition)}` : ''} />
					{#if seal}<span class="badge"><SealBadge {seal} size={16} /></span>{/if}
				</div>
			{/if}
		{/each}
	</div>
{/each}

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.card {
		position: relative;
		padding: 0;
		border: none;
		background: none;
	}
	.pickable {
		cursor: pointer;
	}
	.pickable:hover:not(:disabled) {
		transform: translateY(-4px);
	}
	.card.no {
		opacity: 0.3;
		cursor: default;
	}
	.card img {
		width: 51px;
		height: 71px;
		image-rendering: auto;
		display: block;
	}
	.badge {
		position: absolute;
		right: -4px;
		top: -4px;
	}
</style>
