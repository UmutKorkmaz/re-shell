/**
 * The npm scope used when the CLI builds names for generated/installed
 * packages (e.g. `@umutkorkmaz/core`). Centralized here so the scope can be
 * changed in one place.
 */
export const GENERATED_PKG_SCOPE = '@umutkorkmaz';

/**
 * Scope prefixes recognized when DETECTING Re-Shell-related packages.
 * Includes the legacy `@re-shell/` scope so packages published under the old
 * scope still resolve.
 */
export const RECOGNIZED_PKG_SCOPES = ['@umutkorkmaz/', '@re-shell/'] as const;
