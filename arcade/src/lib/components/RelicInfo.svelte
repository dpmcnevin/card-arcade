<!-- A relic's details in a small popup: name, rarity, what it does (live, for
     relics that grow), its edition, and (in the club) what it sells for. -->
<script lang="ts">
	import * as R from '$kit/src/run/run.ts';
	import type { Relic } from '$kit/src/run/run.ts';
	import { RELIC_EDITIONS } from '$kit/src/run/content.ts';
	import { editionColor } from './editions.ts';

	let { relic, note }: { relic: Relic; note?: string } = $props();
	const ed = $derived(relic.edition ? RELIC_EDITIONS[relic.edition] : null);
</script>

<div class="info">
	<div class="rar">{R.RARITY_NAME[relic.def.rarity]} relic</div>
	<h3>{relic.name}</h3>
	<p>{relic.def.describe?.(relic) ?? relic.def.text}</p>
	{#if ed}<p style:color={editionColor(ed.key)}>{ed.name}: {ed.text.toLowerCase()}</p>{/if}
	{#if note}<p class="note">{note}</p>{/if}
</div>

<style>
	.info {
		width: 250px;
		padding: 10px 14px 12px;
		background: var(--panel);
		border: 2px solid var(--brass-dim);
		box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45);
		text-align: left;
	}
	.rar {
		font-size: 12px;
		color: var(--ink-faint);
	}
	h3 {
		margin: 2px 0 4px;
		font-size: 18px;
	}
	p {
		margin: 4px 0 0;
		font-size: 14px;
		line-height: 1.3;
		color: var(--ink-dim);
	}
	.note {
		color: var(--brass);
	}
</style>
