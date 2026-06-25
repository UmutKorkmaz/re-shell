// `re-shell api verify` — API contract + cross-service spec-drift command.
//
// Discovers a producer API's OpenAPI-ish spec, optionally diffs it against a
// baseline for backward-incompatible changes, computes the cross-service blast
// radius (which consumers break) from the workspace graph, and emits a CI report
// that fails (non-zero) on backward-incompatible changes.

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { discoverWorkspace } from '../utils/task-runner';
import {
  normalizeOpenApi,
  diffApiSpec,
  computeBlastRadius,
  diffToApiFindings,
  type ApiFindingLite,
} from '../utils/api-verify-engine';
import type { ApiFinding, ApiVerifyResponse } from '@re-shell/contracts';

/** Candidate spec filenames, in discovery order. */
const SPEC_CANDIDATES = ['openapi.json', 'openapi.yaml', 'swagger.json', 'api.json'];

/** Conventional roots scanned for specs. */
const SPEC_DIRS = ['apps', 'packages', 'services', 'apis'];

/** Options accepted by the `api verify` command. */
export interface ApiVerifyOptions {
  json?: boolean;
  /** The producer API/service name to verify. */
  api?: string;
  /** Baseline directory (a previous spec set) to diff against. */
  baseline?: string;
  /** Explicit current spec path (overrides discovery). */
  spec?: string;
  /** Explicit baseline spec path. */
  baselineSpec?: string;
  /** Working directory override (tests). */
  cwd?: string;
}

