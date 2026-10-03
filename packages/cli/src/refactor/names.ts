// Naming helpers for `refactor rename-service`.

/** Same pattern the workspace v2 schema enforces for service names. */
export const SERVICE_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export interface CaseVariants {
  kebab: string;
  snake: string;
  pascal: string;
  camel: string;
  upper: string;
}

function words(name: string): string[] {
  return name.split(/[^A-Za-z0-9]+/).filter(Boolean);
}

/** All spellings of a service name used across languages and config formats. */
export function caseVariants(name: string): CaseVariants {
  const w = words(name);
  const pascal = w.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
  return {
    kebab: w.join('-').toLowerCase(),
    snake: w.join('_').toLowerCase(),
    pascal,
    camel: pascal.charAt(0).toLowerCase() + pascal.slice(1),
    upper: w.join('_').toUpperCase(),
  };
}

/** Escape a string for use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rename a package/manifest name by replacing the service name where it appears
 * as a whole `-`/`_`/`.`-delimited token of the last path segment
 * (`@acme/billing` -> `@acme/payments`, `billing-service` -> `payments-service`).
 * Returns the input unchanged when the token does not appear.
 */
export function renameInName(name: string, oldName: string, newName: string): string {
  const slash = name.lastIndexOf('/');
  const head = slash >= 0 ? name.slice(0, slash + 1) : '';
  const last = slash >= 0 ? name.slice(slash + 1) : name;
  const re = new RegExp(`(^|[-_.])${escapeRegExp(oldName)}(?=$|[-_.])`, 'g');
  return head + last.replace(re, `$1${newName}`);
}

/** Normalize a Python distribution name (PEP 503). */
export function normalizePyName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}
