<!-- Hearts: pick three cards from your hand, then pass them. -->
<script lang="ts">
	import Button from '../components/Button.svelte';
	import * as H from '$kit/games/hearts/rules/hearts.ts';
	import type { PreProps } from './types.ts';
	import type { HeartsHand } from '$kit/games/hearts/module.ts';
	import * as cards from '$kit/src/core/rules/cards.ts';

	let { run, picked, act, v }: PreProps = $props();
	const h = $derived((void v, run.hand as HeartsHand));
	const to = $derived(H.SEAT_NAMES[H.passTarget(H.PLAYER, h.passDir)]);
	function pass() {
		const mine = h.dealt[H.PLAYER];
		const codes = picked.map((k) => cards.code(mine.find((c) => `${c.suit}-${c.rank}` === k)!));
		act({ t: 'pass', cards: codes });
	}
</script>

<div class="panel">
	<div class="title">Pass three cards {h.passDir} to {to}</div>
	<div class="dim">{picked.length} of 3 chosen · tap cards to pick them</div>
	<Button enabled={picked.length === 3} onclick={pass} style="width: 220px">Pass</Button>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 18px 28px;
		background: rgba(10, 18, 14, 0.92);
		border: 2px solid var(--ploy);
	}
	.title {
		font-size: 26px;
		font-weight: 700;
	}
	.dim {
		color: var(--ink-dim);
	}
</style>
