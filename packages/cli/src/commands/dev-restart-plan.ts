// `re-shell dev --restart-plan` — graph-aware restart-plan resolver (issue #14).
//
// Wires the pure dev-fusion engine to a real CLI surface: discover the workspace,
// resolve the changed packages (explicit --changed, or git working-tree changes
// mapped to their owning packages), and emit the ordered restart plan (changed
// packages + transitive dependents, deps-before-dependents). The plan is the
// foundation the dev loop + Ink TUI consume to hot-restart only the right
// packages in the right order. Producing the plan is pure/offline.

import * as path from 'path';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { discoverWorkspace } from '../utils/task-runner';
import {
  resolveRestartTargets,
  type RestartTarget,
} from '../utils/dev-fusion-engine';

/** Options accepted by the restart-plan resolver. */
export interface RestartPlanOptions {
  json?: boolean;
  /** Explicitly changed package names (overrides git detection). */
  changed?: string[];
  /** Git-changed-files provider (tests). */
  getChangedFiles?: (root: string) => Promise<string[]>;
  /** Working directory override (tests). */
  cwd?: string;
}

/** Map a set of changed files to their owning package names (longest prefix). */
function filesToPackages(
  root: string,
  files: readonly string[],
  packages: ReadonlyMap<string, { dir: string }>
): string[] {
  const dirs = [...packages.entries()].map(([name, pkg]) => ({
    name,
    rel: path.relative(root, path.resolve(pkg.dir)) + path.sep,
  }));
  const owners = new Set<string>();
  for (const file of files) {
    const rel = file.split('/').join(path.sep);
    for (const d of dirs) {
      if (rel.startsWith(d.rel)) owners.add(d.name);
    }
  }
  return [...owners];
}

/**
 * Resolve and emit the ordered restart plan for the changed packages.
 *
 * Gate: this is a planning command — it never restarts anything, so it always
 * exits 0 on success. A genuine error (not in a workspace) is reported via the
 * DEV_FUSION_ERROR envelope.
 */
export async function runRestartPlan(options: RestartPlanOptions): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const rootDir = path.resolve(cwd);

  let discovery;
  try {
    discovery = await discoverWorkspace(rootDir);
  } catch (error) {
    emitError(json, messageOf(error));
    return;
  }

  const graph = discovery.graph;

  // Resolve the changed package names: explicit --changed wins; otherwise map
  // git working-tree changes to their owning packages.
  let changed: string[];
  if (options.changed && options.changed.length > 0) {
    changed = [...new Set(options.changed)];
  } else {
    const getFiles = options.getChangedFiles ?? (async () => []);
    const files = await getFiles(rootDir);
    changed = filesToPackages(rootDir, files, discovery.packages);
  }

  if (changed.length === 0) {
    const payload = { changed: [], ordered: [], affected: [], warnings: ['No changed packages detected; nothing to restart.'] };
    if (json) {
      ok(payload);
    } else {
      process.stdout.write(chalk.gray('\n  No changed packages detected; nothing to restart.\n\n'));
    }
    return;
  }

  const plan = resolveRestartTargets(graph, changed);
  const warnings: string[] = [];
  for (const seed of plan.unknownSeeds) {
    warnings.push(`changed package "${seed}" is not in the workspace graph; skipped`);
  }

  const payload = {
    changed,
    ordered: plan.ordered.map((t: RestartTarget) => ({
      name: t.name,
      reason: t.reason,
      depth: t.depth,
    })),
    affected: [...plan.affected],
    warnings,
  };

  if (json) {
    ok(payload);
  } else {
    renderHuman(payload);
  }
}

/** Emit a DEV_FUSION_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('DEV_FUSION_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Human-readable render of the restart plan. */
function renderHuman(payload: {
  changed: string[];
  ordered: { name: string; reason: string; depth: number }[];
  affected: string[];
  warnings: string[];
}): void {
  process.stdout.write(chalk.cyan.bold('\n▶ dev restart plan\n\n'));
  process.stdout.write(
    `  ${chalk.bold('changed')}  ${payload.changed.join(', ') || '(none)'}\n` +
      `  ${chalk.bold('restart')}  ${payload.ordered.length} package(s) in dependency order\n\n`
  );
  for (const target of payload.ordered) {
    const indent = '  '.repeat(target.depth + 1);
    const marker = target.reason === 'changed' ? chalk.yellow('●') : chalk.gray('↳');
    const label = target.reason === 'changed' ? chalk.yellow(target.name) : chalk.white(target.name);
    process.stdout.write(`  ${indent}${marker} ${label} ${chalk.gray(`(${target.reason}, depth ${target.depth})`)}\n`);
  }
  for (const warning of payload.warnings) {
    process.stdout.write(chalk.yellow(`\n  ! ${warning}`));
  }
  process.stdout.write('\n');
}
