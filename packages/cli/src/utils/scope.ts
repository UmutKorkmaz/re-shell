/**
 * The npm scope used when the CLI builds names for generated/installed
 * packages (e.g. `@re-shell/core`). Centralized here so the scope can be
 * changed in one place.
 */
export const GENERATED_PKG_SCOPE = '@re-shell';

/**
 * Scope prefixes recognized when DETECTING Re-Shell-related packages.
 * Uses the `@re-shell/` brand scope for scaffolded/generated packages.
 */
export const RECOGNIZED_PKG_SCOPES = ['@re-shell/'] as const;
