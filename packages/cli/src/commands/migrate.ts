// `re-shell migrate <to-version>` — version-scoped migration/codemod command.
//
// Orchestrates the migration engine to select recipes, resolve candidate targets
// in topological order (deps before dependents), and either list them for review
// (the safe dry-run default) or apply them with `.bak` backups. Source transforms
// degrade to `skipped` when ast-grep is not installed (never a hard failure).

import * as path from 'path';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import {
  getRecipes,
  selectPendingMigrations,
  planMigrations,
  topoSort,
  LATEST_TARGET_VERSION,
  type MigrationDescriptorLite,
  type RecipeCandidateTargets,
} from '../utils/migrate-engine';
import {
  resolveCandidateTargets,
  applyRecipeToFile,
  type PackageDir,
  type AstGrepRunner,
  defaultAstGrepRunner,
} from '../utils/migrate-runner';
import { discoverWorkspace } from '../utils/task-runner';

/** Candidate filenames for the workspace config, in discovery order. */
const CONFIG_CANDIDATES = ['re-shell.workspaces.yaml', 're-shell.workspaces.yml'];

/**
 * Options accepted by the `migrate` command.
 *
 * Governs the version-scoped migration/codemod flow: which target version to
 * migrate toward, whether to actually write changes (or just print the plan),
 * and which packages are in scope. Test-only fields allow injecting a working
 * directory and a custom ast-grep runner.
 */
export interface MigrateCommandOptions {
  /** When true, emit machine-readable JSON envelopes instead of human-friendly output. */
  json?: boolean;
  /** Target version to migrate toward (defaults to `LATEST_TARGET_VERSION`). */
  toVersion?: string;
  /** When `true`, apply the migrations to disk; when `false`/unset, only list the plan. */
  noDryRun?: boolean;
  /** Optional package filter: a comma-separated list of package names to scope the run. */
  filter?: string;
  /** Working directory override, primarily used by tests to point at a fixture workspace. */
  cwd?: string;
  /** Inject a custom ast-grep runner, primarily used by tests to stub source transforms. */
  runner?: AstGrepRunner;
}

/** Resolve the workspace config path under `cwd`, or undefined if absent. */
function resolveConfigPath(cwd: string): string | undefined {
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.join(cwd, candidate);
    if (require('fs').existsSync(full)) return full;
  }
  return undefined;
}

/** Read the current workspace version from the config, or null if missing. */
function readWorkspaceVersion(configPath: string): string | null {
  const fs = require('fs');
  const yaml = require('js-yaml');
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const doc = yaml.load(content);
    if (doc && typeof doc === 'object' && doc.version !== undefined && doc.version !== null) {
      // js-yaml parses an unquoted `version: 1.0` as the number 1; coerce to a
      // string so the downstream semver range check sees a usable version.
      return String(doc.version);
    }
  } catch {}
  return null;
}

/** Check if a filter name matches a discovered package (exact match or subdir). */
function matchesFilter(name: string, pkgName: string): boolean {
  return name === pkgName || pkgName.startsWith(`${name}/`);
}

/** Map a pure descriptor to the wire MigrationDescriptor shape. */
function toWireDescriptor(lite: MigrationDescriptorLite) {
  return {
    id: lite.id,
    fromVersion: lite.fromVersion,
    toVersion: lite.toVersion,
    kind: lite.kind,
    title: lite.title,
    description: lite.description,
    targets: [...lite.targets],
    status: lite.status,
    applied: lite.applied,
  };
}

/**
 * `re-shell migrate [<to-version>]` — version-scoped migration/codemod.
 *
 * Selects recipes whose `fromVersionRange` matches the current workspace version
 * and whose `toVersion` is at or below the requested target, resolves their
 * concrete target files in dependency-graph (topological) order, and either lists
 * them for review (dry-run, the safe default) or applies them — rewriting each
 * outdated config/YAML scaffold to the new schema after writing a `.bak` backup.
 *
 * Source transforms (ast-grep) degrade to `skipped` when ast-grep is not installed.
 * Computing the plan is pure data and never touches disk or the network.
 *
 * The function never throws for expected failure modes: workspace config missing,
 * no applicable recipes, partial applies, or failed recipes are all surfaced via
 * the chosen output channel (JSON envelope or human-readable text) and, where
 * appropriate, a non-zero `process.exitCode`. The only callers that should see
 * a rejection are unexpected internal errors.
 *
 * @param options - Command options (target version, dry-run toggle, package filter, etc.).
 * @returns Resolves once the plan has been printed or all migrations have been
 *   applied. Inspect `process.exitCode` to detect a partially/fully failed apply.
 */
