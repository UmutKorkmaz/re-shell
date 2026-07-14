import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { WorkspaceParser } from '../parsers/workspace-parser';
import type { ServiceConfig } from '../parsers/workspace-parser';
import { performQuickHealthCheck } from '../utils/workspace-health';
import { loadWorkspaceDefinition } from '../utils/workspace-schema';
import { normalizeHealth } from '../utils/health-normalizer';
import { resolvePolicyPack, evaluatePolicyPack } from '../utils/policy-engine';
import { detectDependencyDrift } from '../utils/dependency-drift';
import {
  computeServiceScorecard,
  computeRollup,
  type ScorecardServiceInput,
  type ScorecardSignals,
  type ServiceScorecard,
  type ScorecardRollup,
} from '../utils/scorecard-engine';
import type { ScorecardResponse, ScorecardService } from '@re-shell/contracts';

/** Candidate filenames for the workspace v2 config, in discovery order. */
const CONFIG_CANDIDATES = ['re-shell.workspaces.yaml', 're-shell.workspaces.yml'];

/** Penalty applied per drifting dependency when scoring the drift dimension. */
const DRIFT_PENALTY_PER_ENTRY = 10;

/** Options accepted by the `scorecard` command. */
export interface ScorecardCommandOptions {
  /** When true, emit the scorecard as a JSON envelope to stdout. */
  json?: boolean;
  /** Minimum rollup score required to pass (CI gate). */
  threshold: number;
  /** Filter the report to a single named service. */
  service?: string;
  /** Policy pack reference (default 'recommended'). */
  pack?: string;
  /** Working directory override (tests). */
  cwd?: string;
}

/** Resolve the workspace v2 config path under `cwd`, or undefined if absent. */
function resolveConfigPath(cwd: string): string | undefined {
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.join(cwd, candidate);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

/** A named service paired with its parsed config. */
interface NamedService {
  readonly name: string;
  readonly config: ServiceConfig;
}

/** Load + validate the workspace, returning its named services. */
function loadServices(configPath: string): NamedService[] {
  const parser = new WorkspaceParser();
  const parsed = parser.parse(configPath);
  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors
      .map(e => `${e.path}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid workspace config: ${detail || 'unknown error'}`);
  }
  const services = parsed.config.services ?? {};
  return Object.keys(services).map(name => ({
    name,
    config: services[name],
  }));
}

/** Gathered monorepo signals plus any warnings raised while collecting them. */
interface GatheredSignals {
  readonly signals: ScorecardSignals;
  readonly driftEntries: number;
  readonly policyScore: number;
  readonly warnings: readonly string[];
}

/**
 * Gather the three monorepo-level signals (health, policy, drift). Each source
 * is wrapped so a single failure degrades to a neutral score plus a warning
 * rather than crashing the whole command.
 */
async function gatherSignals(
  rootPath: string,
  configPath: string,
  pack: string
): Promise<GatheredSignals> {
  const warnings: string[] = [];

  // ── Health ────────────────────────────────────────────────────────────────
  // Health depends on a v1 WorkspaceDefinition. A v2-only workspace makes it
  // not-applicable (neutralised, never penalising). Probe applicability via the
  // v1 loader so we never confuse "v2-only" with "genuinely unhealthy".
  let healthScore = 100;
  let healthApplicable = false;
  try {
    await loadWorkspaceDefinition(configPath);
    healthApplicable = true;
    try {
      const quick = await performQuickHealthCheck(configPath, rootPath);
      healthScore = normalizeHealth(quick).score;
    } catch (error) {
      healthScore = 100;
      warnings.push(`health signal degraded: ${messageOf(error)}`);
    }
  } catch {
    // v2-only (or otherwise no v1 definition): health is not-applicable.
    healthApplicable = false;
  }

  // ── Policy ──────────────────────────────────────────────────────────────────
  let policyScore = 100;
  try {
    const resolved = await resolvePolicyPack(pack);
    const result = await evaluatePolicyPack(resolved, rootPath);
    policyScore = result.score;
  } catch (error) {
    warnings.push(`policy signal degraded: ${messageOf(error)}`);
  }

  // ── Drift ─────────────────────────────────────────────────────────────────
  let driftEntries = 0;
  let driftScore = 100;
  try {
    const result = await detectDependencyDrift(rootPath);
    driftEntries = result.drift.length;
    driftScore =
      driftEntries === 0
        ? 100
        : Math.max(0, 100 - driftEntries * DRIFT_PENALTY_PER_ENTRY);
  } catch (error) {
    warnings.push(`drift signal degraded: ${messageOf(error)}`);
  }

  return {
    signals: { healthScore, healthApplicable, policyScore, driftScore },
    driftEntries,
    policyScore,
    warnings,
  };
}

/** Extract a human message from an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Project a parsed service config onto the pure engine's minimal input. */
function toServiceInput(named: NamedService): ScorecardServiceInput {
  const { name, config } = named;
  const scripts = config.scripts;
  return {
    name,
    path: config.path ?? '',
    ...(scripts ? { scripts } : {}),
    ...(config.healthCheck != null ? { healthCheck: config.healthCheck } : {}),
    ...(config.port != null ? { port: config.port } : {}),
  };
}

