<!-- One card on the table, for any game. The table says where the card
     should be; the sprite chases it with springs (position and size) and
     flips with a 3D turn, which gives deal-ins, plays and flips one lively
     feel. At rest a card sits unrotated at a size that lands its pixel art
     on whole device pixels, so it stays crisp. -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import type { Card } from '$kit/src/core/rules/cards.ts';
	import type { SealDef } from '$kit/src/run/content.ts';
	import { cardBack, cardFace, artPixels, snap } from '../ui/images.ts';
	import * as sound from '../audio/sound.ts';
	import SealBadge from './SealBadge.svelte';
	import { editionColor } from './editions.ts';
	import { fx } from '../fx.svelte.ts';

	export interface Spawn {
		x: number;
		y: number;
		/** Seconds before the card appears and starts moving. */
		delay?: number;
		faceUp?: boolean;
		sound?: boolean;
	}

	let {
		card,
		x,
		y,
		s,
		r = 0,
		hovered = false,
		idle = null,
		faceUp,
		z,
		back,
		lift = 0,
		dim = false,
		trump = false,
		edition,
		seal,
		highlight,
		spawn,
		flipDelay = 0,
		click,
		pointerdown,
		thud = false
	}: {
		card: Card;
		x: number;
		y: number;
		s: number;
		/** Rotation in radians (a fanned hand). */
		r?: number;
		/** Under the pointer: a quick wobble each time it becomes so. */
		hovered?: boolean;
		/** Phase of a gentle idle sway, or null for none. */
		idle?: number | null;
		faceUp: boolean;
		z: number;
		back: string;
		lift?: number;
		dim?: boolean;
		trump?: boolean;
		edition?: string;
		seal?: SealDef;
		highlight?: string;
		spawn?: Spawn;
		flipDelay?: number;
		click?: () => void;
		pointerdown?: (e: PointerEvent) => void;
		/** Landing here hits the table: a bigger bump and a little shake (a card played to the trick). */
		thud?: boolean;
	} = $props();

	const CW = 80,
		CH = 112;
	const init = untrack(() => ({ x: spawn?.x ?? x, y: spawn?.y ?? y, r, s: snap(s), face: spawn?.faceUp ?? faceUp, delay: spawn?.delay ?? 0, sound: !!spawn?.sound }));

	const pos = new Spring({ x: init.x, y: init.y, r: init.r, s: init.s }, { stiffness: 0.15, damping: 0.7 });
	const turn = new Spring(init.face ? 0 : 180, { stiffness: 0.1, damping: 0.62 });
	let launched = $state(init.delay <= 0);
	let face = $state(init.face);

	onMount(() => {
		if (launched) return;
		const t = setTimeout(() => {
			launched = true;
			if (init.sound) sound.play('deal', { jitter: 0.1, volume: 0.6 });
		}, init.delay * 1000);
		return () => clearTimeout(t);
	});

	$effect(() => {
		const target = { x, y: y - lift, r, s: snap(s) };
		if (launched) pos.target = target;
	});

	$effect(() => {
		const want = faceUp;
		if (!launched || want === untrack(() => face)) return;
		const t = setTimeout(() => {
			face = want;
			turn.target = want ? 0 : 180;
			sound.play('flip', { jitter: 0.08, volume: 0.6 });
		}, flipDelay * 1000);
		return () => clearTimeout(t);
	});

	// Art for the size the card is heading to: whole device pixels per art pixel.
	const px = $derived(artPixels(s));
	const front = $derived(cardFace(card, trump, px));
	const backImg = $derived(cardBack(back, px));
	// Restart the wobble each time the card comes under the pointer.
	let wobbleKey = $state(0);
	$effect(() => {
		if (hovered) wobbleKey = untrack(() => wobbleKey) + 1;
	});
	// ---- weight: a card in flight lifts off the felt (bigger, longer shadow)
	// and leans into its motion; when it lands it bumps and settles with a
	// shiver. A card under the pointer tips toward it.
	let air = $state(0);
	let lean = $state(0);
	let bump = $state({ s: 1, r: 0 });
	let prevX = untrack(() => init.x);
	let flying = false;
	let raf = 0;
	function land(amount: number) {
		cancelAnimationFrame(raf);
		const t0 = performance.now();
		const step = () => {
			const t = (performance.now() - t0) / 1000;
			const d = Math.max(0, 1 - t / 0.42);
			bump = { s: 1 + 0.11 * amount * d * d, r: 0.075 * amount * Math.sin(t * 42) * d * d };
			if (d > 0) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}
	$effect(() => {
		const { x: cx, y: cy } = pos.current;
		const { x: tx, y: ty } = pos.target;
		untrack(() => {
			const dist = Math.hypot(tx - cx, ty - cy);
			const dx = cx - prevX;
			prevX = cx;
			lean = Math.abs(dx) < 0.05 && dist < 1 ? 0 : lean * 0.6 + Math.max(-0.28, Math.min(0.28, dx * 0.011)) * 0.4;
			air = Math.min(1, dist / 90);
			if (dist > 60) flying = true;
			else if (flying && dist < 5) {
				flying = false;
				land(thud ? 1 : 0.55);
				if (thud) fx.shake(2.2);
			}
		});
	});
	let el: HTMLDivElement;
	let tip = $state({ x: 0, y: 0 });
	$effect(() => {
		if (!hovered) {
			tip = { x: 0, y: 0 };
			return;
		}
		const move = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			tip = {
				x: Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2))),
				y: Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)))
			};
		};
		window.addEventListener('pointermove', move);
		return () => window.removeEventListener('pointermove', move);
	});
	$effect(() => () => cancelAnimationFrame(raf));
	const rot = $derived(pos.current.r + lean + bump.r);
	const grow = $derived((1 + 0.06 * air) * bump.s);
	const shadow = $derived(4 + 12 * air + lift * 0.3);
	const tipping = $derived(Math.abs(tip.x) + Math.abs(tip.y) > 0.01);

	const w = $derived(CW * pos.current.s),
		h = $derived(CH * pos.current.s);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="sprite"
	class:hidden={!launched}
	class:click={!!click}
	style:z-index={z}
	style:width="{w}px"
	style:height="{h}px"
	style:transform="translate3d({Math.round(pos.current.x - w / 2)}px, {Math.round(pos.current.y - h / 2)}px, 0){Math.abs(rot) > 0.002 ? ` rotate(${rot}rad)` : ''}{Math.abs(grow - 1) > 0.002 ? ` scale(${grow})` : ''}{tipping ? ` perspective(700px) rotateX(${-tip.y * 11}deg) rotateY(${tip.x * 11}deg)` : ''}"
	style:--shadow="{shadow}px"
	style:--shadow-a={0.35 - 0.12 * air}
	bind:this={el}
	onclick={click}
	onpointerdown={pointerdown}
	out:fade={{ duration: 220 }}
