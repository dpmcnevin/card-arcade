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
	/* The sheen is a band on an oversized layer that slides across by
	   transform (the GPU moves it; nothing is repainted each frame). */
	.shine::after {
		content: '';
		position: absolute;
		left: -100%;
		top: -100%;
		width: 300%;
		height: 300%;
		pointer-events: none;
		background: linear-gradient(135deg, transparent 44%, rgba(255, 255, 255, 0.85) 50%, transparent 56%);
		mix-blend-mode: screen;
		animation: sweep 1.8s linear infinite;
		will-change: transform;
	}
	.shine.etched::before,
	.shine.lacquered::before {
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
	/* The rainbow turns by rotating an oversized wheel (a transform), not by
	   animating a filter, which would repaint it every frame. */
	.shine.prismatic::before {
		content: '';
		position: absolute;
		left: -60%;
		top: -60%;
		width: 220%;
		height: 220%;
		pointer-events: none;
		z-index: 1;
		background: conic-gradient(red, orange, yellow, lime, cyan, blue, violet, red);
		opacity: 0.6;
		mix-blend-mode: overlay;
		animation: turn 3s linear infinite;
		will-change: transform;
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
			transform: translate(-34%, -34%);
		}
		to {
			transform: translate(34%, 34%);
		}
	}
	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}
	/* Stepped: the shine jumps a pixel-art step at a time (a dozen frames a
	   sweep), which a browser without a GPU draws far more cheaply. */
	:global(.stepped) .shine::after {
		animation-timing-function: steps(12);
	}
	:global(.stepped) .shine.prismatic::before {
		animation-timing-function: steps(24);
	}
	@media (prefers-reduced-motion: reduce) {
		.shine::after,
		.shine.prismatic::before {
			animation: none;
		}
	}
</style>
