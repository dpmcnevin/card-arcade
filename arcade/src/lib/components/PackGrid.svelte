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
	import Shine from './Shine.svelte';
	import * as cards from '$kit/src/core/rules/cards.ts';

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
	/** The card being looked at (click a card to see what it is). */
	let looking = $state<Card | null>(null);
	const rows = $derived([cards.TRUMPS, ...cards.SUIT_ORDER].map((s) => run.pack.filter((c) => c.suit === s).sort((a, b) => rk(b) - rk(a))).filter((r) => r.length));
</script>

{#each rows as row}
	<div class="row">
		{#each row as c (c.id)}
			{@const m = R.mod(run, c)}
			{@const seal = R.sealOf(run, c)}
			{@const ok: [boolean, string?] = usable ? usable(c) : [true]}
			{#snippet face()}
				<Shine edition={m.edition}><img src={cardFace(c)} alt={cards.name(c)} /></Shine>
				{#if m.edition}<span class="ed" style:background={editionColor(m.edition)}></span>{/if}
				{#if seal}<span class="badge"><SealBadge {seal} size={16} /></span>{/if}
			{/snippet}
			{#if pick}
				<button class="card pickable" class:no={!ok[0]} disabled={!ok[0]} onclick={() => pick!(c)} title={!ok[0] ? ok[1] : m.edition ? CARD_EDITIONS[m.edition].text : ''}>
					{@render face()}
				</button>
			{:else}
				<button class="card" class:no={gone?.has(cardKey(c))} class:sel={looking?.id === c.id} onclick={() => (looking = looking?.id === c.id ? null : c)} title={cards.name(c)}>
					{@render face()}
				</button>
			{/if}
		{/each}
	</div>
{/each}
{#if looking && !pick}
	{@const m = R.mod(run, looking)}
	{@const ed = m.edition ? CARD_EDITIONS[m.edition] : undefined}
	{@const seal = R.sealOf(run, looking)}
	<div class="look">
		<Shine edition={m.edition}><img src={cardFace(looking)} alt="" /></Shine>
		<div>
			<h3>{cards.name(looking)[0].toUpperCase() + cards.name(looking).slice(1)}</h3>
			{#if gone?.has(cardKey(looking))}<div class="dim">Played this hand</div>{/if}
			{#if ed}<p><b style:color={editionColor(ed.key)}>{ed.name}</b>: {ed.text}</p>{/if}
			{#if seal}<p><b style:color={seal.color}>{seal.name}</b>: {seal.text}</p>{/if}
			{#if !ed && !seal}<p class="dim">A plain card: no edition, no seal.</p>{/if}
		</div>
	</div>
{/if}

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
	.card {
		cursor: pointer;
	}
	.card.sel {
		outline: 2px solid var(--brass);
		outline-offset: 2px;
	}
	/* An edition: its shine, and a tag in its color. */
	.ed {
		position: absolute;
		left: 3px;
		bottom: -4px;
		width: 18px;
		height: 6px;
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
	}
	.look {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		margin-top: 8px;
		padding: 10px 12px;
		background: rgba(0, 0, 0, 0.25);
		border: 2px solid var(--panel-edge);
	}
	.look img {
		width: 80px;
		height: 112px;
		image-rendering: auto;
		display: block;
	}
	.look h3 {
		margin: 0 0 4px;
		font-size: 20px;
		color: var(--ink);
	}
	.look p {
		margin: 4px 0;
		font-size: 14px;
		color: var(--ink-dim);
	}
	.dim {
		color: var(--ink-faint);
		font-size: 13px;
	}
	.pickable:hover:not(:disabled) {
		transform: translateY(-4px);
	}
	.card.no {
		opacity: 0.3;
	}
	.pickable.no {
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