export async function runMigrate(options: MigrateCommandOptions): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const rootDir = path.resolve(cwd);
  const dryRun = !options.noDryRun;
  const runner = options.runner ?? defaultAstGrepRunner;

  const spinner = json
    ? null
    : createSpinner('Planning migrations…', undefined, { json });
  spinner?.start();

  try {
    // ── Discover workspace ───────────────────────────────────────────────────────
    const configPath = resolveConfigPath(rootDir);
    if (!configPath) {
      emitError(
        json,
        `No workspace config found (looked for ${CONFIG_CANDIDATES.join(', ')} in ${cwd}). ` +
          'Run `re-shell init` or create a re-shell.workspaces.yaml first.'
      );
      return;
    }

    const currentVersion = readWorkspaceVersion(configPath);
    // A config with no version field is implicitly v1 (the legacy schema), so a
    // missing version is treated as 1.0.0 — the earliest version the v1→v2
    // recipe's `1.x` range can satisfy.
    const fromVersion = currentVersion ?? '1.0.0';

    const toVersion = options.toVersion ?? LATEST_TARGET_VERSION;

    // ── Discover packages for topological ordering ────────────────────────────────
    let discovery;
    try {
      discovery = await discoverWorkspace(rootDir);
    } catch {
      discovery = { packages: new Map(), graph: new Map() };
    }

    // Convert discovery graph to the topoSort shape (Map<string, readonly string[]>).
    const graph = discovery.graph;
    const topoOrder = topoSort(graph);

    // Build PackageDir list in topological order (deps before dependents).
    const packagesTopo: PackageDir[] = [];
    const seen = new Set<string>();
    for (const name of topoOrder) {
      if (seen.has(name)) continue;
      const pkg = discovery.packages.get(name);
      if (pkg && typeof pkg === 'object' && 'dir' in pkg) {
        seen.add(name);
        packagesTopo.push({ name, dir: String(pkg.dir) });
      }
    }

    // Apply optional package filter.
    let packagesInScope = packagesTopo;
    if (options.filter) {
      const filters = options.filter.split(',').map(f => f.trim());
      const matched = new Set<string>();
      for (const pkg of packagesTopo) {
        for (const f of filters) {
          if (matchesFilter(f, pkg.name)) {
            matched.add(pkg.name);
            break;
          }
        }
      }
      packagesInScope = packagesTopo.filter(p => matched.has(p.name));
    }

    // ── Select pending recipes ───────────────────────────────────────────────────
    const allRecipes = getRecipes();
    const selected = selectPendingMigrations(allRecipes, fromVersion, toVersion);

    if (selected.length === 0) {
      const payload = {
        toVersion,
        dryRun,
        migrations: [],
        warnings: [`No migrations needed from ${fromVersion} to ${toVersion}.`],
      };
      if (json) {
        ok(payload);
      } else {
        process.stdout.write(chalk.cyan.bold('\n▶ migrate\n\n'));
        process.stdout.write(chalk.green(`✓ Workspace already at ${toVersion}\n\n`));
      }
      return;
    }

    // ── Resolve candidate targets for each recipe (in topological order) ───────────
    const candidateTargets: RecipeCandidateTargets[] = [];
    const warnings: string[] = [];

    for (const recipe of selected) {
      const resolved = resolveCandidateTargets(recipe, rootDir, packagesInScope);
      candidateTargets.push({ recipeId: recipe.id, targets: resolved.map(r => r.path) });
    }

    // ── Build the plan ───────────────────────────────────────────────────────────
    const plan = planMigrations(selected, fromVersion, toVersion, candidateTargets);

    // ── Apply (or list) ───────────────────────────────────────────────────────────
    if (dryRun) {
      const payload = {
        toVersion,
        dryRun: true,
        migrations: plan.migrations.map(toWireDescriptor),
        warnings: [...plan.warnings, ...warnings],
      };

      if (json) {
        ok(payload);
      } else {
        renderHuman(payload);
        process.stdout.write(
          chalk.yellow('\n  Dry run: use --no-dry-run to apply these migrations.\n\n')
        );
      }
      return;
    }

    // Apply phase: run each migration against its resolved targets.
    const applied: MigrationDescriptorLite[] = [];

    for (const recipe of selected) {
      const resolved = resolveCandidateTargets(recipe, rootDir, packagesInScope);
      const descriptor = plan.migrations.find(m => m.id === recipe.id);
      if (!descriptor) continue;

      // A recipe selected by the version window but resolving to ZERO target
      // files wrote nothing to disk — it must NOT be reported as 'applied'
      // (the schema contract: applied means "written to every resolved target").
      if (resolved.length === 0) {
        warnings.push(`recipe "${recipe.id}" resolved no targets; skipped`);
        applied.push({ ...descriptor, status: 'skipped', applied: false });
        continue;
      }

      let recipeStatus: 'applied' | 'skipped' | 'failed' = 'applied';
      const recipeWarnings: string[] = [];

      for (const target of resolved) {
        const result = await applyRecipeToFile(recipe, target.path, runner);
        if (result.outcome === 'failed') {
          recipeStatus = 'failed';
        }
        if (result.outcome === 'skipped' && recipeStatus === 'applied') {
          recipeStatus = 'skipped';
        }
        recipeWarnings.push(...result.warnings);
      }

      warnings.push(...recipeWarnings);
      applied.push({
        ...descriptor,
        status: recipeStatus,
        applied: recipeStatus === 'applied',
      });
    }

    // Surface a partial/failed apply explicitly: each rewritten file has a .bak
    // the user can restore from. A non-zero exit code (mirroring the scorecard
    // gate) ensures CI never treats a partially-applied migration as success.
    const appliedCount = applied.filter(m => m.status === 'applied').length;
    const failedCount = applied.filter(m => m.status === 'failed').length;
    const partial = appliedCount > 0 && (failedCount > 0 || applied.length > appliedCount + failedCount);
    if (appliedCount > 0) {
      warnings.push(
        `${appliedCount} migration(s) applied — each rewritten file has a .bak backup alongside it.`
      );
    }
    if (failedCount > 0 || partial) {
      warnings.push(
        `Migration incomplete: ${appliedCount} applied, ${failedCount} failed` +
          `${partial ? ', some skipped' : ''}. Restore rewritten files from their *.bak if needed.`
      );
    }

    const payload = {
      toVersion,
      dryRun: false,
      migrations: applied.map(toWireDescriptor),
      warnings,
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload);
    }

    // Gate: any non-applied recipe in the apply path is a failure condition.
    if (applied.some(m => m.status !== 'applied')) {
      process.exitCode = 1;
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit a MIGRATE_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('MIGRATE_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Human-readable render of the migration plan. */
function renderHuman(payload: {
  toVersion: string;
  dryRun: boolean;
  migrations: Array<{
    id: string;
    fromVersion: string;
    toVersion: string;
    kind: string;
    title: string;
    description: string;
    targets: string[];
    status: string;
    applied: boolean;
  }>;
  warnings: string[];
}): void {
  process.stdout.write(chalk.cyan.bold('\n▶ migrate\n\n'));

  for (const mig of payload.migrations) {
    const statusColour =
      mig.status === 'applied'
        ? chalk.green
        : mig.status === 'skipped'
          ? chalk.yellow
          : mig.status === 'failed'
            ? chalk.red
            : chalk.gray;
    process.stdout.write(
      `  ${statusColour(`[${mig.status.toUpperCase()}]`)} ${chalk.bold(mig.title)}\n`
    );
    process.stdout.write(`    ${mig.description}\n`);
    if (mig.targets.length > 0) {
      process.stdout.write(`    Targets: ${mig.targets.length} file(s)\n`);
    }
    process.stdout.write('\n');
  }

  if (payload.warnings.length > 0) {
    for (const warning of payload.warnings) {
      process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
    }
    process.stdout.write('\n');
  }
}
