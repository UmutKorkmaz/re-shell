import { z } from 'zod';
import {
  jsonResponseSchema,
  workspaceSummarySchema,
  healthSummarySchema,
  type WorkspaceSummary,
  type HealthSummary,
} from '@re-shell/contracts';

/**
 * PURE module. No VS Code, no Node side effects.
 *
 * Fetches + parses the workspace summary/graph/health/doctor JSON payloads the
 * Re-Shell CLI emits. The CLI is the single source of truth: this module never
 * reads package.json or scans the filesystem itself.
 *
 * The CLI's `--json` envelope is the canonical `{ ok, data, warnings }` shape
 * from @re-shell/contracts, so every parser validates against
 * `jsonResponseSchema(<dataSchema>)` and never trusts the raw stdout blob.
 */

// ---------------------------------------------------------------------------
// workspace summary  (`re-shell workspace summary --json`)
//
// `data` is the full WorkspaceSummary: { path, name, packageManager, apps[],
// services[], templates[], health }. Validated against the shared contract.
// ---------------------------------------------------------------------------

const summaryEnvelopeSchema = jsonResponseSchema(workspaceSummarySchema);

export type ParseSummaryResult =
  | { ok: true; summary: WorkspaceSummary; warnings: string[] }
  | { ok: false; error: string };

/**
 * Parse a raw `workspace summary --json` payload into a validated
 * {@link WorkspaceSummary}. Never throws; returns a tagged result.
 */
export function parseWorkspaceSummary(raw: unknown): ParseSummaryResult {
  const value = coerceJson(raw);
  if (typeof value === 'string') {
    return { ok: false, error: value };
  }
  const parsed = summaryEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: `workspace.summary payload does not match the contract: ${parsed.error.message}`,
    };
  }
  const envelope = parsed.data;
  if (!envelope.ok) {
    return { ok: false, error: `[${envelope.error.code}] ${envelope.error.message}` };
  }
  return { ok: true, summary: envelope.data, warnings: envelope.warnings };
}

// ---------------------------------------------------------------------------
// workspace graph  (`re-shell workspace graph --json`)
//
// The CLI emits the consumer contract shape `{ apps, services }` where each
// node is { name, path, framework (string|null), dependencies: string[] }.
// (packages/cli/src/commands/workspace.ts → buildContractGraph.) This is NOT in
// @re-shell/contracts, so the node schema is authored here.
// ---------------------------------------------------------------------------

export const graphNodeSchema = z.object({
  name: z.string(),
  path: z.string(),
  framework: z.string().nullable(),
  dependencies: z.array(z.string()),
});
export type GraphNode = z.infer<typeof graphNodeSchema>;

export const workspaceGraphDataSchema = z.object({
  apps: z.array(graphNodeSchema),
  services: z.array(graphNodeSchema),
});
export type WorkspaceGraph = z.infer<typeof workspaceGraphDataSchema>;

const graphEnvelopeSchema = jsonResponseSchema(workspaceGraphDataSchema);

export type ParseGraphResult =
  | { ok: true; graph: WorkspaceGraph; warnings: string[] }
  | { ok: false; error: string };

/** Parse a raw `workspace graph --json` payload into a validated graph. */
export function parseWorkspaceGraph(raw: unknown): ParseGraphResult {
  const value = coerceJson(raw);
  if (typeof value === 'string') {
    return { ok: false, error: value };
  }
  const parsed = graphEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: `workspace.graph payload does not match the contract: ${parsed.error.message}`,
    };
  }
  const envelope = parsed.data;
  if (!envelope.ok) {
    return { ok: false, error: `[${envelope.error.code}] ${envelope.error.message}` };
  }
  return { ok: true, graph: envelope.data, warnings: envelope.warnings };
}

// ---------------------------------------------------------------------------
// workspace health  (`re-shell workspace health --json`)
//
// `data` is the HealthSummary: { score, status, checks[] }. The shared contract
// covers this directly.
// ---------------------------------------------------------------------------

const healthEnvelopeSchema = jsonResponseSchema(healthSummarySchema);

export type ParseHealthResult =
  | { ok: true; health: HealthSummary; warnings: string[] }
  | { ok: false; error: string };

/** Parse a raw `workspace health --json` payload into a validated summary. */
export function parseWorkspaceHealth(raw: unknown): ParseHealthResult {
  const value = coerceJson(raw);
  if (typeof value === 'string') {
    return { ok: false, error: value };
  }
  const parsed = healthEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: `workspace.health payload does not match the contract: ${parsed.error.message}`,
    };
  }
  const envelope = parsed.data;
  if (!envelope.ok) {
    return { ok: false, error: `[${envelope.error.code}] ${envelope.error.message}` };
  }
  return { ok: true, health: envelope.data, warnings: envelope.warnings };
}

// ---------------------------------------------------------------------------
// doctor  (`re-shell doctor --json`)
//
// The CLI emits `{ checks: [{ name, status, message, suggestion? }] }` where
// status is the LOOSE vocabulary ('success' | 'warning' | 'error') — this
// differs from the contract health-check level vocabulary, so the doctor check
// schema is authored here against the CLI's actual output.
// (packages/cli/src/commands/doctor.ts → displayResults → jsonSuccess.)
// ---------------------------------------------------------------------------