/** Project a pure ServiceScorecard onto the wire contract shape. */
function toWireService(card: ServiceScorecard): ScorecardService {
  return {
    service: card.service,
    path: card.path,
    totalScore: card.totalScore,
    grade: card.grade,
    dimensions: card.dimensions.map(dimension => ({
      id: dimension.id,
      label: dimension.label,
      weight: dimension.weight,
      score: dimension.score,
      weighted: dimension.weighted,
      pass: dimension.pass,
      ...(dimension.detail ? { detail: dimension.detail } : {}),
    })),
    warnings: [...card.warnings],
  };
}

/** Project the pure rollup onto the wire ScorecardResponse payload. */
function toWireResponse(rollup: ScorecardRollup): ScorecardResponse {
  return {
    score: rollup.score,
    grade: rollup.grade,
    threshold: rollup.threshold,
    pass: rollup.pass,
    services: rollup.services.map(toWireService),
    driftEntries: rollup.driftEntries,
    policyScore: rollup.policyScore,
    warnings: [...rollup.warnings],
  };
}

/**
 * `re-shell scorecard` — a weighted production-readiness score over existing
 * health/policy/drift signals plus per-service build/test/health-endpoint
 * presence. Emits per-service grades and a monorepo rollup.
 *
 * Gate semantics: when the rollup score is below `--threshold` the command
 * STILL emits a success envelope (the full grades are advisory data) but exits
 * non-zero so CI can gate on it. A genuine error (no workspace file, parse
 * failure) is reported via the SCORECARD_ERROR envelope instead.
 */
export async function runScorecard(
  options: ScorecardCommandOptions
): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const pack = options.pack ?? 'recommended';

  const configPath = resolveConfigPath(cwd);
  if (!configPath) {
    emitError(
      json,
      `No workspace config found (looked for ${CONFIG_CANDIDATES.join(', ')} in ${cwd}). ` +
        'Run `re-shell init` or create a re-shell.workspaces.yaml first.'
    );
    return;
  }

  let allServices: NamedService[];
  try {
    allServices = loadServices(configPath);
  } catch (error) {
    emitError(json, messageOf(error));
    return;
  }

  const gathered = await gatherSignals(cwd, configPath, pack);

  // Apply the optional single-service filter.
  let scoped = allServices;
  if (options.service) {
    const match = allServices.find(s => s.name === options.service);
    if (!match) {
      emitError(
        json,
        `Unknown service "${options.service}". Known services: ` +
          (allServices.map(s => s.name).join(', ') || '(none)')
      );
      return;
    }
    scoped = [match];
  }

  const scorecards = scoped.map(service =>
    computeServiceScorecard(toServiceInput(service), gathered.signals)
  );

  const rollup = computeRollup(scorecards, options.threshold, {
    driftEntries: gathered.driftEntries,
    policyScore: gathered.policyScore,
  });

  const warnings = [...gathered.warnings, ...rollup.warnings];
  const payload: ScorecardResponse = {
    ...toWireResponse(rollup),
    warnings,
  };

  if (json) {
    // Warnings live on the data payload (payload.warnings); avoid duplicating
    // them at the envelope level, consistent with other commands.
    ok(payload);
  } else {
    renderHuman(payload);
  }

  // Gate: a below-threshold rollup is advisory data, not an error — emit the
  // full payload above, then signal CI failure with a non-zero exit code.
  if (!rollup.pass) {
    process.exitCode = 1;
  }
}

/** Emit a SCORECARD_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('SCORECARD_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Colour a grade by its severity for the terminal. */
function colourGrade(grade: string): string {
  switch (grade) {
    case 'A':
    case 'B':
      return chalk.green.bold(grade);
    case 'C':
    case 'D':
      return chalk.yellow.bold(grade);
    default:
      return chalk.red.bold(grade);
  }
}

/** Human-readable render of the scorecard payload (non-JSON path). */
function renderHuman(payload: ScorecardResponse): void {
  process.stdout.write(chalk.cyan.bold('\n▶ production-readiness scorecard\n\n'));

  if (payload.services.length === 0) {
    process.stdout.write(chalk.yellow('No services to score.\n\n'));
  }

  for (const service of payload.services) {
    const failed = service.dimensions
      .filter(d => !d.pass)
      .map(d => d.id);
    const failedNote =
      failed.length > 0
        ? chalk.gray(` · failing: ${failed.join(', ')}`)
        : '';
    process.stdout.write(
      `  ${colourGrade(service.grade)} ${chalk.bold(
        service.service.padEnd(20)
      )} ${chalk.gray(`${service.totalScore.toFixed(1)}/100`)}${failedNote}\n`
    );
  }

  const gate = payload.pass
    ? chalk.green('PASS')
    : chalk.red('FAIL');
  process.stdout.write(
    `\n  ${chalk.bold('rollup')}  ${colourGrade(payload.grade)} ${chalk.gray(
      `${payload.score.toFixed(1)}/100`
    )} (threshold ${payload.threshold}) → ${gate}\n`
  );

  for (const warning of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
  }
  process.stdout.write('\n');
}
