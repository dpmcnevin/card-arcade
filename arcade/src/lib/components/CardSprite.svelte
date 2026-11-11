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
		pointerdown
	}: {
		card: Card;
		x: number;
		y: number;
		s: number;
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
	} = $props();

	const CW = 80,
		CH = 112;
	const init = untrack(() => ({ x: spawn?.x ?? x, y: spawn?.y ?? y, s: snap(s), face: spawn?.faceUp ?? faceUp, delay: spawn?.delay ?? 0, sound: !!spawn?.sound }));

	const pos = new Spring({ x: init.x, y: init.y, s: init.s }, { stiffness: 0.12, damping: 0.62 });
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
		const target = { x, y: y - lift, s: snap(s) };
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
	style:transform="translate3d({Math.round(pos.current.x - w / 2)}px, {Math.round(pos.current.y - h / 2)}px, 0)"
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
	<div class="flipper">
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
</div>

<style>
	.sprite {
		position: absolute;
		left: 0;
		top: 0;
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
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
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
			0 4px 0 3px rgba(0, 0, 0, 0.35);
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
