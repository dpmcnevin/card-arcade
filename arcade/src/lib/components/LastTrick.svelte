<!-- The last finished trick, as it lay, and who took it. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import { cardFace } from '../ui/images.ts';
	import Overlay from './Overlay.svelte';
	import type { Pos } from '../games/types.ts';

	const view = arcade.ui!.view(arcade.run!);
	const t = view.lastTrick;
	const seat = (p: Pos) => view.seats.find((s) => s.pos === p)?.name ?? p;
	const AT: Record<Pos, [number, number]> = { N: [130, 0], W: [10, 70], E: [250, 70], S: [130, 140] };
</script>

<Overlay title="Last trick" close={() => (arcade.overlay = null)} width={420}>
	{#if t}
		<div class="trick">
			{#each t.plays as p}
				<div class="card" class:won={p.pos === t.winner} style:left="{AT[p.pos][0]}px" style:top="{AT[p.pos][1]}px">
					<img src={cardFace(p.card, view.isTrump ? view.isTrump(p.card) : view.trump === p.card.suit, 2)} alt="" />
					<span>{seat(p.pos)}</span>
				</div>
			{/each}
		</div>
		<p>{seat(t.winner)} took it.</p>
	{:else}
		<p>No trick has been played yet.</p>
	{/if}
</Overlay>

<style>
	.trick {
		position: relative;
		height: 270px;
		width: 340px;
		margin: 0 auto;
	}
	.card {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 13px;
		color: var(--ink-dim);
	}
	.card img {
		width: 80px;
		height: 112px;
		image-rendering: pixelated;
	}
	.card.won img {
		outline: 3px solid var(--brass);
	}
	.card.won span {
		color: var(--brass);
	}
	p {
		text-align: center;
		color: var(--ink-dim);
	}
</style>
