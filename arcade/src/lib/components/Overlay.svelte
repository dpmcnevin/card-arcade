<!-- A modal over the stage: a titled panel, closed by its button, a click
     outside, or Escape. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Button from './Button.svelte';

	let { title, close, width = 760, height, children }: { title: string; close: () => void; width?: number; height?: number; children: Snippet } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="veil" onclick={close} transition:fade={{ duration: 120 }}>
	<div class="panel" style:width="{width}px" style:height={height ? `${height}px` : undefined} onclick={(e) => e.stopPropagation()} in:fly={{ y: 20, duration: 200 }}>
		<div class="head"><h2>{title}</h2><Button variant="plain" size="sm" onclick={close}>Close</Button></div>
		<div class="body">{@render children()}</div>
	</div>
</div>

<style>
	.veil {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
	}
	.panel {
		max-height: 660px;
		display: flex;
		flex-direction: column;
		background: rgba(12, 22, 18, 0.98);
		border: 3px solid var(--brass-dim);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 20px 8px;
	}
	h2 {
		margin: 0;
		color: var(--brass);
		font-size: 28px;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 20px 18px;
	}
</style>
