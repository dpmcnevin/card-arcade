<!-- The run's pack, by suit: every card with its edition and seal; once a
     hand is under way, the cards already played are greyed. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Overlay from './Overlay.svelte';
	import PackGrid from './PackGrid.svelte';
	import { keys } from '../games/view.ts';

	const run = arcade.run!;
	const view = arcade.ui!.view(run);
	const gone = keys(view.played ?? []);
	const mods = run.pack.filter((c) => R.mod(run, c).edition || R.mod(run, c).seal).length;
</script>

<Overlay title="The deck · {run.pack.length} cards" close={() => (arcade.overlay = null)} width={820}>
	<p class="dim">{mods ? `${mods} enhanced card${mods === 1 ? '' : 's'}. ` : ''}{gone.size ? `${gone.size} played this ${run.module.words.hand}.` : ''}</p>
	<PackGrid {run} {gone} />
</Overlay>

<style>
	.dim {
		color: var(--ink-dim);
		margin: 0 0 8px;
	}
</style>