/** Read + JSON-parse a spec file, returning null on any failure. */
function readSpec(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Discover a spec for `apiName` under `rootDir`. Returns the abs path or null. */
function discoverSpec(rootDir: string, apiName?: string): string | null {
  for (const dir of SPEC_DIRS) {
    const dirAbs = path.join(rootDir, dir);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // If an api name is given, only scan that dir; otherwise scan every dir.
      if (apiName && entry.name !== apiName) continue;
      for (const candidate of SPEC_CANDIDATES) {
        const p = path.join(dirAbs, entry.name, candidate);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

/** Project a pure finding onto the wire ApiFinding contract shape. */
function toWireFinding(f: ApiFindingLite): ApiFinding {
  return {
    severity: f.severity,
    kind: f.kind,
    message: f.message,
    ...(f.operation ? { operation: f.operation } : {}),
    consumers: [...f.consumers],
  };
}

/**
 * `re-shell api verify` — API contract + cross-service spec-drift detection.
 *
 * Gate semantics: when there is any breaking change the command STILL emits a
 * success envelope (the findings are advisory data) but exits non-zero so CI can
 * gate on backward-incompatible changes. A genuine error (no spec found) is
 * reported via the API_VERIFY_ERROR envelope.
 */
export async function runApiVerify(options: ApiVerifyOptions): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const rootDir = path.resolve(cwd);

  const spinner = json ? null : createSpinner('Verifying API contract…', undefined, { json });
  spinner?.start();

  try {
    // ── Resolve the current spec ───────────────────────────────────────────────
    let currentSpecPath: string | null;
    if (options.spec) {
      currentSpecPath = path.resolve(rootDir, options.spec);
      if (!fs.existsSync(currentSpecPath)) currentSpecPath = null;
    } else {
      currentSpecPath = discoverSpec(rootDir, options.api);
    }
    if (!currentSpecPath) {
      emitError(
        json,
        `No API spec found${options.api ? ` for "${options.api}"` : ''} ` +
          `(looked for ${SPEC_CANDIDATES.join(', ')} under ${SPEC_DIRS.join(', ')}). ` +
          'Pass --spec <path> or --api <name>.'
      );
      return;
    }

    const apiName = options.api ?? path.basename(path.dirname(currentSpecPath));
    const currentRaw = readSpec(currentSpecPath);
    if (!currentRaw) {
      emitError(json, `Could not parse spec ${currentSpecPath}.`);
      return;
    }
    const current = normalizeOpenApi(currentRaw, apiName);

    // ── Discover the workspace graph (for blast radius) ────────────────────────
    let graph: ReadonlyMap<string, readonly string[]> = new Map();
    try {
      const discovery = await discoverWorkspace(rootDir);
      graph = discovery.graph;
    } catch {
      // Discovery is best-effort; blast radius degrades to the api name only.
    }
    const consumers = computeBlastRadius(graph, apiName);

    const findings: ApiFindingLite[] = [];
    let hasBaseline = false;

    // ── Baseline diff (breaking changes) ───────────────────────────────────────
    if (options.baseline || options.baselineSpec) {
      hasBaseline = true;
      let baselineSpecPath: string | null = null;
      if (options.baselineSpec) {
        const p = path.resolve(rootDir, options.baselineSpec);
        baselineSpecPath = fs.existsSync(p) ? p : null;
      } else {
        baselineSpecPath = discoverSpec(path.resolve(rootDir, options.baseline!), apiName);
      }
      if (!baselineSpecPath) {
        const warnings = [`no baseline spec found for "${apiName}"; skipped diff`];
        emitPayload(json, { api: apiName, pass: true, hasBaseline, breakingCount: 0, findings: [], impactedConsumers: 0, warnings });
        return;
      }
      const baselineRaw = readSpec(baselineSpecPath);
      if (!baselineRaw) {
        const warnings = [`could not parse baseline spec ${baselineSpecPath}; skipped diff`];
        emitPayload(json, { api: apiName, pass: true, hasBaseline, breakingCount: 0, findings: [], impactedConsumers: 0, warnings });
        return;
      }
      const baseline = normalizeOpenApi(baselineRaw, apiName);
      const diff = diffApiSpec(baseline, current);
      findings.push(...diffToApiFindings(apiName, consumers, diff));
    }

    const breakingCount = findings.filter(f => f.severity === 'breaking').length;
    const passed = breakingCount === 0;

    // Distinct impacted consumers across all findings.
    const impacted = new Set<string>();
    for (const f of findings) for (const c of f.consumers) impacted.add(c);

    const payload: ApiVerifyResponse = {
      api: apiName,
      pass: passed,
      hasBaseline,
      breakingCount,
      findings: findings.map(toWireFinding),
      impactedConsumers: impacted.size,
      warnings: [],
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload);
    }

    // Gate: unknown backward-incompatible change fails the CI check.
    if (!passed) {
      process.exitCode = 1;
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit a payload via ok (json) or render it (human). */
function emitPayload(json: boolean, payload: ApiVerifyResponse): void {
  if (json) {
    ok(payload);
  } else {
    renderHuman(payload);
  }
}

/** Emit an API_VERIFY_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('API_VERIFY_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Human-readable render of the api-verify report. */
function renderHuman(payload: ApiVerifyResponse): void {
  process.stdout.write(chalk.cyan.bold('\n▶ api verify\n\n'));
  process.stdout.write(
    `  ${chalk.bold('api')}  ${payload.api}  ` +
      chalk.gray(`(${payload.findings.length} finding(s), ${payload.impactedConsumers} impacted consumer(s))`) +
      '\n\n'
  );

  if (payload.findings.length === 0) {
    process.stdout.write(chalk.green('  ✓ no backward-incompatible changes\n'));
  } else {
    for (const f of payload.findings) {
      process.stdout.write(`  ${chalk.red.bold('BREAKING')}  ${f.message}\n`);
      if (f.consumers.length > 0) {
        process.stdout.write(chalk.gray(`      impacted consumers: ${f.consumers.join(', ')}\n`));
      }
    }
  }

  const gate = payload.pass ? chalk.green('PASS') : chalk.red('FAIL');
  process.stdout.write(
    `\n  ${chalk.bold('result')}  ${gate}` +
      chalk.gray(payload.hasBaseline ? ' (diffed against baseline)' : '') +
      '\n\n'
  );
}
