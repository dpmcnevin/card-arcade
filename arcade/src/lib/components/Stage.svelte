<!-- The stage (1280x720 landscape, or 800x1280 portrait on a tall window),
     scaled to fit. The arcade's root shows every game; a game's own page
     (/hearts/, /bridge/, /euchre/) passes `only` and shows just that one. -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import Felt from './Felt.svelte';
	import Menu from './Menu.svelte';
	import Sidebar from './Sidebar.svelte';
	import Table from './Table.svelte';
	import Panels from './Panels.svelte';
	import Shop from './Shop.svelte';
	import * as sound from '../audio/sound.ts';
	import { setDeviceScale } from '../ui/images.ts';
	import Particles from './Particles.svelte';
	import TableOverview from './TableOverview.svelte';
	import Help from './Help.svelte';
	import LastTrick from './LastTrick.svelte';
	import DeckView from './DeckView.svelte';
	import { fx } from '../fx.svelte.ts';
	import { layoutFor, cssVars } from '../layout.ts';
	import { settings } from '../settings.svelte.ts';

	let { only }: { only?: string } = $props();
	let w = $state(1280),
		h = $state(720);
	const L = $derived(layoutFor(w, h));
	$effect.pre(() => {
		arcade.layout = L;
	});
	const scale = $derived(Math.min(w / L.W, h / L.H));
	// Rasterise card art for the real screen size, before anything draws it.
	$effect.pre(() => setDeviceScale(scale * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)));
	// The run is mutated in place; `arcade.v` is what changes.
	const run = $derived((void arcade.v, arcade.run));
	const phase = $derived((void arcade.v, arcade.run?.phase));
	// Each board opens with the table ahead, until you start it.
	const boardKey = $derived((void arcade.v, run ? `${run.table}.${run.board}` : ''));
	const fresh = $derived((void arcade.v, !!run && (run.phase === R.PHASE.PRE || run.phase === R.PHASE.PLAY) && run.handsLeft === run.handsThisBoard && run.score === 0));
	const ui = $derived(arcade.ui);

	function onKey(e: KeyboardEvent) {
		sound.unlock();
		if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
		const k = e.key.toLowerCase();
		if (k === ' ' || k === 'enter') {
			e.preventDefault();
			arcade.advance();
		} else if (k === 'escape') arcade.escape();
		else if (k === 'm') sound.toggleMusic();
	}
</script>

<!-- Browsers allow sound only after a gesture. -->
<svelte:window
	bind:innerWidth={w}
	bind:innerHeight={h}
	onpointerdown={(e) => {
		sound.unlock();
		// A tap anywhere hurries the other seats or a held trick (a card still plays).
		if (arcade.busy && !(e.target as HTMLElement)?.closest?.('.sprite.click, button, .pop')) arcade.skip();
	}}
	onkeydown={onKey}
/>

<div class="wrap">
	<!-- The felt fills the whole window, so a window that isn't the stage's
	     shape shows more table instead of bars. -->
	<div class="baize" style:width="{w / scale}px" style:height="{h / scale}px" style:transform="translate(-50%, -50%) scale({scale})">
		<Felt x={0} w={Math.ceil(w / scale)} h={Math.ceil(h / scale)} />
		<!-- The sidebar's panel runs on to the window's edge too. -->
		{#if arcade.screen === 'run' && run && ui}
			{@const ox = (w / scale - L.W) / 2}
			{@const oy = (h / scale - L.H) / 2}
			{#if L.portrait}
				<div class="sidefill portrait" style:height="{oy + L.side.h}px"></div>
			{:else}
				<div class="sidefill" style:width="{ox + L.side.w}px"></div>
			{/if}
		{/if}
	</div>
	<div class="stage" class:smooth={!settings.pixel} class:portrait={L.portrait} style="{cssVars(L)}; width: {L.W}px; height: {L.H}px" style:transform="scale({scale}) translate({fx.shakeX}px, {fx.shakeY}px)">
		{#if arcade.screen === 'menu' || !run || !ui}
			<Menu {only} />
		{:else}
			<Sidebar />
			{#if phase === R.PHASE.SHOP}
				<Shop />
			{:else}
				<Table />
				{#if phase === R.PHASE.PRE}
					<div class="pre"><ui.Pre {run} picked={arcade.picked} act={(a) => arcade.game(a)} v={arcade.v} /></div>
				{:else if phase === R.PHASE.PLAY && !arcade.busy && (void arcade.v, ui.view(run).legal.size)}
					<div class="out" style:top="{L.outAt[1]}px"><button onclick={() => arcade.game({ t: 'playOut' })}>Play it out</button></div>
				{/if}
				<Panels />
				{#if fresh && arcade.seen !== boardKey && arcade.overlay !== 'table'}
					<TableOverview close={() => (arcade.seen = boardKey)} />
				{/if}
			{/if}
		{/if}
		{#if arcade.screen === 'run' && run && ui}
			{#if arcade.overlay === 'help'}<Help />
			{:else if arcade.overlay === 'last'}<LastTrick />
			{:else if arcade.overlay === 'deck'}<DeckView />
			{:else if arcade.overlay === 'table'}<TableOverview close={() => ((arcade.overlay = null), (arcade.seen = boardKey))} />{/if}
		{/if}
		{#if arcade.toast}<div class="toast {arcade.toastTone ?? ''}">{arcade.toast}</div>{/if}
		<Particles w={L.W} h={L.H} {scale} />
	</div>
</div>

<style>
	.wrap {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		overflow: hidden;
	}
	.baize {
		position: absolute;
		left: 50%;
		top: 50%;
		transform-origin: 50% 50%;
	}
	.sidefill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		box-sizing: border-box;
		background: var(--sidebar);
		border-right: 3px solid var(--brass-dim);
	}
	.sidefill.portrait {
		right: 0;
		bottom: auto;
		border-right: none;
		border-bottom: 3px solid var(--brass-dim);
	}
	.stage {
		position: relative;
		width: 1280px;
		height: 720px;
		flex: none;
		overflow: hidden;
	}
	.stage.smooth {
		--card-render: auto;
	}
	.pre {
		position: absolute;
		left: var(--tx);
		width: var(--tw);
		top: calc(var(--ty) + 120px);
		display: flex;
		justify-content: center;
		pointer-events: none;
		z-index: 90;
	}
	.pre > :global(*) {
		pointer-events: auto;
	}
	.out {
		position: absolute;
		right: 24px;
		top: var(--out-y, 420px);
		z-index: 90;
	}
	.out button {
		font: inherit;
		font-size: 16px;
		padding: 6px 14px;
		background: var(--panel-edge);
		color: var(--ink);
		border: none;
		cursor: pointer;
	}
	.toast {
		position: absolute;
		left: 50%;
		top: 20px;
		transform: translateX(-50%);
		padding: 8px 16px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		font-size: 18px;
		z-index: 200;
		animation: toast-in 0.25s ease-out;
	}
	.toast.bad {
		border-color: var(--bad);
		color: #ffd3cc;
	}
	.toast.good {
		border-color: var(--good);
	}
	@keyframes toast-in {
		from {
			transform: translate(-50%, -12px);
			opacity: 0;
		}
	}
</style>
