<!-- An opened bundle: three choices, take one (or none). -->
<script lang="ts">
	import { arcade } from '../app.svelte.ts';
	import * as R from '$kit/src/run/run.ts';
	import { BUNDLES, CARD_EDITIONS, RELIC_EDITIONS } from '$kit/src/run/content.ts';
	import { cardFace } from '../ui/images.ts';
	import { editionColor } from './editions.ts';
	import Icon from './Icon.svelte';
	import Shine from './Shine.svelte';
	import Button from './Button.svelte';

	const run = $derived((void arcade.v, arcade.run!));
	const o = $derived(run.opening!);
</script>

<div class="veil">
	<div class="panel">
		<h2>{BUNDLES[o.bundle].name}</h2>
		<div class="choices">
			{#each o.options as c, i}
				<div class="choice">
					{#if c.kind === 'relic'}
						<Shine edition={c.edition}><Icon name={c.def.icon} scale={4} /></Shine>
						<h3>{c.def.name}</h3>
						{#if c.edition}<div class="ed" style:color={editionColor(c.edition)}>{RELIC_EDITIONS[c.edition].name}: {RELIC_EDITIONS[c.edition].text}</div>{/if}
						<p>{c.def.text}</p>
					{:else if c.kind === 'ploy'}
						<Icon name={c.def.icon} scale={4} />
						<h3>{c.def.name}</h3>
						<p>{c.def.text}</p>
					{:else}
						{@const card = run.pack.find((x) => x.id === c.cardId)!}
						<img src={cardFace(card)} alt="" style:outline="3px solid {editionColor(c.edition)}" />
						<h3>{CARD_EDITIONS[c.edition].name}</h3>
						<p>{CARD_EDITIONS[c.edition].text}</p>
					{/if}
					<Button onclick={() => arcade.do({ t: 'pick', index: i })} style="width: 100%">Take</Button>
				</div>
			{/each}
		</div>
		<div class="foot"><Button variant="plain" onclick={() => arcade.do({ t: 'pick', index: -1 })} style="width: 160px">Take nothing</Button></div>
	</div>
</div>

<style>
	.veil {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		/* Past the stage too, on a window of another shape. */
		box-shadow: 0 0 0 200vmax rgba(0, 0, 0, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 150;
	}
	.panel {
		padding: 18px 24px;
		background: var(--panel);
		border: 3px solid var(--ploy);
	}
	h2 {
		margin: 0 0 12px;
		color: var(--ploy-light);
	}
	.choices {
		display: flex;
		gap: 16px;
	}
	.choice {
		width: 210px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 12px;
		background: var(--bg);
		text-align: center;
	}
	.choice img {
		width: 64px;
		height: 90px;
		image-rendering: pixelated;
	}
	h3 {
		margin: 0;
	}
	p {
		margin: 0;
		color: var(--ink-dim);
		font-size: 14px;
		flex: 1;
	}
	.ed {
		font-size: 13px;
	}
	.foot {
		display: flex;
		justify-content: flex-end;
		margin-top: 12px;
	}
</style>
