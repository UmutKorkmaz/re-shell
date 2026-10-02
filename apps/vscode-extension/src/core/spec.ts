import { commandSpecSchema, type CommandSpec } from '@re-shell/contracts';
import type { CatalogEntry } from './catalog.js';
import { buildCommand, pathToSegments, type CommandParams } from './command-builder.js';
import { toHubRunRequest, type HubRunRequest } from './hub-client.js';

/**
 * PURE module. No VS Code, no Node side effects.
 *
 * Builds the {@link CommandSpec} (the shared `@re-shell/contracts` description of
 * "a command about to be run": id, title, argv, cwd and the dry-run /
 * destructive / confirmation flags) for a catalog entry. The spec is what the
 * editor shows the user before anything executes, and what the hub run is
 * derived from, so the echoed argv and the executed argv cannot diverge.
 */

export type { CommandSpec };

/** The logical binary name recorded in a spec's `command[0]`. */
export const SPEC_BINARY = 're-shell';

export type BuildSpecResult =
  | { ok: true; spec: CommandSpec; commandText: string }
  | { ok: false; error: string };

/** Stable id for a catalog path: `workspace health` -> `workspace.health`. */
export function specIdForPath(path: string): string {
  return pathToSegments(path).join('.');
}

/**
 * Build a validated {@link CommandSpec} from a catalog entry plus user params.
 * argv assembly (and its value sanitization) is delegated to {@link buildCommand}
 * so a rejected value fails the whole build; the result is then re-validated
 * against the contract so a malformed spec can never leave this function.
 */
export function buildCommandSpec(
  entry: CatalogEntry,
  params: CommandParams,
  cwd: string
): BuildSpecResult {
  const built = buildCommand(entry, params);
  if (!built.ok) {
    return built;
  }
  return finalizeSpec(entry, [SPEC_BINARY, ...built.argv], cwd);
}

function finalizeSpec(entry: CatalogEntry, command: string[], cwd: string): BuildSpecResult {
  const parsed = commandSpecSchema.safeParse({
    id: specIdForPath(entry.path),
    title: entry.path,
    description: entry.description,
    command,
    cwd,
    dryRunSupported: entry.supportsDryRun,
    destructive: entry.destructive,
    requiresConfirmation: entry.destructive,
  });
  if (!parsed.success) {
    return { ok: false, error: `Built spec violates the CommandSpec contract: ${parsed.error.message}` };
  }
  return { ok: true, spec: parsed.data, commandText: command.join(' ') };
}

/** A spec that will run through the hub, plus the exact request to send. */
export type HubSpecResult =
  | { ok: true; spec: CommandSpec; commandText: string; request: Extract<HubRunRequest, { ok: true }> }
  | { ok: false; error: string };

/**
 * Build the spec for running `entry` through the hub's allow-listed `run`
 * command. The hub resolves `{ commandId: 'run', params: { subcommand, cwd } }`
 * to the fixed argv `<path segments> --json`; it cannot forward extra args or
 * flags. The spec therefore records exactly that argv (so what is shown is what
 * runs), and an entry that is not on the allow-list is rejected up front rather
 * than sent to be refused.
 */
export function buildHubRunSpec(entry: CatalogEntry, cwd: string): HubSpecResult {
  const request = toHubRunRequest(entry, cwd);
  if (!request.ok) {
    return request;
  }
  const built = finalizeSpec(entry, [SPEC_BINARY, ...pathToSegments(entry.path), '--json'], cwd);
  if (!built.ok) {
    return built;
  }
  return { ...built, request };
}

/**
 * True when running `argv` (a spec's argv WITHOUT the binary) through the hub
 * loses nothing: the hub `run` command takes no args or flags, so it is a
 * faithful execution only for the bare catalog path (optionally with `--json`,
 * which the hub always appends).
 */
export function isBareInvocation(entry: CatalogEntry, argv: readonly string[]): boolean {
  const base = pathToSegments(entry.path);
  const extra = argv.slice(base.length).filter((token) => token !== '--json');
  return base.every((segment, i) => argv[i] === segment) && extra.length === 0;
}
