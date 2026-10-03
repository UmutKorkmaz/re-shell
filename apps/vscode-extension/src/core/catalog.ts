import {
  jsonResponseSchema,
  commandCatalogArgWireSchema,
  commandCatalogEntryWireSchema,
  commandCatalogFlagWireSchema,
  commandCatalogWireSchema,
  type CommandCatalogArgWire,
  type CommandCatalogEntryWire,
  type CommandCatalogFlagWire,
  type CommandCatalogWire,
} from '@re-shell/contracts';

/**
 * PURE module. No VS Code, no Node side effects.
 *
 * Parses the `re-shell commands list --json` payload into a validated catalog
 * the extension can render as a tree. The CLI emits the canonical envelope
 * ({ ok, data, warnings } | { ok:false, error, warnings }) from
 * @re-shell/contracts, so we validate against that exact shape and never
 * trust the raw stdout blob.
 */

// The catalog entry shapes are the exact wire schemas published by
// @re-shell/contracts (`commands list --json`); the names below are kept as the
// extension's public vocabulary.

/** A single declared argument of a catalog command. */
export const catalogArgSchema = commandCatalogArgWireSchema;
export type CatalogArg = CommandCatalogArgWire;

/**
 * A single declared flag/option of a catalog command. `takesValue` decides
 * whether a flag contributes a value token to the assembled argv.
 */
export const catalogFlagSchema = commandCatalogFlagWireSchema;
export type CatalogFlag = CommandCatalogFlagWire;

/** One runnable command in the catalog. */
export const catalogEntrySchema = commandCatalogEntryWireSchema;
export type CatalogEntry = CommandCatalogEntryWire;

/** The `data` payload of `commands list --json` is the array of catalog entries. */
export const catalogDataSchema = commandCatalogWireSchema;
export type CatalogData = CommandCatalogWire;

/**
 * Full envelope schema for the catalog response, built from the shared
 * `jsonResponseSchema` helper so the success/error branches stay identical to
 * every other CLI command.
 */
export const catalogEnvelopeSchema = jsonResponseSchema(catalogDataSchema);

/** Outcome of parsing a raw catalog payload. */
export type ParseCatalogResult =
  | { ok: true; entries: CatalogEntry[]; warnings: string[] }
  | { ok: false; error: string };

/**
 * Parse a raw `commands list --json` stdout string (or already-parsed value)
 * into a validated catalog.
 *
 * - Malformed JSON → error (never throws).
 * - Envelope that does not match the contract → error.
 * - `ok:false` envelope → surfaces the CLI's error code + message.
 * - `ok:true` envelope → validated, sorted entries.
 */
export function parseCommandCatalog(raw: unknown): ParseCatalogResult {
  let value: unknown = raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: 'Empty output from `commands list --json`.' };
    }
    try {
      value = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'Output of `commands list --json` is not valid JSON.' };
    }
  }

  const parsed = catalogEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: `commands.list payload does not match the contract: ${parsed.error.message}`,
    };
  }

  const envelope = parsed.data;
  if (!envelope.ok) {
    return {
      ok: false,
      error: `[${envelope.error.code}] ${envelope.error.message}`,
    };
  }

  // Stable, diff-friendly order regardless of CLI ordering changes.
  const entries = [...envelope.data].sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, entries, warnings: envelope.warnings };
}
