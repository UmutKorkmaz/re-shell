// Domain schemas / UI models, the JSON envelope and the error-code vocabulary.
export * from './re-shell.js';
export * from './plugins.js';
// Exact `--json` wire payloads, one schema per CLI command the consumers read.
export * from './wire.js';
// Wire -> domain adapters (the documented bridge between the two layers).
export * from './adapters.js';
// Theme packs, brand/white-label config and the OKLCH/contrast helpers behind them.
export * from './ui-theme.js';
