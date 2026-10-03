/**
 * Single source of truth for every public Re-Shell URL the CLI emits.
 *
 * Nothing else under `src/` may retype these. The docs site (`site/`, Astro on
 * GitHub Pages) imports this module too, so the origin/base the site is built
 * with, the JSON Schema `$id`, and the links the CLI prints can never drift
 * apart. This module is deliberately dependency-free so the site build can
 * import it without pulling in the CLI.
 */

/** Origin the docs site is deployed to (GitHub Pages user site). */
export const SITE_ORIGIN = 'https://umutkorkmaz.github.io';

/** Path the docs site is served under (Astro `base`, the repo's Pages path). */
export const SITE_BASE_PATH = '/re-shell';

/** Root URL of the docs site, without a trailing slash. */
export const SITE_URL = `${SITE_ORIGIN}${SITE_BASE_PATH}`;

/** Root of the documentation (the docs site is the documentation). */
export const DOCS_URL = SITE_URL;

/** GitHub repository. */
export const REPO_URL = 'https://github.com/UmutKorkmaz/re-shell';

/** GitHub issue tracker. */
export const ISSUES_URL = `${REPO_URL}/issues`;

/** GitHub releases page (changelog). */
export const RELEASES_URL = `${REPO_URL}/releases`;

/** Path, relative to {@link SITE_URL}, of the published workspace v2 JSON Schema. */
export const SCHEMA_PATH = '/schemas/workspace-v2.json';

/**
 * Stable, hosted URL of the workspace.yaml v2 JSON Schema. This is the schema's
 * `$id`, the target of every IDE mapping, and the `$schema` modeline written
 * into generated `re-shell.workspaces.yaml` files.
 */
export const SCHEMA_URL = `${SITE_URL}${SCHEMA_PATH}`;

/**
 * File names the workspace definition is read from. IDE schema mappings are
 * derived from this list so the globs never drift from what the CLI loads.
 */
export const WORKSPACE_FILE_NAMES = ['re-shell.workspaces.yaml', 're-shell.workspaces.yml'] as const;

/**
 * Build a documentation page URL.
 *
 * @param slug - Docs slug relative to the site root (e.g. `cli/workspace`).
 * @returns Absolute URL with a trailing slash, matching the Astro/Starlight output.
 */
export function docsUrl(slug: string): string {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  return clean ? `${DOCS_URL}/${clean}/` : `${DOCS_URL}/`;
}
