// Relic editions on the web: their colors (as in the iPad app).

export const EDITION_COLOR: Record<string, string> = {
	etched: '#c9d6de',
	lacquered: '#e8573f',
	prismatic: '#d88cff',
	phantom: '#9fb0ff'
};

export function editionColor(key: string | undefined | null): string {
	return (key && EDITION_COLOR[key]) || 'var(--ink-dim)';
}
