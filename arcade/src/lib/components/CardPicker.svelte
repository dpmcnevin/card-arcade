<!-- Choose a card from the run's pack (for a card edition or a seal): the
     pack by suit, each card with its edition and seal. -->
<script lang="ts">
	import type { Run } from '$kit/src/run/run.ts';
	import type { Card } from '$kit/src/core/rules/cards.ts';
	import Button from './Button.svelte';
	import PackGrid from './PackGrid.svelte';

	let {
		run,
		title,
		text,
		choose,
		cancel,
		usable
	}: { run: Run; title: string; text: string; choose: (c: Card) => void; cancel: () => void; usable?: (c: Card) => [boolean, string?] } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="veil" onclick={cancel}>
	<div class="panel" onclick={(e) => e.stopPropagation()}>
		<h2>Choose a card: {title}</h2>
		<p>{text}</p>
		<div class="grid"><PackGrid {run} pick={choose} {usable} /></div>
		<div class="foot"><Button variant="plain" onclick={cancel} style="width: 140px">Cancel</Button></div>
	</div>
</div>

<style>
	.veil {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		/* Past the stage too, on a window of another shape. */
		box-shadow: 0 0 0 200vmax rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 150;
	}
	/* Never wider or taller than the table: a big pack wraps, then scrolls. */
	.panel {
		max-width: 860px;
		max-height: 88%;
		display: flex;
		flex-direction: column;
		padding: 16px 20px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
	}
	h2 {
		margin: 0;
		color: var(--brass);
	}
	p {
		margin: 4px 0 10px;
		color: var(--ink-dim);
	}
	.grid {
		overflow-y: auto;
		min-height: 0;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		margin-top: 6px;
	}
</style>
