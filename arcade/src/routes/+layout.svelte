<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Card Arcade — cardkit prototype</title>
</svelte:head>

{@render children()}
