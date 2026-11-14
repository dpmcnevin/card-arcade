<!-- The game's chunky button: a shadow, a lighter top lip, a little hop now and
     then when it's the obvious next step, and a click sound. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as sound from '../audio/sound.ts';
	import { glint } from '../ui/glint.ts';

	let {
		onclick,
		enabled = true,
		pulse = false,
		variant = 'brass',
		size = 'md',
		sound: snd = 'button',
		title,
		style = '',
		children
	}: {
		onclick?: (e: MouseEvent) => void;
		enabled?: boolean;
		pulse?: boolean;
		variant?: 'brass' | 'plain' | 'ploy';
		size?: 'sm' | 'md' | 'lg';
		sound?: string | false;
		title?: string;
		style?: string;
		children: Snippet;
	} = $props();

	function click(e: MouseEvent) {
		e.stopPropagation();
		if (!enabled) return;
		if (snd) sound.play(snd, { jitter: 0.03 });
		onclick?.(e);
	}
</script>

<button
	class="btn {variant} {size}"
	class:pulse={pulse && enabled}
	use:glint={{ ms: 520, everyTick: true, stagger: 300, off: () => !(pulse && enabled) }}
	disabled={!enabled}
	{title}
	{style}
	onclick={click}
>
	{@render children()}
</button>

<style>
	.btn {
		position: relative;
		border: none;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		color: var(--bg);
		background: var(--brass);
		box-shadow:
			0 4px 0 rgba(0, 0, 0, 0.35),
			inset 0 2px 0 rgba(255, 255, 255, 0.18);
		--px-a: 4px;
		--px-sy: 4px;
		clip-path: var(--px-clip);
		transition:
			transform 0.08s,
			filter 0.08s;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		white-space: nowrap;
	}
	.md {
		font-size: 20px;
		padding: 0 18px;
		height: 42px;
	}
	.lg {
		font-size: 21px;
		height: 46px;
		padding: 0 22px;
	}
	.sm {
		font-size: 14px;
		height: 30px;
		padding: 0 10px;
	}
	.plain {
		background: var(--panel-edge);
		color: var(--ink);
	}
	.ploy {
		background: var(--ploy);
		color: var(--ink);
	}
	.btn:hover:not(:disabled) {
		filter: brightness(1.15);
		transform: translateY(-2px);
	}
	.btn:active:not(:disabled) {
		transform: translateY(2px);
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
		--px-sy: 2px;
	}
	.btn:disabled {
		background: var(--panel-edge);
		color: var(--ink-faint);
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
		cursor: default;
	}
	/* The obvious next step hops now and then (the shared glint clock). */
	.pulse.go:not(:hover) {
		animation: hop 0.52s ease-out;
	}
	@keyframes hop {
		30% {
			transform: translateY(-4px);
		}
		60% {
			transform: translateY(1px);
		}
	}
</style>
