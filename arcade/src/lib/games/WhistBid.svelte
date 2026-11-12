<!-- Whist 22: the bids so far and yours, 0 up to the cards in hand. The
     dealer can't make the bids add up; in the one-card round you're bidding
     on a card you can't see, from the ones you can. -->
<script lang="ts">
	import Button from '../components/Button.svelte';
	import * as W from '$kit/games/whist22/rules.ts';
	import { seatName } from '$kit/games/whist22/ai.ts';
	import type { WhistHand } from '$kit/games/whist22/rules.ts';
	import type { PreProps } from './types.ts';
	import * as R from '$kit/src/run/run.ts';

	let { run, act, v }: PreProps = $props();
	const h = $derived((void v, run.hand as WhistHand));
	// The Fog: the other bids hidden until the round is over.
	const fog = $derived(R.bossIs(run, 'fog_bids'));
</script>

	<div class="panel">
		<div class="title">{h.blind ? 'Will your card win?' : `How many tricks will you take?`}</div>
		<!-- Each bid as dots, one per card in the round: filled for tricks bid. -->
		<div class="bids">
			{#each [1, 2, 3, 4].map((i) => ((h.dealer + i - 1) % 4) + 1) as s}
				{@const b = h.bids[s]}
				<div class="who" class:me={s === W.PLAYER}>{seatName(s)}{s === h.dealer ? ' (dealer)' : ''}</div>
				<div class="dots">
					{#if b === null}<span class="wait">{s === W.PLAYER ? 'your bid' : 'to bid'}</span>
					{:else if fog && s !== W.PLAYER}<span class="wait">bid hidden by the Fog</span>
					{:else}{#each Array(h.size) as _, i}<i class:on={i < b}></i>{/each}{#if b === 0}<span class="zero">none</span>{/if}{/if}
				</div>
			{/each}
			{#if !fog}
			<div class="who total">Bid so far</div>
			<div class="dots">
				{#each Array(Math.max(h.size, W.bidTotal(h))) as _, i}<i class:on={i < W.bidTotal(h)} class:over={i >= h.size}></i>{/each}
				<span class="zero">{W.bidTotal(h)} of {h.size}</span>
			</div>
			{/if}
		</div>
		<div class="row">
			{#each Array(h.size + 1) as _, b}
				{@const ok = W.canBid(h, W.PLAYER, b)}
				<Button size="sm" variant={ok ? 'brass' : 'plain'} enabled={ok} title={ok ? '' : h.minBid && b < h.minBid.min ? 'The Tyrant: no zero bids' : 'The dealer can’t make the bids add up'} onclick={() => act({ t: 'bid', bid: b })} style="width: 52px">{b}</Button>
			{/each}
		</div>
		<div class="hint">
			{#if h.minBid}The Tyrant: you can’t bid zero.{:else if h.blind}You can see everyone’s card but yours: bid 1 if yours beats theirs.{:else if W.forbidden(h, W.PLAYER) !== null}You deal, so not {W.forbidden(h, W.PLAYER)}: the bids can’t add up to {h.size}{/if}
		</div>
	</div>

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
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.bids {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 14px;
		align-items: center;
		font-size: 14px;
	}
	.who {
		color: var(--ink-dim);
	}
	.who.me {
		color: var(--brass);
	}
	.who.total {
		color: var(--ink-faint);
		padding-top: 4px;
		border-top: 2px solid var(--panel-edge);
	}
	.dots {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 14px;
	}
	.who.total + .dots {
		padding-top: 4px;
		border-top: 2px solid var(--panel-edge);
	}
	.dots i {
		width: 12px;
		height: 12px;
		background: var(--panel-edge);
	}
	.dots i.on {
		background: var(--brass);
	}
	.dots i.over {
		background: var(--bad);
	}
	.wait,
	.zero {
		margin-left: 6px;
		color: var(--ink-faint);
		font-size: 13px;
	}
	.hint {
		font-size: 13px;
		color: var(--ink-faint);
	}
</style>
