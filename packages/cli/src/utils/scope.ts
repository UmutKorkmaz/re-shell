/**
 * The npm scope used when the CLI builds names for generated/installed
 * packages (e.g. `@re-shell/core`). Centralized here so the scope can be
 * changed in one place.
 *
 * @example
 * ```ts
 * const pkgName = `${GENERATED_PKG_SCOPE}/core`; // '@re-shell/core'
 * ```
 */
export const GENERATED_PKG_SCOPE = '@re-shell';

/**
 * Scope prefixes recognized when DETECTING Re-Shell-related packages.
 * Uses the `@re-shell/` brand scope for scaffolded/generated packages.
 *
 * Listed as a readonly tuple so consumers can iterate the prefixes when
 * matching package names without mutating the collection.
 *
 * @example
 * ```ts
 * RECOGNIZED_PKG_SCOPES.some(prefix => pkg.name.startsWith(prefix));
 * ```
 */
export const RECOGNIZED_PKG_SCOPES = ['@re-shell/'] as const;
