// `re-shell boundaries` — module-boundary enforcement command (issue #20).
//
// Discovers the workspace packages + their tags + import edges, evaluates the
// declarative boundary ruleset, and emits a CI report that fails (non-zero) on
// any violation (disallowed cross-package import or undeclared dependency).

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { discoverWorkspace } from '../utils/task-runner';
import {
  evaluateBoundaries,
  DEFAULT_BOUNDARY_RULES,
  type BoundaryPackage,
  type BoundaryEdge,
  type BoundaryRule,
  type BoundaryViolationLite,
} from '../utils/boundaries-engine';
import type { BoundaryViolation, BoundariesResponse } from '@re-shell/contracts';

/**
 * Options accepted by the `boundaries` command.
 *
 * Controls how the module-boundary evaluation discovers packages, resolves the
 * ruleset, and emits its report. Several fields exist primarily for testing
 * (injecting synthetic graphs and working directories) and are not surfaced on
 * the CLI surface itself.
 */
export interface BoundariesOptions {
  /** Emit the report as a machine-readable JSON envelope instead of human-readable text. */
  json?: boolean;
  /** Path to a JSON ruleset (overrides the default rules). */
  rules?: string;
  /** Injectable import-edge source (tests). Falls back to the workspace graph. */
  edges?: readonly BoundaryEdge[];
  /** Working directory override (tests). */
  cwd?: string;
}

/** Default tag inference: derive scope/type/layer tags from a package's name/dir. */
function inferTags(name: string): Record<string, string> {
  // A minimal, deterministic inference real teams override with a config. The
  // engine is tag-source-agnostic; this just gives the command a default.
  if (name === 'shell' || name.endsWith('/shell')) return { scope: 'shell', layer: 'shell' };
  if (name.includes('ui') || name.includes('components')) return { type: 'ui', layer: 'ui' };
  if (name.includes('domain') || name.includes('core')) return { type: 'core', layer: 'domain' };
  return { type: 'package' };
}

/** Load a JSON ruleset, returning null on any failure. */
function loadRules(filePath: string): BoundaryRule[] | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (r): r is BoundaryRule =>
        r && typeof r.id === 'string' && typeof r.reason === 'string' &&
        typeof r.from === 'object' && typeof r.disallow === 'object'
    );
  } catch {
    return null;
  }
}

/** Project a pure violation onto the wire contract shape. */
function toWireViolation(v: BoundaryViolationLite): BoundaryViolation {
  return {
    kind: v.kind,
    ...(v.ruleId ? { ruleId: v.ruleId } : {}),
    from: v.from,
    to: v.to,
    ...(v.file ? { file: v.file } : {}),
    message: v.message,
  };
}

/**
 * `re-shell boundaries` — module-boundary enforcement.
 *
 * Discovers the workspace packages, derives their tags and import edges,
 * evaluates the active boundary ruleset, and emits a CI report. Gate semantics:
 * any violation still emits a success envelope (advisory data) but exits
 * non-zero so CI can gate. A genuine error (e.g. not run inside a workspace) is
 * reported via the BOUNDARIES_ERROR envelope.
 *
 * @param options - Command options controlling JSON output, ruleset selection,
 *   edge injection, and working directory.
 * @returns Resolves once the report has been emitted. Sets `process.exitCode`
 *   to `1` on any boundary violation or fatal error so CI runs fail.
 */
export async function runBoundaries(options: BoundariesOptions): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const rootDir = path.resolve(cwd);

  const spinner = json ? null : createSpinner('Evaluating module boundaries…', undefined, { json });
  spinner?.start();

  try {
    // ── Discover packages + their tags + declared deps ────────────────────────
    const packages: BoundaryPackage[] = [];
    let graph: ReadonlyMap<string, readonly string[]> = new Map();
    try {
      const discovery = await discoverWorkspace(rootDir);
      graph = discovery.graph;
      for (const [name, pkg] of discovery.packages) {
        packages.push({
          name,
          tags: inferTags(name),
          declaredDeps: pkg.workspaceDeps,
        });
      }
    } catch (error) {
      emitError(json, messageOf(error));
      return;
    }

    if (packages.length === 0) {
      emitError(json, 'No workspace packages discovered.');
      return;
    }

    // ── Resolve edges: injected, or derived from the workspace graph ──────────
    const edges: BoundaryEdge[] = options.edges
      ? [...options.edges]
      : [...graph.entries()].flatMap(([from, deps]) =>
          deps.map(to => ({ from, to }))
        );

    // ── Resolve ruleset: explicit --rules, or the default ─────────────────────
    const warnings: string[] = [];
    let rules: readonly BoundaryRule[] = DEFAULT_BOUNDARY_RULES;
    if (options.rules) {
      const abs = path.resolve(rootDir, options.rules);
      const loaded = loadRules(abs);
      if (loaded === null) {
        warnings.push(`could not load ruleset ${options.rules}; using defaults`);
      } else {
        rules = loaded;
      }
    }

    const violations = evaluateBoundaries(packages, edges, rules);
    const disallowedCount = violations.filter(v => v.kind === 'disallowed-import').length;
    const undeclaredCount = violations.filter(v => v.kind === 'undeclared-dependency').length;
    const passed = violations.length === 0;

    const payload: BoundariesResponse = {
      pass: passed,
      disallowedCount,
      undeclaredCount,
      rules: rules.length,
      violations: violations.map(toWireViolation),
      warnings,
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload);
    }

    if (!passed) {
      process.exitCode = 1;
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit a BOUNDARIES_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('BOUNDARIES_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Human-readable render of the boundaries report. */
function renderHuman(payload: BoundariesResponse): void {
  process.stdout.write(chalk.cyan.bold('\n▶ boundaries\n\n'));
  process.stdout.write(
    `  ${chalk.bold('packages/rules')}  ${payload.rules} rule(s) evaluated\n\n`
  );

  if (payload.violations.length === 0) {
    process.stdout.write(chalk.green('  ✓ no boundary violations\n'));
  } else {
    for (const v of payload.violations) {
      const tone = v.kind === 'disallowed-import' ? chalk.red : chalk.yellow;
      process.stdout.write(
        `  ${tone.bold(v.kind.toUpperCase())}  ${v.message}` +
          (v.file ? chalk.gray(`  (${v.file})`) : '') +
          '\n'
      );
    }
  }

  const gate = payload.pass ? chalk.green('PASS') : chalk.red('FAIL');
  process.stdout.write(
    `\n  ${chalk.bold('result')}  ${gate}  ` +
      chalk.gray(
        `(${payload.disallowedCount} disallowed · ${payload.undeclaredCount} undeclared)`
      ) +
      '\n'
  );
  for (const warning of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
  }
  process.stdout.write('\n');
}
