import { z } from 'zod';
import { formatCommand } from 're-shell-ui';

/**
 * Web-side zod schema + helpers for the `re-shell commands list --json` feed
 * (see `buildCommandCatalog` in the CLI). The hub forwards the catalog verbatim;
 * the Command Builder generates its entire form from this — there is no
 * hardcoded command list in the UI.
 *
 * Defaults keep a slightly-sparse entry from failing the whole feed while still
 * failing fast on a genuinely malformed catalog.
 */

export const catalogArgSchema = z.object({
  name: z.string(),
  required: z.boolean().default(false),
});
export type CatalogArg = z.infer<typeof catalogArgSchema>;

export const catalogFlagSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  default: z.unknown().optional(),
  takesValue: z.boolean().default(false),
});
export type CatalogFlag = z.infer<typeof catalogFlagSchema>;

export const commandCatalogEntrySchema = z.object({
  path: z.string(),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(''),
  args: z.array(catalogArgSchema).default([]),
  flags: z.array(catalogFlagSchema).default([]),
  supportsJson: z.boolean().default(false),
  supportsDryRun: z.boolean().default(false),
  destructive: z.boolean().default(false),
});
export type CommandCatalogEntry = z.infer<typeof commandCatalogEntrySchema>;

export const commandCatalogSchema = z.array(commandCatalogEntrySchema);
export type CommandCatalog = z.infer<typeof commandCatalogSchema>;

/**
 * The runtime form state for one in-progress command build: the positional arg
 * values (by name, preserving the catalog's declared order) and the flag values
 * (by flag name — string for value flags, boolean for switches).
 */
export interface CommandFormState {
  args: Record<string, string>;
  flags: Record<string, string | boolean>;
}

/** Flag names the builder owns explicitly (rendered as dedicated toggles). */
export const JSON_FLAG = '--json';
export const DRY_RUN_FLAG = '--dry-run';

/**
 * Assemble the full argv for a catalog entry from the current form state,
 * preserving the catalog's declared order: `re-shell <path…> <args…> <flags…>`.
 *
 * Positional args keep their declared order; only non-empty values are emitted.
 * Flags keep their declared order; value flags emit `--flag value`, switches
 * emit a bare `--flag` when truthy. The `--json` and `--dry-run` toggles are
 * threaded in via the same flag map so order stays faithful to the catalog.
 */
export function buildCommandArgv(
  entry: CommandCatalogEntry,
  state: CommandFormState
): string[] {
  const argv: string[] = ['re-shell', ...entry.path.split(' ').filter(Boolean)];

  for (const arg of entry.args) {
    const value = state.args[arg.name]?.trim();
    if (value) {
      argv.push(value);
    }
  }

  for (const flag of entry.flags) {
    const value = state.flags[flag.name];
    if (flag.takesValue) {
      const text = typeof value === 'string' ? value.trim() : '';
      if (text) {
        argv.push(flag.name, text);
      }
    } else if (value === true) {
      argv.push(flag.name);
    }
  }

  return argv;
}

/** The full assembled, shell-quoted command string for preview + copy. */
export function buildCommandText(
  entry: CommandCatalogEntry,
  state: CommandFormState
): string {
  return formatCommand(buildCommandArgv(entry, state));
}

/**
 * The hub `run` allow-list resolves a FIXED set of subcommand paths only (see
 * the hub command registry). The Command Builder can execute through the hub
 * only when the picked command path is one of these AND no positional args /
 * value flags are required beyond the implicit `--json` the hub appends. Any
 * other command is preview/copy-only (run it in a terminal).
 */
export const HUB_RUNNABLE_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'workspace summary',
  'workspace graph',
  'workspace health',
  'workspace list',
  'workspace validate',
  'templates list',
  'commands list',
  'doctor',
  'analyze',
]);

/** True when this command path can be executed through the hub `run` allow-list. */
export function isHubRunnable(entry: CommandCatalogEntry): boolean {
  return HUB_RUNNABLE_SUBCOMMANDS.has(entry.path);
}
