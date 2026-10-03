import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../utils/error-handler';
import { runWorkspaceGraphDiff } from '../commands/workspace-graph-diff';
import { runWorkspaceStatus } from '../commands/workspace-status';

/**
 * P9-L: graph explorer commands layered on the `workspace` group.
 *
 *  - `workspace graph diff --base <ref|file.json> [--head <ref|file.json>] [--json] [--format mermaid]`
 *  - `workspace status [--json]`
 *  - `workspace explore` (interactive terminal graph explorer; also `workspace graph --interactive`)
 */
export function registerWorkspaceGraphExtensions(workspace: Command, graphCommand: Command): void {
  graphCommand
    .command('diff')
    .description('Diff the workspace dependency graph between a base and a head (git refs, graph JSON files, or the working tree)')
    .requiredOption('--base <git-ref|file.json>', 'Base graph: a git ref (branch, tag, sha, HEAD~1) or a saved graph .json file')
    .option('--head <git-ref|file.json>', 'Head graph (default: the working tree)')
    .option('--json', 'Emit machine-readable JSON envelope to stdout')
    .option('--format <format>', 'Output format: text, json or mermaid', 'text')
    .option('--output <file>', 'Write the report to a file instead of stdout')
    .action(
      createAsyncCommand(async (_options: Record<string, unknown>, command: Command) => {
        // The parent `graph` command declares --json/--format/--output too, so
        // commander may attach them there; read the merged view.
        const o = command.optsWithGlobals() as {
          base: string;
          head?: string;
          json?: boolean;
          format?: string;
          output?: string;
        };
        await withTimeout(async () => {
          await runWorkspaceGraphDiff({
            base: o.base,
            head: o.head,
            json: o.json,
            format: o.format,
            output: o.output,
          });
        }, 120000);
      })
    );

  workspace
    .command('status')
    .description('Live status per workspace: running, stopped, unhealthy or unknown, with the reason')
    .option('--json', 'Emit machine-readable JSON envelope to stdout')
    .option('--allow-remote-probes', 'Also probe health URLs whose host is not loopback')
    .action(
      createAsyncCommand(async options => {
        await withTimeout(async () => {
          await runWorkspaceStatus({ json: options.json, allowRemoteProbes: options.allowRemoteProbes });
        }, 60000);
      })
    );

  workspace
    .command('explore')
    .description('Interactive terminal workspace graph explorer: search, focus, dependency paths, live refresh (TTY only)')
    .option('--status-interval <ms>', 'Live status poll interval in milliseconds (0 disables)', '5000')
    .option('--no-watch', 'Do not watch workspace files for changes')
    .option('--no-status', 'Skip live status collection')
    .action(
      createAsyncCommand(async options => {
        const { launchGraphExplorerCommand } = await import('../commands/graph-explore');
        const interval = Number(options.statusInterval);
        if (!Number.isFinite(interval) || interval < 0) {
          console.error(`Error: invalid --status-interval "${options.statusInterval}": expected a non-negative number of milliseconds.`);
          process.exitCode = 1;
          return;
        }
        await launchGraphExplorerCommand({
          statusIntervalMs: interval,
          watch: options.watch !== false,
          status: options.status !== false,
        });
      })
    );
}
