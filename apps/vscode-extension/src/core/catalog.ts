import { z } from 'zod';
import { jsonResponseSchema } from '@re-shell/contracts';

/**
 * PURE module. No VS Code, no Node side effects.
 *
 * Parses the `re-shell commands list --json` payload into a validated catalog
 * the extension can render as a tree. The CLI emits the canonical envelope
 * ({ ok, data, warnings } | { ok:false, error, warnings }) from
 * @re-shell/contracts, so we validate against that exact shape and never
 * trust the raw stdout blob.
 */

/**
 * A single declared argument of a catalog command. Mirrors the CLI's
 * `CatalogArg` (src/utils/command-catalog.ts) but is authored here as a zod
 * schema so the extension validates the wire payload at runtime.
 */
export const catalogArgSchema = z.object({
  name: z.string(),
  required: z.boolean(),
});
export type CatalogArg = z.infer<typeof catalogArgSchema>;

/**
 * A single declared flag/option of a catalog command. `takesValue` decides
 * whether a flag contributes a value token to the assembled argv.
 */
export const catalogFlagSchema = z.object({
  name: z.string(),
  description: z.string(),
  takesValue: z.boolean(),
  default: z.unknown().optional(),
});
export type CatalogFlag = z.infer<typeof catalogFlagSchema>;

/**
 * One runnable command in the catalog. Matches the CLI's
 * `CommandCatalogEntry`.
 */
export const catalogEntrySchema = z.object({
  path: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  args: z.array(catalogArgSchema),
  flags: z.array(catalogFlagSchema),
  supportsJson: z.boolean(),
  supportsDryRun: z.boolean(),
  destructive: z.boolean(),
});
export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

/**
 * The `data` payload of `commands list --json` is the array of catalog entries.
 */
export const catalogDataSchema = z.array(catalogEntrySchema);
export type CatalogData = z.infer<typeof catalogDataSchema>;

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
