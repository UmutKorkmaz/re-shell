/**
 * Shared helpers for every code path that writes a `re-shell.workspaces.yaml`.
 *
 * Writers must emit documents that conform to the canonical v2 JSON Schema
 * (src/schemas/workspace-v2.schema.json). Hand-concatenated YAML cannot
 * guarantee that (unquoted scalars, `services:` serialised as null, scoped
 * package names, ...), so writers build a plain object and serialise it here.
 */

import * as yaml from 'js-yaml';
import { SCHEMA_URL } from '../constants/brand';

/** Pattern for workspace and service names in the v2 schema (kebab-case, 1-63 chars). */
export const SCHEMA_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** Message shown when a user-supplied workspace name does not match {@link SCHEMA_NAME_PATTERN}. */
export const SCHEMA_NAME_HINT =
  'Use lowercase letters, digits and hyphens (1-63 chars, starting and ending with a letter or digit)';

/** The v2 config version this CLI writes. */
export const WORKSPACE_CONFIG_VERSION = '2.0.0';

/**
 * `yaml-language-server` modeline. Putting this on the first line of a workspace
 * file makes VSCode (redhat.vscode-yaml), IntelliJ and any other
 * yaml-language-server client resolve the hosted schema for that file, with no
 * per-user IDE configuration.
 */
export const SCHEMA_MODELINE = `# yaml-language-server: $schema=${SCHEMA_URL}`;

/**
 * Convert an arbitrary string (npm scope, directory name, display name, ...)
 * into a schema-valid workspace/service name: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`.
 * Any npm scope is stripped, the rest is lowercased and invalid runs become a
 * single hyphen.
 *
 * @param raw - The original name.
 * @param fallback - Used when nothing valid is left after sanitising.
 * @returns A non-empty name of at most 63 characters that matches the schema pattern.
 */
export function toSchemaName(raw: string, fallback = 'service'): string {
  const withoutScope = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw;
  let name = withoutScope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (name.length > 63) {
    name = name.slice(0, 63).replace(/-+$/, '');
  }
  return name.length > 0 ? name : fallback;
}

/**
 * Return a key not already in `used` by appending `-2`, `-3`, ... , keeping the
 * result within the 63-character name limit. The chosen key is added to `used`.
 *
 * @param base - The preferred (already sanitised) key.
 * @param used - Keys already taken; mutated to include the returned key.
 * @returns A unique, schema-valid key.
 */
export function uniqueKey(base: string, used: Set<string>): string {
  let key = base;
  let suffix = 2;
  while (used.has(key)) {
    const tail = `-${suffix++}`;
    key = `${base.slice(0, 63 - tail.length).replace(/-+$/, '')}${tail}`;
  }
  used.add(key);
  return key;
}

/**
 * Serialise a workspace document to YAML, prefixed with the schema modeline.
 * `undefined` values are dropped (js-yaml would otherwise throw on them) and
 * an empty `services` map is written as `services: {}`, never as null.
 *
 * @param doc - Plain workspace document (must already be v2-shaped).
 * @returns YAML text ending in a newline.
 */
export function dumpWorkspaceYaml(doc: Record<string, unknown>): string {
  const body = yaml.dump(doc, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    skipInvalid: true,
  });
  return `${SCHEMA_MODELINE}\n${body}`;
}

/**
 * Re-attach the schema modeline after a load/dump round trip. js-yaml discards
 * comments, so a writer that rewrites an existing file would otherwise silently
 * drop the `# yaml-language-server: $schema=...` line and break IDE autocomplete.
 *
 * @param original - The file content that was read (and parsed).
 * @param dumped - The YAML produced from the modified document.
 * @returns `dumped`, prefixed with the original first line when that was a schema modeline.
 */
export function preserveSchemaModeline(original: string, dumped: string): string {
  const firstLine = original.split(/\r?\n/, 1)[0];
  return /^#\s*yaml-language-server:\s*\$schema=/.test(firstLine) ? `${firstLine}\n${dumped}` : dumped;
}
