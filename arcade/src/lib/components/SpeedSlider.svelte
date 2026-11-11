<!-- How quickly the other seats play: a tortoise, a stepped bar, a hare. -->
<script lang="ts">
	import { settings } from '../settings.svelte.ts';
	const steps = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
</script>

<div class="speed">
	<div class="row"><span>Speed</span><span>{settings.speed}x</span></div>
	<div class="bar">
		{#each steps as s}
			<button class:on={s <= settings.speed} class:cur={s === settings.speed} title="{s}x" aria-label="Speed {s}x" onclick={() => settings.setSpeed(s)}></button>
		{/each}
	</div>
</div>

<style>
	.speed {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
		color: var(--ink-dim);
	}
	.row {
		display: flex;
		justify-content: space-between;
	}
	.bar {
		display: flex;
		gap: 3px;
	}
	.bar button {
		flex: 1;
		height: 10px;
		border: none;
		padding: 0;
		background: var(--panel-edge);
		cursor: pointer;
	}
	.bar button.on {
		background: var(--brass-dim);
	}
	.bar button.cur {
		background: var(--brass);
		height: 14px;
		margin-top: -2px;
	}
</style>
