<!-- Tarot: the bids so far and yours (each higher than the last, or pass);
     then, if you take a Prise or Garde, the dog: pick six cards in your hand
     to set aside. -->
<script lang="ts">
	import Button from '../components/Button.svelte';
	import * as cards from '$kit/src/core/rules/cards.ts';
	import * as T from '$kit/games/tarot/rules.ts';
	import { seatName, handCount } from '$kit/games/tarot/ai.ts';
	import type { TarotHand } from '$kit/games/tarot/rules.ts';
	import { cardFace } from '../ui/images.ts';
	import type { PreProps } from './types.ts';

	let { run, picked, act, v }: PreProps = $props();
	const h = $derived((void v, run.hand as TarotHand));
	const high = $derived((void v, T.highBid(h)));
	const count = $derived((void v, handCount(h.hands[T.PLAYER])));
	// The cards you've picked, and whether they may all be set aside.
	const hand = $derived((void v, h.hands[T.PLAYER]));
	const chosen = $derived(picked.map((k) => hand.find((c) => `${c.suit}-${c.rank}` === k)).filter((c): c is cards.Card => !!c));
	const problem = $derived.by(() => {
		const sofar: cards.Card[] = [];
		for (const c of chosen) {
			if (!T.canSetAside(hand, c, sofar)) return `You can’t set aside ${cards.name(c)}${T.isKing(c) ? ' (a king)' : T.isOudler(c) ? ' (an oudler)' : ' while you have other cards'}`;
			sofar.push(c);
		}
		return null;
	});
</script>

<!-- The run changes in place: redraw on every change. -->
{#key v}
<div class="panel">
	{#if h.stage === 'bid'}
		<div class="title">Your bid</div>
		<div class="dim">
			{seatName(h.dealer)} dealt{#each h.bids as b}<br />{seatName(b.seat)}: {b.bid ? T.BIDS[b.bid - 1].name : 'pass'}{/each}
		</div>
		<div class="row">
			{#each T.BIDS as b, i}
				{#if i + 1 > high}
					<Button size="sm" variant={i === 0 ? 'brass' : 'plain'} onclick={() => act({ t: 'bid', bid: i + 1 })} style="width: 118px">{b.name}{b.mult > 1 ? ` x${b.mult}` : ''}</Button>
				{/if}
			{/each}
			<Button size="sm" variant="plain" onclick={() => act({ t: 'bid', bid: 0 })} style="width: 80px">Pass</Button>
		</div>
		<div class="hint">Hand count {count}: about 36 to take, 52 to guard</div>
	{:else if h.stage === 'dog'}
		<div class="title">The dog is yours</div>
		<div class="dog">{#each h.shownDog as c}<img src={cardFace(c)} alt={cards.name(c)} />{/each}</div>
		<div class="dim">Pick six cards in your hand to set aside: no kings or oudlers. They count for you.</div>
		<div class="row">
			<Button enabled={chosen.length === T.DOG_SIZE && !problem} onclick={() => act({ t: 'aside', cards: chosen.map(cards.code) })} style="width: 200px">Set aside {chosen.length}/{T.DOG_SIZE}</Button>
		</div>
		{#if problem}<div class="bad">{problem}</div>{/if}
	{/if}
</div>
{/key}

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 560px;
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
	.dog {
		display: flex;
		gap: 6px;
	}
	.dog img {
		width: 54px;
		height: 76px;
		image-rendering: auto;
	}
	.bad {
		color: var(--bad);
		font-size: 14px;
	}
</style>
