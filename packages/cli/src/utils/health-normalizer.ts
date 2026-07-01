import type { WorkspaceHealthReport } from './workspace-health';

/**
 * Canonical, machine-readable health shape emitted by every `--json` health
 * surface. Both the lightweight `workspace health` command output and the rich
 * `WorkspaceHealthReport` are normalized into this single shape so downstream
 * consumers (UI, CI) only ever parse one schema.
 */
export type CanonicalHealthStatus = 'healthy' | 'degraded' | 'critical';

/**
 * Tri-state severity for an individual health check within a
 * {@link CanonicalHealth} report.
 */
export type CanonicalCheckStatus = 'healthy' | 'warning' | 'critical';

/**
 * A single normalized health check entry. `details` is intentionally
 * `unknown` so callers can attach arbitrary structured metadata without
 * constraining the canonical schema.
 */
export interface CanonicalHealthCheck {
  name: string;
  status: CanonicalCheckStatus;
  message?: string;
  details?: unknown;
}

/**
 * Top-level canonical health payload consumed by `--json` downstream
 * consumers. The `score` is a 0-100 integer and `status` is the
 * coarse-grained bucket derived from it.
 */
export interface CanonicalHealth {
  score: number; // 0-100
  status: CanonicalHealthStatus;
  checks: CanonicalHealthCheck[];
}

// Lightweight shape produced by src/commands/workspace.ts displayHealthResults.
interface LightweightHealthCheck {
  name: string;
  status: CanonicalCheckStatus;
  message?: string;
  details?: unknown;
}

interface LightweightHealth {
  checks: LightweightHealthCheck[];
  overall?: string;
}

// Score weights per check severity for the lightweight path. A healthy check
// contributes full credit, a warning partial, and a critical none.
const CHECK_SCORE_WEIGHTS: Record<CanonicalCheckStatus, number> = {
  healthy: 1,
  warning: 0.5,
  critical: 0,
};

const HEALTHY_THRESHOLD = 90;
const DEGRADED_THRESHOLD = 70;

function isRichReport(input: unknown): input is WorkspaceHealthReport {
  if (typeof input !== 'object' || input === null) return false;
  const candidate = input as Record<string, unknown>;
  return Array.isArray(candidate.categories) && typeof candidate.overall === 'object';
}

function deriveStatusFromScore(score: number): CanonicalHealthStatus {
  if (score >= HEALTHY_THRESHOLD) return 'healthy';
  if (score >= DEGRADED_THRESHOLD) return 'degraded';
  return 'critical';
}

// Map a rich check status (pass/fail/warning/info) onto the canonical tri-state.
function normalizeRichCheckStatus(status: string): CanonicalCheckStatus {
  if (status === 'fail') return 'critical';
  if (status === 'warning') return 'warning';
  return 'healthy';
}

// Map a rich overall status (healthy/degraded/unhealthy) onto the canonical set.
function normalizeRichOverallStatus(status: string): CanonicalHealthStatus {
  if (status === 'healthy') return 'healthy';
  if (status === 'degraded') return 'degraded';
  return 'critical';
}

function normalizeCheckStatus(status: unknown): CanonicalCheckStatus {
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'warning';
  return 'healthy';
}

function normalizeRich(report: WorkspaceHealthReport): CanonicalHealth {
  const checks: CanonicalHealthCheck[] = [];

  for (const category of report.categories) {
    for (const check of category.checks) {
      checks.push({
        name: check.name,
        status: normalizeRichCheckStatus(check.status),
        ...(check.message ? { message: check.message } : {}),
        ...(check.metadata ? { details: check.metadata } : {}),
      });
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(report.overall.score)));

  return {
    score,
    status: normalizeRichOverallStatus(report.overall.status),
    checks,
  };
}

function normalizeLightweight(input: LightweightHealth): CanonicalHealth {
  const checks: CanonicalHealthCheck[] = input.checks.map(check => ({
    name: check.name,
    status: normalizeCheckStatus(check.status),
    ...(check.message ? { message: check.message } : {}),
    ...(check.details !== undefined ? { details: check.details } : {}),
  }));

  // Derive a numeric score from check severities so the lightweight path still
  // surfaces a 0-100 score even though it does not track one natively.
  const score =
    checks.length === 0
      ? 0
      : Math.round(
          (checks.reduce((sum, c) => sum + CHECK_SCORE_WEIGHTS[c.status], 0) / checks.length) * 100
        );

  return {
    score,
    status: deriveStatusFromScore(score),
    checks,
  };
}

/**
 * Normalize either the lightweight health shape or a rich
 * {@link WorkspaceHealthReport} into the canonical health shape.
 *
 * - Rich path: maps categories -> checks and uses the report's own score.
 * - Lightweight path: derives a numeric score from check severities.
 *
 * @param input - The raw health payload (rich report, lightweight shape, or unknown).
 * @returns A {@link CanonicalHealth} object. Malformed input yields an empty, critical report.
 */
export function normalizeHealth(input: unknown): CanonicalHealth {
  if (isRichReport(input)) {
    return normalizeRich(input);
  }

  if (
    typeof input === 'object' &&
    input !== null &&
    Array.isArray((input as Record<string, unknown>).checks)
  ) {
    return normalizeLightweight(input as LightweightHealth);
  }

  // Unknown input: return an empty, critical report rather than throwing so a
  // malformed upstream payload never crashes a --json command.
  return { score: 0, status: 'critical', checks: [] };
}
