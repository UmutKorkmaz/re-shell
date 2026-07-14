import * as path from 'path';
import chalk from 'chalk';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import { WorkspaceParser } from '../parsers/workspace-parser';
import {
  generateDevClusterConfig,
  resolveAffectedServices,
  buildServiceGraph,
  DEFAULT_DEV_NAMESPACE,
  SkaffoldDevBackend,
  MissingToolError,
  type NamedService,
  type DevBackend,
} from '../utils/dev-cluster';
import type {
  DevClusterConfig,
  DevClusterPlan,
  DevClusterResponse,
} from '@re-shell/contracts';

/** Candidate filenames for a workspace v2 config, in discovery order. */
const CONFIG_CANDIDATES = [
  're-shell.workspaces.yaml',
  're-shell.workspaces.yml',
  'workspace.yaml',
  'workspace.yml',
];

/**
 * Options accepted by the `dev --cluster` command.
 *
 * Controls both the offline core (config generation + affected scoping) and
 * the live inner-loop driven by the configured backend.
 */
export interface DevClusterCommandOptions {
  /** Whether the cluster dev loop is enabled (gating flag from the CLI). */
  cluster?: boolean;
  /** When true, emit the generated config + plan without touching a cluster. */
  dryRun?: boolean;
  /** When true, emit machine-readable JSON envelopes instead of human text. */
  json?: boolean;
  /** Kubernetes namespace to deploy into (defaults to {@link DEFAULT_DEV_NAMESPACE}). */
  namespace?: string;
  /**
   * Restrict to specific service name(s) (repeatable / CSV).
   * Each named service's transitive upstream dependencies are included
   * automatically so the generated config stays self-consistent.
   */
  filter?: string[];
  /** Working directory override (tests). */
  cwd?: string;
  /** Explicit config path (tests). */
  configPath?: string;
  /** Injected backend (tests substitute a fake). */
  backend?: DevBackend;
  /** Injected changed-file source for affected scoping (tests). */
  getChangedFiles?: (root: string) => Promise<string[]>;
}

