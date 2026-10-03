import { Command } from 'commander';
import chalk from 'chalk';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode, ok as jsonOk, fail as jsonFail, fail } from '../utils/json-output';
import { runDevCluster } from '../commands/dev-cluster';
import { runRestartPlan } from '../commands/dev-restart-plan';
import {
  DevProfileError,
  applyProfileEnvironment,
  manageDevMode,
  resolveDevProfile,
  type ResolvedDevProfile,
} from '../commands/dev-mode';

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
 *
 * With `--profile <name>` the named configuration profile (`re-shell config
 * profile ...`, including `extends` inheritance and overrides) is resolved and
 * its environment applied to whichever dev runtime runs; an unknown profile is
 * a hard error. Without `--cluster`/`--restart-plan`, `--profile` starts the
 * config hot-reload runtime under that profile (`--dry-run` just prints what
 * would be applied).
 */
export function registerDevGroup(program: Command): void {
  program
    .command('dev')
    .description('Local development runtime (use --cluster for the k8s inner loop, --restart-plan for graph-aware propagation)')
    .option('--cluster', 'Run the Skaffold-backed Kubernetes inner-loop dev runtime')
    .option('--dry-run', 'Generate the config + plan without touching a cluster')
    .option('--namespace <ns>', 'Target Kubernetes namespace')
    .option('--filter <svc...>', 'Restrict to specific service name(s)')
    .option('--json', 'Output the config + plan as a JSON envelope')
    .option('--restart-plan', 'Resolve and print the graph-aware restart plan (changed → ordered dependents) without restarting')
    .option('--changed <pkgs...>', 'Explicit changed package names for --restart-plan (overrides git detection)')
    .option(
      '--profile <name>',
      'Apply a configuration profile (inheritance + overrides resolved; see `re-shell config profile list`) to the dev runtime'
    )
    .action(
      createAsyncCommand(async (options) => {
        // Resolve the profile first: an unknown profile must fail before any
        // runtime starts or any environment is touched.
        let profile: ResolvedDevProfile | undefined;
        if (options.profile) {
          try {
            profile = await resolveDevProfile(options.profile);
          } catch (error) {
            if (options.json && error instanceof DevProfileError) {
              const restore = enableJsonMode();
              try {
                jsonFail(error.code, error.message, error.details);
              } finally {
                restore();
              }
              return;
            }
            throw error;
          }
        }

        // `--profile --dry-run` without a runtime flag: report what would be applied.
        if (profile && options.dryRun && !options.cluster && !options.restartPlan) {
          printProfilePlan(profile, Boolean(options.json));
          return;
        }

        // Graph-aware restart plan: pure/offline, never restarts. Short-circuit
        // before the cluster path so it is safe and fast.
        if (options.restartPlan) {
          if (profile) applyProfileEnvironment(profile.env);
          await runRestartPlan({
            json: Boolean(options.json),
            changed: options.changed,
            getChangedFiles: options.changed ? undefined : gitChangedFiles,
          });
          return;
        }
        if (!options.cluster) {
          if (profile) {
            // The non-cluster runtime is the config hot-reload dev mode; start
            // it under the requested profile (manageDevMode applies its env).
            const services: string[] | undefined = options.filter
              ? options.filter.flat()
              : profile.services.length > 0
                ? profile.services
                : undefined;
            await manageDevMode({ start: true, profile: profile.name, services });
            return;
          }
          // The non-cluster dev runtime is provided by the existing tools group
          // (`re-shell tools dev`). Steer the user there rather than no-op.
          const usage =
            'dev: pass --cluster for the Kubernetes inner loop, ' +
            'or use `re-shell tools dev` for config hot-reloading.';
          if (options.json) {
            fail('USAGE_ERROR', usage);
            return;
          }
          process.stderr.write(`${usage}\n`);
          process.exitCode = 1;
          return;
        }
        if (profile) applyProfileEnvironment(profile.env);
        await runDevCluster({
          cluster: true,
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json),
          namespace: options.namespace,
          // An explicit --filter wins; otherwise the profile's services scope the run.
          filter:
            options.filter ?? (profile && profile.services.length > 0 ? profile.services : undefined),
          getChangedFiles: gitChangedFiles,
        });
      })
    );
}

/** Print (or emit as a JSON envelope) what `dev --profile <name>` would apply. */
function printProfilePlan(resolved: ResolvedDevProfile, json: boolean): void {
  const { profile } = resolved;
  const data = {
    profile: resolved.name,
    environment: profile.environment,
    framework: profile.framework,
    description: profile.description,
    extends: profile.extends ?? [],
    env: resolved.env,
    services: resolved.services,
    config: profile.config,
  };

  if (json) {
    const restore = enableJsonMode();
    try {
      jsonOk(data);
    } finally {
      restore();
    }
    return;
  }

  console.log(chalk.cyan.bold(`\nProfile: ${resolved.name}`));
  console.log(chalk.gray(`Environment: ${profile.environment}`));
  if (profile.extends && profile.extends.length > 0) {
    console.log(chalk.gray(`Extends: ${profile.extends.join(', ')}`));
  }
  if (resolved.services.length > 0) {
    console.log(chalk.gray(`Services: ${resolved.services.join(', ')}`));
  }
  console.log(chalk.cyan('\nEnvironment that would be applied:'));
  for (const [key, value] of Object.entries(resolved.env)) {
    console.log(`  ${key}=${value}`);
  }
  console.log('');
}