export const doctorCheckStatusSchema = z.enum(['success', 'warning', 'error']);
export type DoctorCheckStatus = z.infer<typeof doctorCheckStatusSchema>;

export const doctorCheckSchema = z.object({
  name: z.string(),
  status: doctorCheckStatusSchema,
  message: z.string(),
  suggestion: z.string().optional(),
});
export type DoctorCheck = z.infer<typeof doctorCheckSchema>;

export const doctorDataSchema = z.object({
  checks: z.array(doctorCheckSchema),
});
export type DoctorResult = z.infer<typeof doctorDataSchema>;

const doctorEnvelopeSchema = jsonResponseSchema(doctorDataSchema);

export type ParseDoctorResult =
  | { ok: true; doctor: DoctorResult; warnings: string[] }
  | { ok: false; error: string };

/** Parse a raw `doctor --json` payload into a validated doctor result. */
export function parseDoctor(raw: unknown): ParseDoctorResult {
  const value = coerceJson(raw);
  if (typeof value === 'string') {
    return { ok: false, error: value };
  }
  const parsed = doctorEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: `doctor payload does not match the contract: ${parsed.error.message}`,
    };
  }
  const envelope = parsed.data;
  if (!envelope.ok) {
    return { ok: false, error: `[${envelope.error.code}] ${envelope.error.message}` };
  }
  return { ok: true, doctor: envelope.data, warnings: envelope.warnings };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Coerce a raw payload to a parsed value. Accepts an already-parsed object
 * unchanged; parses a JSON string; returns an error string for empty/garbage
 * input so callers can return a uniform { ok:false, error } without repeating
 * the JSON.parse boilerplate.
 */
function coerceJson(raw: unknown): unknown | string {
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return 'Empty output from the CLI.';
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return 'CLI output is not valid JSON.';
  }
}

// ---------------------------------------------------------------------------
// Derived view models
//
// Pure projections the tree providers render. Grouping/sorting happens here so
// the VS Code layer stays a thin renderer and the logic is unit-testable.
// ---------------------------------------------------------------------------

/**
 * A project entry for the Projects tree: either an app or a package (service).
 * `kind` distinguishes the two folders; `health` carries the rolled-up status
 * dot derived from the workspace health summary when available.
 */
export interface ProjectNode {
  readonly kind: 'app' | 'package';
  readonly name: string;
  readonly path: string;
  readonly framework: string | null;
  readonly dependencies: readonly string[];
  /** Rolled-up health status for the icon dot, or null when unknown. */
  readonly health: 'pass' | 'warn' | 'fail' | null;
}

/**
 * Project a workspace graph + health summary into the grouped view model the
 * Projects tree renders (apps folder + packages folder, each with a status dot).
 *
 * The contract HealthCheck carries no explicit node binding, so per-node health
 * is rolled up by SOFT-MATCHING the node name against the check's id/title/
 * message (case-insensitive). A node with no matching check inherits the global
 * worst-case status; absent a summary, health is null (unknown).
 */
export function toProjectNodes(
  graph: WorkspaceGraph,
  health?: HealthSummary
): { apps: ProjectNode[]; packages: ProjectNode[] } {
  const global = healthToOverallStatus(health)?.status ?? null;
  const toNode = (kind: 'app' | 'package') => (n: GraphNode): ProjectNode => ({
    kind,
    name: n.name,
    path: n.path,
    framework: n.framework,
    dependencies: n.dependencies,
    health: nodeHealth(n.name, health) ?? global,
  });

  const apps = [...graph.apps].sort(byName).map(toNode('app'));
  const packages = [...graph.services].sort(byName).map(toNode('package'));
  return { apps, packages };
}

/**
 * Soft-match a node name against the health checks. Returns the worst-case
 * level among checks that mention the node name, or null when no check matches.
 */
function nodeHealth(
  name: string,
  health?: HealthSummary
): 'pass' | 'warn' | 'fail' | null {
  if (!health) {
    return null;
  }
  const needle = name.toLowerCase();
  const rank: Record<'pass' | 'warn' | 'fail', number> = { pass: 0, warn: 1, fail: 2 };
  let worst: 'pass' | 'warn' | 'fail' | null = null;
  for (const check of health.checks) {
    const level = check.level === 'info' ? 'pass' : check.level;
    const hay = `${check.id} ${check.title} ${check.message}`.toLowerCase();
    if (!hay.includes(needle)) {
      continue;
    }
    if (worst === null || rank[level] > rank[worst]) {
      worst = level;
    }
  }
  return worst;
}

/** Stable sort comparator by name. */
function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

/**
 * Summarize a health summary into a single status for the status bar.
 * Returns 'pass' when there are no warn/fail checks, 'warn' for any warn, and
 * 'fail' for any fail. Absent a summary, returns null (unknown).
 */
export function healthToOverallStatus(
  health?: HealthSummary
): { status: 'pass' | 'warn' | 'fail'; warnCount: number; failCount: number } | null {
  if (!health) {
    return null;
  }
  let warnCount = 0;
  let failCount = 0;
  for (const check of health.checks) {
    if (check.level === 'warn') warnCount += 1;
    else if (check.level === 'fail') failCount += 1;
  }
  const status: 'pass' | 'warn' | 'fail' =
    failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';
  return { status, warnCount, failCount };
}
