<!-- The look of a relic edition over whatever it wraps (usually an icon):
     an engraved silver sheen, a red gloss, a turning rainbow, or a pale
     see-through ghost for Phantom. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { edition, children }: { edition?: string | null; children: Snippet } = $props();
</script>

{#if edition}
	<span class="shine {edition}">{@render children()}</span>
{:else}
	{@render children()}
{/if}

<style>
	.shine {
		position: relative;
		display: inline-flex;
		overflow: hidden;
		flex: none;
	}
	.shine::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(135deg, transparent 35%, rgba(255, 255, 255, 0.85) 50%, transparent 65%) no-repeat;
		background-size: 300% 300%;
		mix-blend-mode: screen;
		animation: sweep 1.8s linear infinite;
	}
	.shine.etched::before,
	.shine.lacquered::before,
	.shine.prismatic::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}
	.shine.etched::before {
		background: rgba(201, 214, 222, 0.35);
		mix-blend-mode: color;
	}
	.shine.lacquered::before {
		background: rgba(232, 87, 63, 0.3);
		mix-blend-mode: overlay;
	}
	.shine.prismatic::before {
		background: conic-gradient(red, orange, yellow, lime, cyan, blue, violet, red);
		opacity: 0.6;
		mix-blend-mode: overlay;
		animation: turn 3s linear infinite;
	}
	.shine.phantom {
		opacity: 0.6;
		filter: saturate(0.15) drop-shadow(2px 2px 0 #9fb0ff);
	}
	.shine.phantom::after {
		display: none;
	}
	@keyframes sweep {
		from {
			background-position: 100% 100%;
		}
		to {
			background-position: 0% 0%;
		}
	}
	@keyframes turn {
		to {
			filter: hue-rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shine::after,
		.shine.prismatic::before {
			animation: none;
		}
	}
</style>
