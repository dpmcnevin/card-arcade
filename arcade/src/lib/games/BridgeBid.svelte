<!-- Bridge: partner's bid, and every contract with its odds and its floor
     score; the star is the recommended bid. -->
<script lang="ts">
	import Button from '../components/Button.svelte';
	import * as cards from '$kit/src/core/rules/cards.ts';
	import { bidOptions, recommendBid } from '$kit/games/bridge/module.ts';
	import type { Deal } from '$kit/games/bridge/module.ts';
	import type { PreProps } from './types.ts';

	let { run, act, v }: PreProps = $props();
	const opts = $derived((void v, bidOptions(run)));
	const rec = $derived(recommendBid(run, opts));
	const d = $derived((void v, run.hand as Deal));
	let pick = $state<{ level: number; strain: number } | null>(null);
	const need = $derived(run.target - run.score);
	const at = (level: number, strain: number) => opts.find((o) => o.contract.level === level && o.contract.strain === strain)!;
</script>

<div class="panel">
	<div class="head">
		<div>
			<div class="title">Your bid</div>
			<div class="dim">Partner: {d.partnerInfo.text} · you hold {cards.hcp(d.hands[d.declarer])} HCP</div>
		</div>
		<Button enabled={!!pick} onclick={() => pick && act({ t: 'bid', ...pick })} style="width: 160px">Bid {pick ? cards.contractName({ ...pick, doubled: 0 }) : ''}</Button>
	</div>
	<div class="grid">
		{#each [1, 2, 3, 4, 5, 6, 7] as level}
			{#each [1, 2, 3, 4, 5] as strain}
				{@const o = at(level, strain)}
				<button
					class="cell"
					class:sel={pick?.level === level && pick?.strain === strain}
					class:clears={o.projected >= need}
					class:red={cards.STRAINS[strain].red}
					onclick={() => (pick = { level, strain })}
				>
					<span class="c">{level}{cards.STRAINS[strain].glyph}{rec.level === level && rec.strain === strain ? ' ★' : ''}</span>
					<span class="p">{Math.round(o.chance * 100)}% · {o.projected}</span>
				</button>
			{/each}
		{/each}
	</div>
</div>

<style>
	.panel {
		width: 600px;
		padding: 10px 16px 12px;
		background: rgba(10, 18, 14, 0.94);
		border: 2px solid var(--brass-dim);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
	}
	.dim {
		color: var(--ink-dim);
		font-size: 14px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 3px;
	}
	.cell {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 6px;
		padding: 2px 0;
		background: var(--panel);
		border: 2px solid transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}
	.cell.clears {
		border-color: var(--brass-dim);
	}
	.cell.sel {
		background: var(--panel-edge);
		border-color: var(--brass);
	}
	.c {
		font-size: 15px;
		font-weight: 700;
	}
	.red .c {
		color: var(--bad);
	}
	.p {
		font-size: 11px;
		color: var(--ink-dim);
	}
</style>
