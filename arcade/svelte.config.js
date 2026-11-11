import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV === 'development';
const base = dev ? '' : (process.env.BASE_PATH ?? '/card-arcade');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', precompressed: false, strict: true }),
		paths: { base },
		// The kit: shared core, the generic run, and the game modules.
		alias: { $kit: '../kit' }
	}
};

export default config;
