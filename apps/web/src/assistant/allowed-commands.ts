import type { AllowedCommand } from '@re-shell/ui';
import {
  listRegisteredCommands,
  type CommandId,
  type RegisteredCommandMeta,
} from '../hub/command-registry';

/**
 * The dashboard-side adapter between the hub command registry (the canonical
 * allow-list) and the offline assistant resolver.
 *
 * The allow-list the assistant matches against is DERIVED from
 * {@link listRegisteredCommands} — there is no second, hand-maintained list — so
 * it can never diverge from what the hub will actually run. We additionally
 * restrict to commands that resolve with no caller-supplied params, because a
 * natural-language query cannot reliably synthesise a required param (e.g. a
 * template id); those commands stay reachable through the dedicated screens.
 */

/**
 * A resolved assistant command: the registry metadata plus the exact argv the
 * hub will run (for transparent echoing in the CommandPreview / job header).
 */
export interface AssistantCommand extends RegisteredCommandMeta {
  /** Full display argv including the CLI binary, for the command preview. */
  readonly command: readonly string[];
}

/**
 * Curated intent keywords/synonyms per command id, layered on top of the
 * registry's own title/description. These improve recall for natural phrasing
 * ("is it healthy", "deps", "scaffold") without changing the displayed copy.
 * Keyed by the registry id, so an id that disappears from the registry simply
 * drops its (now-unused) hints — they can never introduce a non-allow-listed id.
 */
const INTENT_KEYWORDS: Partial<Record<CommandId, readonly string[]>> = {
  'workspace.health': ['healthy', 'health', 'status', 'diagnostics', 'doctor', 'ok', 'broken'],
  'workspace.summary': ['overview', 'summary', 'glance', 'state'],
  'workspace.graph': ['graph', 'deps', 'dependencies', 'dependency', 'topology', 'tree'],
  'templates.list': ['templates', 'template', 'scaffold', 'starter', 'frameworks', 'boilerplate'],
  scorecard: ['scorecard', 'readiness', 'grade', 'score', 'production-ready'],
  'commands.list': ['commands', 'catalog', 'available', 'list'],
  doctor: ['doctor', 'diagnose', 'checkup', 'fix', 'monorepo'],
  analyze: ['analyze', 'analysis', 'bundle', 'performance', 'security', 'audit', 'size'],
};

/**
 * Build the assistant allow-list (resolver-matchable) from the live registry.
 * Only no-param-runnable commands are included. Pure aside from reading the
 * static registry.
 */
export function buildAssistantCommands(): AssistantCommand[] {
  return listRegisteredCommands()
    .filter((meta) => meta.runnableWithoutParams)
    .map((meta) => ({
      ...meta,
      command: ['re-shell', ...meta.displayArgs],
    }));
}

/** Project the assistant commands down to the resolver's input shape. */
export function toResolverAllowList(commands: readonly AssistantCommand[]): AllowedCommand[] {
  return commands.map((cmd) => ({
    id: cmd.id,
    title: cmd.title,
    description: cmd.description,
    keywords: INTENT_KEYWORDS[cmd.id as CommandId] ?? [],
  }));
}
