import { z } from 'zod';
import { workspaceSummarySchema, healthSummarySchema } from '@re-shell/contracts';
import { runJsonCommand, type CliInvocation } from './cli.js';

/**
 * A registered MCP Resource: a stable `reshell://` URI the host can read (and,
 * via the SDK's listChanged capability, be notified about on update) to keep
 * live, read-only workspace context across an agent session. Each resource maps
 * to a fixed, allow-listed re-shell CLI `--json` command, so a resource read is
 * always a single schema-validated envelope — no shell, no arbitrary command.
 */
export interface ResourceDefinition {
  /** Stable resource URI, e.g. `reshell://workspace/graph`. */
  readonly uri: string;
  /** Short stable name (no scheme). */
  readonly name: string;
  /** Human description. */
  readonly description: string;
  /** MIME type of the resource text. */
  readonly mimeType: string;
  /** Run the backing CLI command and return the resource text. */
  readonly read: (invocation: CliInvocation) => Promise<string>;
}

/**
 * Run a read-only CLI command and return its validated envelope as pretty JSON
 * text (the canonical wire shape the host renders). Any failure degrades to a
 * short error note so a resource read never throws across the transport.
 */
async function readAsJsonText(
  invocation: CliInvocation,
  args: readonly string[],
  dataSchema: z.ZodTypeAny
): Promise<string> {
  try {
    const { envelope } = await runJsonCommand(invocation, args, dataSchema);
    return JSON.stringify(envelope, null, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: { code: 'MCP_RESOURCE_ERROR', message } }, null, 2);
  }
}

/**
 * The read-only resource set. Each entry mirrors an allow-listed command (the
 * same registry the dashboard hub uses). Data schemas use `z.unknown()` where no
 * precise shape is published; the envelope (`ok`/`warnings`/`error`) is still
 * fully type-checked.
 */
export const RESOURCES: readonly ResourceDefinition[] = [
  {
    uri: 'reshell://workspace/summary',
    name: 'workspace-summary',
    description: 'Workspace summary: root, package manager, workspaces, graph, health.',
    mimeType: 'application/json',
    read: invocation =>
      readAsJsonText(invocation, ['workspace', 'summary', '--json'], workspaceSummarySchema),
  },
  {
    uri: 'reshell://workspace/graph',
    name: 'workspace-graph',
    description: 'Dependency graph across apps and services (live, read-only).',
    mimeType: 'application/json',
    read: invocation =>
      readAsJsonText(invocation, ['workspace', 'graph', '--json'], z.unknown()),
  },
  {
    uri: 'reshell://workspace/health',
    name: 'workspace-health',
    description: 'Workspace health checks and diagnostics.',
    mimeType: 'application/json',
    read: invocation =>
      readAsJsonText(invocation, ['workspace', 'health', '--json'], healthSummarySchema),
  },
  {
    uri: 'reshell://scorecard',
    name: 'production-readiness-scorecard',
    description:
      'Weighted production-readiness scorecard: per-service grades, dependency-drift entry count, and policy-pack score.',
    mimeType: 'application/json',
    read: invocation =>
      readAsJsonText(invocation, ['scorecard', '--json'], z.unknown()),
  },
  {
    uri: 'reshell://contracts/commands',
    name: 'command-catalog',
    description: 'Machine-readable catalog of re-shell commands (the CLI contract surface).',
    mimeType: 'application/json',
    read: invocation =>
      readAsJsonText(invocation, ['commands', 'list', '--json'], z.unknown()),
  },
];
