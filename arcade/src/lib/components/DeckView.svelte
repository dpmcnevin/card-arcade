<!-- The run's pack, by suit: every card with its edition and seal; once a
     hand is under way, the cards already played are greyed. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import { cardFace } from '../ui/images.ts';
	import { editionColor } from './editions.ts';
	import SealBadge from './SealBadge.svelte';
	import Overlay from './Overlay.svelte';

	const run = arcade.run!;
	const view = arcade.ui!.view(run);
	// Each game's own order within a suit (Tarot's knight sits under the queen).
	const rk = (c: { rank: number }) => arcade.ui?.rankOrder?.(c as never) ?? c.rank;
	const gone = new Set((view.played ?? []).map((c) => `${c.suit}-${c.rank}`));
	const rows = [5, 4, 3, 2, 1].map((s) => run.pack.filter((c) => c.suit === s).sort((a, b) => rk(b) - rk(a))).filter((r) => r.length);
	const mods = run.pack.filter((c) => R.mod(run, c).edition || R.mod(run, c).seal).length;
</script>

<Overlay title="The deck · {run.pack.length} cards" close={() => (arcade.overlay = null)} width={820}>
	<p class="dim">{mods ? `${mods} enhanced card${mods === 1 ? '' : 's'}. ` : ''}{gone.size ? `${gone.size} played this ${run.module.words.hand}.` : ''}</p>
	{#each rows as row}
		<div class="row">
			{#each row as c (c.id)}
				{@const m = R.mod(run, c)}
				{@const seal = R.sealOf(run, c)}
				<div class="card" class:gone={gone.has(`${c.suit}-${c.rank}`)}>
					<img src={cardFace(c)} alt="" style:outline={m.edition ? `3px solid ${editionColor(m.edition)}` : ''} />
					{#if seal}<span class="badge"><SealBadge {seal} size={16} /></span>{/if}
				</div>
			{/each}
		</div>
	{/each}
</Overlay>

<style>
	.dim {
		color: var(--ink-dim);
		margin: 0 0 8px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.card {
		position: relative;
	}
	.card img {
		width: 51px;
		height: 71px;
		image-rendering: auto;
		display: block;
	}
	.card.gone {
		opacity: 0.3;
	}
	.badge {
		position: absolute;
		right: -4px;
		top: -4px;
	}
</style>
