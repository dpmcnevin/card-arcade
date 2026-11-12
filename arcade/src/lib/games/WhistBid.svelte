<!-- Whist 22: the bids so far and yours, 0 up to the cards in hand. The
     dealer can't make the bids add up; in the one-card round you're bidding
     on a card you can't see, from the ones you can. -->
<script lang="ts">
	import Button from '../components/Button.svelte';
	import * as W from '$kit/games/whist22/rules.ts';
	import { seatName } from '$kit/games/whist22/ai.ts';
	import type { WhistHand } from '$kit/games/whist22/rules.ts';
	import type { PreProps } from './types.ts';

	let { run, act, v }: PreProps = $props();
	const h = $derived((void v, run.hand as WhistHand));
</script>

<!-- The run changes in place: redraw on every change. -->
{#key v}
	<div class="panel">
		<div class="title">{h.blind ? 'Will your card win?' : `How many tricks will you take?`}</div>
		<div class="dim">
			{seatName(h.dealer)} dealt{#each [1, 2, 3, 4].map((i) => ((h.dealer + i - 1) % 4) + 1) as s}{#if h.bids[s] !== null}<br />{seatName(s)}: {h.bids[s]}{/if}{/each}
		</div>
		<div class="row">
			{#each Array(h.size + 1) as _, b}
				{@const ok = W.canBid(h, W.PLAYER, b)}
				<Button size="sm" variant={ok ? 'brass' : 'plain'} enabled={ok} title={ok ? '' : 'The dealer can’t make the bids add up'} onclick={() => act({ t: 'bid', bid: b })} style="width: 52px">{b}</Button>
			{/each}
		</div>
		<div class="hint">
			{#if h.blind}You can see everyone’s card but yours: bid 1 if yours beats theirs.{:else}Bids so far add up to {W.bidTotal(h)} of {h.size}{W.forbidden(h, W.PLAYER) !== null ? ` · you deal, so not ${W.forbidden(h, W.PLAYER)}` : ''}{/if}
		</div>
	</div>
{/key}

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 520px;
		padding: 16px 22px;
		background: rgba(10, 18, 14, 0.94);
		border: 2px solid var(--brass-dim);
	}
	.title {
		font-size: 22px;
		color: var(--ink);
	}
	.dim {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.hint {
		font-size: 13px;
		color: var(--ink-faint);
	}
</style>
