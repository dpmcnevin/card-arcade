<!-- A number that counts to its new value instead of jumping (money,
     score). The sidebar is redrawn on every change, so it starts from the
     value it last showed, kept across redraws. -->
<script module lang="ts">
	const last = new Map<string, number>();
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let { value, prefix = '', id }: { value: number; prefix?: string; id?: string } = $props();
	const key = $derived(id ?? prefix + 'n');
	// svelte-ignore state_referenced_locally
	const n = new Tween(last.get(id ?? prefix + 'n') ?? value, { duration: 450, easing: cubicOut });
	onMount(() => {
		n.target = value;
	});
	$effect(() => {
		n.target = value;
		last.set(key, value);
	});
</script>

{prefix}{Math.round(n.current).toLocaleString()}
