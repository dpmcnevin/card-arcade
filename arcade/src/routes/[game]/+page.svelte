<!-- One game on its own page. -->
<script lang="ts">
	import Stage from '$lib/components/Stage.svelte';
	import { byId } from '$lib/games/index.ts';

	let { data } = $props();
	const ui = $derived(byId(data.game)!);
</script>

<svelte:head>
	<title>{ui.module.title} — {ui.module.tagline}</title>
</svelte:head>

<Stage only={data.game} />
