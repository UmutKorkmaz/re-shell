import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { runDevCluster } from '../commands/dev-cluster';

/**
 * Default changed-file source for affected-scoping: git working-tree changes
 * vs HEAD plus untracked files, as paths relative to the workspace root.
 * Returns [] (rather than throwing) when git is unavailable so affected-scoping
 * degrades to a full-workspace run instead of failing.
 */
async function gitChangedFiles(root: string): Promise<string[]> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(execFile);
  const collect = async (args: string[]): Promise<string[]> => {
    try {
      const { stdout } = await run('git', args, {
        cwd: root,
        maxBuffer: 1 << 24,
      });
      return stdout.split('\n').map(s => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  };
  const [tracked, untracked] = await Promise.all([
    collect(['diff', '--name-only', 'HEAD']),
    collect(['ls-files', '--others', '--exclude-standard']),
  ]);
  return [...new Set([...tracked, ...untracked])];
}

/**
 * `re-shell dev` — the local development runtime.
 *
 * With `--cluster`, generates a Skaffold inner-loop config from the workspace
 * graph and drives build-watch + in-cluster file-sync + multiplexed logs. The
 * config generation and affected-scoping are pure/offline; only an actual run
 * touches a cluster. `--dry-run` (with `--json`) emits the generated config +
 * plan WITHOUT contacting a cluster, so it is safe in CI.
 */
export function registerDevGroup(program: Command): void {
  program
    .command('dev')
    .description('Local development runtime (use --cluster for the k8s inner loop)')
    .option('--cluster', 'Run the Skaffold-backed Kubernetes inner-loop dev runtime')
    .option('--dry-run', 'Generate the config + plan without touching a cluster')
    .option('--namespace <ns>', 'Target Kubernetes namespace')
    .option('--filter <svc...>', 'Restrict to specific service name(s)')
    .option('--json', 'Output the config + plan as a JSON envelope')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.cluster) {
          // The non-cluster dev runtime is provided by the existing tools group
          // (`re-shell tools dev`). Steer the user there rather than no-op.
          process.stderr.write(
            'dev: pass --cluster for the Kubernetes inner loop, ' +
              'or use `re-shell tools dev` for config hot-reloading.\n'
          );
          process.exitCode = 1;
          return;
        }
        await runDevCluster({
          cluster: true,
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json),
          namespace: options.namespace,
          filter: options.filter,
          getChangedFiles: gitChangedFiles,
        });
      })
    );
}