>
	{#snippet frontFace()}
		<div class="face front" class:ed={!!edition} style:--glow={edition ? editionColor(edition) : 'transparent'}>
			<img src={front} alt="" draggable="false" />
			{#if seal}<span class="seal"><SealBadge {seal} size={Math.round(22 * pos.current.s)} /></span>{/if}
			{#if dim}<div class="dim"></div>{/if}
			{#if highlight}<div class="ring" style:border-color={highlight}></div>{/if}
		</div>
	{/snippet}
	{#snippet backFace(turned: boolean)}
		<div class="face back" class:turned><img src={backImg} alt="" draggable="false" /></div>
	{/snippet}
	<div class="sway" class:idle={idle != null} style:animation-delay={idle != null ? `${-idle * 0.77}s` : undefined}>
	{#key wobbleKey}
	<div class="flipper" class:wobble={wobbleKey > 0}>
		{#if turn.current > 0.5 && turn.current < 179.5}
			<!-- Mid-flip: both sides in 3D. -->
			<div class="turner" style:transform="rotateY({turn.current}deg)">
				{@render frontFace()}
				{@render backFace(true)}
			</div>
		{:else if turn.current <= 0.5}
			{@render frontFace()}
		{:else}
			{@render backFace(false)}
		{/if}
	</div>
	{/key}
	</div>
</div>

<style>
	.sprite {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: 50% 50%;
		will-change: transform;
	}
	.hidden {
		visibility: hidden;
	}
	.click {
		cursor: pointer;
	}
	.click:hover .flipper {
		translate: 0 -10px;
	}
	.sway {
		width: 100%;
		height: 100%;
	}
	.sway.idle {
		animation: sway 4.83s ease-in-out infinite;
	}
	@keyframes sway {
		0%,
		100% {
			transform: rotate(-0.46deg);
		}
		50% {
			transform: rotate(0.46deg);
		}
	}
	.flipper.wobble {
		animation: wobble 0.34s linear;
	}
	@keyframes wobble {
		0% {
			transform: rotate(0);
		}
		20% {
			transform: rotate(3.5deg);
		}
		45% {
			transform: rotate(-2.6deg);
		}
		70% {
			transform: rotate(1.4deg);
		}
		100% {
			transform: rotate(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sway.idle,
		.flipper.wobble {
			animation: none;
		}
	}
	.flipper {
		position: relative;
		width: 100%;
		height: 100%;
		transition: translate 0.12s;
	}
	.turner {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
	}
	.face {
		position: absolute;
		inset: 0;
		border-radius: 4px;
		box-shadow: 0 var(--shadow, 4px) 0 rgba(0, 0, 0, var(--shadow-a, 0.35));
	}
	.turner .face {
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.face img {
		width: 100%;
		height: 100%;
		display: block;
		image-rendering: var(--card-render, pixelated);
	}
	.face.ed {
		box-shadow:
			0 0 0 3px var(--glow),
			0 var(--shadow, 4px) 0 3px rgba(0, 0, 0, var(--shadow-a, 0.35));
	}
	.back.turned {
		transform: rotateY(180deg);
	}
	.seal {
		position: absolute;
		right: -6px;
		top: -6px;
		display: flex;
	}
	.dim {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: rgba(15, 25, 23, 0.5);
	}
	.ring {
		position: absolute;
		inset: -3px;
		border: 3px solid;
		border-radius: 6px;
	}
</style>
