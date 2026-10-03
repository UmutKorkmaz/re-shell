import type {
  HealthCheck,
  HealthSummary,
  PackageManager,
  WorkspaceApp,
  WorkspaceService,
  WorkspaceSummary,
} from './schemas.js';
import type {
  HealthCheckStatusWire,
  HealthStatusWire,
} from './wire.js';

// ---------------------------------------------------------------------------
// Adapters: wire payload (./wire.ts) -> domain/UI model (./schemas.ts).
//
// The CLI prints the WIRE shape; React components and the VS Code status bar
// render the DOMAIN shape. These pure functions are the one documented bridge, so
// every consumer maps the CLI vocabulary onto the UI vocabulary the same way:
//
//   health status   healthy | degraded | critical  ->  pass | warn | fail
//   check status    healthy | warning  | critical  ->  pass | warn | fail
//   workspace       { root, workspaces[], health }  ->  WorkspaceSummary
//
// Inputs are minimal structural types, not the full wire types, so a consumer
// that parses the feed leniently (defaults for missing optional fields) can pass
// its own output in without a cast. Validate with the wire schema FIRST; adapters
// do not re-validate.
// ---------------------------------------------------------------------------

/** The slice of a wire health check the adapters read. */
export interface HealthCheckWireInput {
  name: string;
  status: HealthCheckStatusWire;
  message?: string | undefined;
}

/** The slice of a wire health report the adapters read. */
export interface HealthWireInput {
  score: number;
  status: HealthStatusWire;
  checks: ReadonlyArray<HealthCheckWireInput>;
}

/** The slice of a wire workspace the adapters read. */
export interface WorkspaceInfoWireInput {
  name: string;
  path: string;
  type: string;
  framework?: string | undefined;
}

/** The slice of a wire workspace summary the adapters read. */
export interface WorkspaceSummaryWireInput {
  root: string;
  packageManager: string;
  workspaces: ReadonlyArray<WorkspaceInfoWireInput>;
  health: HealthWireInput;
}

const PACKAGE_MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn', 'bun', 'unknown'];

/** Narrow a free-form package-manager string to the domain enum (`unknown` if unrecognised). */
export function toPackageManager(value: string): PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value)
    ? (value as PackageManager)
    : 'unknown';
}

/** Map a wire check status onto the domain health-check level. */
export function checkStatusToLevel(status: HealthCheckStatusWire): HealthCheck['level'] {
  if (status === 'critical') return 'fail';
  if (status === 'warning') return 'warn';
  return 'pass';
}

/** Map the wire overall status onto the domain tri-state. */
export function healthStatusToDomain(status: HealthStatusWire): HealthSummary['status'] {
  if (status === 'critical') return 'fail';
  if (status === 'degraded') return 'warn';
  return 'pass';
}

/**
 * Adapt a wire health report (the `data` of `workspace health --json`, or the
 * `health` member of `workspace summary --json`) into the domain
 * {@link HealthSummary}. The wire carries no check id, so one is synthesised as
 * `<name>-<index>` (stable for a given report); a missing `message` becomes `''`.
 */
export function healthWireToSummary(health: HealthWireInput): HealthSummary {
  return {
    score: health.score,
    status: healthStatusToDomain(health.status),
    checks: health.checks.map(
      (check, index): HealthCheck => ({
        id: `${check.name}-${index}`,
        title: check.name,
        level: checkStatusToLevel(check.status),
        message: check.message ?? '',
      })
    ),
  };
}

function toApp(ws: WorkspaceInfoWireInput): WorkspaceApp {
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

function toService(ws: WorkspaceInfoWireInput): WorkspaceService {
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
 * Adapt a wire workspace summary into the domain {@link WorkspaceSummary}.
 *
 * Apps are the `type: 'app'` workspaces; everything else (package/lib/tool) is a
 * service, mirroring the CLI's own graph projection. Fields the wire does not
 * carry are filled with the domain's "unknown" values: `type`/`status` are
 * `'unknown'`, `scripts` is `{}` and `templates` is `[]`. `name` is the last
 * segment of `root`, or `'workspace'` when `root` is empty.
 */
export function workspaceSummaryWireToModel(summary: WorkspaceSummaryWireInput): WorkspaceSummary {
  const lastSegment = summary.root.split(/[\\/]+/).filter(Boolean).pop();
  return {
    path: summary.root,
    name: summary.root ? (lastSegment ?? summary.root) : 'workspace',
    packageManager: toPackageManager(summary.packageManager),
    apps: summary.workspaces.filter((ws) => ws.type === 'app').map(toApp),
    services: summary.workspaces.filter((ws) => ws.type !== 'app').map(toService),
    templates: [],
    health: healthWireToSummary(summary.health),
  };
}
