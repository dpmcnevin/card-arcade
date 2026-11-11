<!-- A wax seal (any game's), drawn as pixel art. -->
<script lang="ts">
	import type { SealDef } from '$kit/src/run/content.ts';
	import { seal as sealImage } from '../ui/images.ts';

	let { seal, size = 20 }: { seal: SealDef; size?: number } = $props();
</script>

<img class="seal" src={sealImage(seal.glyph, seal.color)} width={size} height={size} alt={seal.name} title="{seal.name}: {seal.text}" draggable="false" />

<style>
	.seal {
		display: inline-block;
		flex: none;
		image-rendering: pixelated;
		filter: drop-shadow(1px 2px 0 rgba(0, 0, 0, 0.35));
	}
</style>
