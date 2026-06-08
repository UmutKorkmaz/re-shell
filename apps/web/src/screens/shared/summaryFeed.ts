import { z } from 'zod';
import type {
  HealthCheck,
  HealthSummary,
  PackageManager,
  WorkspaceApp,
  WorkspaceService,
  WorkspaceSummary,
} from '@umutkorkmaz/contracts';

export type { HealthSummary };

/** Health-check level and overall status, derived from the contract types. */
type HealthCheckLevel = HealthCheck['level'];
type HealthStatus = HealthSummary['status'];

/**
 * Web-side schema + adapter for `re-shell workspace summary --json`.
 *
 * The CLI emits a NARROW, monorepo-derived summary (`root` / `workspaces` /
 * `graph` / canonical `health`) that does NOT match the rich contracts
 * `WorkspaceSummary` the Overview screen + `WorkspaceSummaryPanel` consume. This
 * mirrors the existing `feedSchemas` / `templateAdapters` pattern: validate the
 * EXACT wire shape here, then adapt it into the contract shape, so a slightly-off
 * feed degrades gracefully instead of failing the whole screen.
 */

// ---------------------------------------------------------------------------
// Wire shape (exactly what the CLI prints)
// ---------------------------------------------------------------------------

/** A discovered workspace as the CLI's `getWorkspaces()` emits it. */
const workspaceInfoSchema = z.object({
  name: z.string(),
  path: z.string().default(''),
  type: z.enum(['app', 'package', 'lib', 'tool']).default('package'),
  framework: z.string().optional(),
  version: z.string().default('0.0.0'),
  dependencies: z.array(z.string()).default([]),
});

/** One canonical health check (see CLI health-normalizer). */
const canonicalCheckSchema = z.object({
  name: z.string(),
  status: z.enum(['healthy', 'warning', 'critical']).default('healthy'),
  message: z.string().optional(),
});

const canonicalHealthSchema = z.object({
  score: z.number().default(0),
  status: z.enum(['healthy', 'degraded', 'critical']).default('critical'),
  checks: z.array(canonicalCheckSchema).default([]),
});

/** The full CLI summary envelope payload, validated leniently. */
export const summaryFeedSchema = z.object({
  root: z.string().default(''),
  packageManager: z.string().default('unknown'),
  workspaces: z.array(workspaceInfoSchema).default([]),
  health: canonicalHealthSchema,
});
export type SummaryFeed = z.infer<typeof summaryFeedSchema>;

// ---------------------------------------------------------------------------
// Adapters: CLI wire shape -> contracts WorkspaceSummary
// ---------------------------------------------------------------------------

const PACKAGE_MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn', 'bun', 'unknown'];

function toPackageManager(value: string): PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value)
    ? (value as PackageManager)
    : 'unknown';
}

/** Map a canonical check status onto the contract's health-check level. */
function toCheckLevel(status: 'healthy' | 'warning' | 'critical'): HealthCheckLevel {
  if (status === 'critical') return 'fail';
  if (status === 'warning') return 'warn';
  return 'pass';
}

/** Map the canonical overall status onto the contract's tri-state. */
function toHealthStatus(status: 'healthy' | 'degraded' | 'critical'): HealthStatus {
  if (status === 'critical') return 'fail';
  if (status === 'degraded') return 'warn';
  return 'pass';
}

function toHealthCheck(check: SummaryFeed['health']['checks'][number], index: number): HealthCheck {
  return {
    id: `${check.name}-${index}`,
    title: check.name,
    level: toCheckLevel(check.status),
    message: check.message ?? '',
  };
}

function toApp(ws: SummaryFeed['workspaces'][number]): WorkspaceApp {
  return {
    id: ws.path || ws.name,
    name: ws.name,
    type: 'unknown',
    path: ws.path,
    ...(ws.framework ? { framework: ws.framework } : {}),
    scripts: {},
    status: 'unknown',
  };
}

function toService(ws: SummaryFeed['workspaces'][number]): WorkspaceService {
  return {
    id: ws.path || ws.name,
    name: ws.name,
    type: 'unknown',
    path: ws.path,
    ...(ws.framework ? { framework: ws.framework } : {}),
    status: 'unknown',
  };
}

/**
 * Adapt the validated CLI summary feed into the rich contracts
 * {@link WorkspaceSummary}. Apps are the `type: 'app'` workspaces; everything
 * else (package/lib/tool) is treated as a service, matching the CLI's own
 * `buildContractGraph` app/service split.
 */
export function feedToWorkspaceSummary(feed: SummaryFeed): WorkspaceSummary {
  const apps = feed.workspaces.filter((ws) => ws.type === 'app').map(toApp);
  const services = feed.workspaces.filter((ws) => ws.type !== 'app').map(toService);

  return {
    path: feed.root,
    name: feed.root ? feed.root.split('/').filter(Boolean).pop() ?? feed.root : 'workspace',
    packageManager: toPackageManager(feed.packageManager),
    apps,
    services,
    templates: [],
    health: {
      score: feed.health.score,
      status: toHealthStatus(feed.health.status),
      checks: feed.health.checks.map(toHealthCheck),
    },
  };
}

// ---------------------------------------------------------------------------
// health  (`re-shell workspace health --json` → canonical health directly)
// ---------------------------------------------------------------------------

/**
 * Wire shape of `workspace health --json` — the canonical health object emitted
 * directly as the envelope `data` (NOT wrapped in a summary). It differs from the
 * contracts `HealthSummary` (`id`/`title`/`level`, status `pass|warn|fail`), so
 * we validate the real shape here and adapt it.
 */
export const healthFeedSchema = canonicalHealthSchema;
export type HealthFeed = z.infer<typeof healthFeedSchema>;

/** Adapt the canonical health feed into the contracts {@link HealthSummary}. */
export function feedToHealthSummary(feed: HealthFeed): HealthSummary {
  return {
    score: feed.score,
    status: toHealthStatus(feed.status),
    checks: feed.checks.map(toHealthCheck),
  };
}