/** Resolve the workspace v2 config path under `cwd`. */
function resolveConfigPath(cwd: string, explicit?: string): string | undefined {
  // fs is required lazily so the offline path stays light.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  if (explicit) return fs.existsSync(explicit) ? explicit : undefined;
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.join(cwd, candidate);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

/** Load + validate the workspace, returning its named services. */
function loadServices(configPath: string): NamedService[] {
  const parser = new WorkspaceParser();
  const parsed = parser.parse(configPath);
  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid workspace config: ${detail || 'unknown error'}`);
  }
  const services = parsed.config.services ?? {};
  return Object.keys(services).map(name => ({
    name,
    config: services[name],
  }));
}

/**
 * Expand a set of explicitly requested service names to include all their
 * transitive upstream dependencies so the generated config is self-consistent:
 * if service A's Dockerfile `FROM`s an image built by service B, B must be in
 * scope or the build will fail.
 *
 * The dependency graph is `dependsOn` edges (A depends on B means B must run
 * first / be built first). We walk those edges transitively.
 */
function expandWithDependencies(
  requested: readonly string[],
  allServices: readonly NamedService[]
): string[] {
  const graph = buildServiceGraph(allServices);
  const included = new Set<string>();
  const stack = [...requested];
  while (stack.length > 0) {
    const name = stack.pop()!;
    if (included.has(name)) continue;
    included.add(name);
    // Push all dependencies of this service so they are also included.
    for (const dep of graph.get(name) ?? []) {
      if (!included.has(dep)) stack.push(dep);
    }
  }
  // Return in the original allServices order for determinism.
  return allServices.map(s => s.name).filter(n => included.has(n));
}

/** Normalise a repeatable/CSV `--filter` option into a flat string list. */
function parseFilter(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  const out = list
    .flatMap(v => String(v).split(','))
    .map(s => s.trim())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

/**
 * Emit a DEV_CLUSTER_ERROR in JSON mode, or a red message + non-zero exit
 * otherwise. Centralised so both paths stay consistent.
 */
function emitError(
  json: boolean,
  message: string,
  details?: Record<string, unknown>
): void {
  if (json) {
    fail('DEV_CLUSTER_ERROR', message, details);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/**
 * `re-shell dev --cluster` — generate a Skaffold inner-loop config from the
 * workspace graph and (unless `--dry-run`) drive the dev loop via the backend.
 *
 * The offline core (config generation + affected scoping) never touches a
 * cluster. `--dry-run --json` emits the generated config + plan and returns.
 * A real run requires skaffold/kubectl + a live cluster, surfaced through the
 * injectable {@link DevBackend} so this function stays testable without one.
 *
 * @param options - Command options controlling scoping, output format, and the backend.
 * @returns Resolves when the dev loop has finished (or the dry-run plan has been emitted).
 *          Errors are surfaced via {@link emitError} rather than thrown, except for
 *          unexpected failures which reject the promise.
 */
export async function runDevCluster(
  options: DevClusterCommandOptions
): Promise<void> {
  const json = Boolean(options.json);
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const cwd = options.cwd ?? process.cwd();
    const configPath = resolveConfigPath(cwd, options.configPath);
    if (!configPath) {
      emitError(
        json,
        `No workspace v2 config found (looked for ${CONFIG_CANDIDATES.join(', ')} in ${cwd})`
      );
      return;
    }

    let allServices: NamedService[];
    try {
      allServices = loadServices(configPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      emitError(json, message);
      return;
    }

    if (allServices.length === 0) {
      emitError(json, 'Workspace config defines no services to run');
      return;
    }

    const filter = parseFilter(options.filter);
    const namespace = options.namespace ?? DEFAULT_DEV_NAMESPACE;

    // ── Scope the services ────────────────────────────────────────────────
    // --filter is an explicit allowlist that is automatically expanded to
    // include each named service's transitive upstream dependencies so the
    // generated config is self-consistent (images that FROM an upstream service
    // require that upstream to be in scope). The plan records `affected` as the
    // original --filter names; `services` reflects the full expanded set.
    let scoped = allServices;
    let affected: string[] | undefined;
    if (filter && filter.length > 0) {
      const known = new Set(allServices.map(s => s.name));
      const unknown = filter.filter(n => !known.has(n));
      if (unknown.length > 0) {
        emitError(
          json,
          `Unknown service(s) in --filter: ${unknown.join(', ')}`,
          { unknown }
        );
        return;
      }
      // Expand to include transitive dependencies so the config is buildable.
      const expandedNames = expandWithDependencies(filter, allServices);
      const allow = new Set(expandedNames);
      scoped = allServices.filter(s => allow.has(s.name));
      affected = [...filter];
    } else if (options.getChangedFiles) {
      // Affected-scoping path: derive the changed set from the injected source
      // (git in the real command), then keep only affected services. Falls back
      // to the full workspace when nothing is detected.
      const changed = await options.getChangedFiles(path.resolve(cwd));
      const affectedNames = resolveAffectedServices(allServices, changed);
      if (affectedNames.length > 0) {
        const allow = new Set(affectedNames);
        scoped = allServices.filter(s => allow.has(s.name));
        affected = affectedNames;
      }
    }

    const config: DevClusterConfig = generateDevClusterConfig({
      services: scoped,
      namespace,
    });

    const plan: DevClusterPlan = {
      services: scoped.map(s => s.name),
      ...(affected ? { affected } : {}),
      dryRun: Boolean(options.dryRun),
    };

    // ── Dry-run: emit/print the config + plan and stop (no cluster) ────────
    if (options.dryRun) {
      if (json) {
        const payload: DevClusterResponse = { config, plan };
        ok(payload);
      } else {
        renderHuman(config, plan);
      }
      return;
    }

    // ── Real run: drive the inner loop via the backend ────────────────────
    const backend = options.backend ?? new SkaffoldDevBackend();
    try {
      await backend.dev({
        config,
        namespace,
        services: scoped.map(s => s.name),
      });
    } catch (error) {
      if (error instanceof MissingToolError) {
        emitError(json, error.message, { tool: error.tool });
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      emitError(json, `dev --cluster failed: ${message}`);
      return;
    }
  } finally {
    restoreJson();
  }
}

/** Human-readable render of the generated config + plan (non-JSON path). */
function renderHuman(config: DevClusterConfig, plan: DevClusterPlan): void {
  process.stdout.write(
    chalk.cyan.bold(
      `\n▶ dev --cluster (namespace ${config.namespace})${plan.dryRun ? chalk.gray(' [dry-run]') : ''}\n\n`
    )
  );
  if (config.artifacts.length === 0) {
    process.stdout.write(chalk.yellow('No services in scope.\n'));
    return;
  }
  for (const artifact of config.artifacts) {
    const pf = config.portForwards.find(p => p.service === artifact.service);
    const forward = pf
      ? chalk.gray(` → localhost:${pf.localPort}`)
      : '';
    process.stdout.write(
      `  ${chalk.green('●')} ${chalk.bold(artifact.service)} ${chalk.gray(
        `(${artifact.context})`
      )}${forward}\n`
    );
  }
  if (plan.affected) {
    process.stdout.write(
      `\n  ${chalk.gray(`scoped to affected: ${plan.affected.join(', ')}`)}\n`
    );
  }
  process.stdout.write('\n');
}
