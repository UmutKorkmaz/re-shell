import { z } from 'zod';
import {
  healthCheckStatusWireSchema,
  healthCheckWireSchema,
  healthStatusWireSchema,
  healthWireToSummary,
  workspaceHealthWireSchema,
  workspaceInfoWireSchema,
  workspaceSummaryWireSchema,
  workspaceSummaryWireToModel,
  workspaceTypeWireSchema,
  type HealthSummary,
  type WorkspaceSummary,
  type WorkspaceLiveStatus,
  type WorkspaceNodeStatus,
} from '@re-shell/contracts';

export type { HealthSummary };

/**
 * Web-side schema + adapter for `re-shell workspace summary --json`.
 *
 * The CLI emits a NARROW, monorepo-derived summary (`root` / `workspaces` /
 * `graph` / canonical `health`) that does NOT match the rich contracts
 * `WorkspaceSummary` the Overview screen + `WorkspaceSummaryPanel` consume.
 *
 * The EXACT wire shape is `workspaceSummaryWireSchema` in `@re-shell/contracts`
 * (the same schema the CLI conformance suite, the MCP server and the VS Code
 * extension validate against). The feed schemas below are derived from it, so a
 * field renamed in the contract can never silently diverge from what the screens
 * read, and they only add the dashboard's tolerance: a missing optional field
 * degrades to a default instead of failing the whole screen. The wire -> domain
 * mapping is the shared adapter in the contracts package.
 */

// ---------------------------------------------------------------------------
// Wire shape (exactly what the CLI prints), made tolerant for the UI
// ---------------------------------------------------------------------------

/** A discovered workspace as the CLI's `getWorkspaces()` emits it. */
const workspaceInfoSchema = workspaceInfoWireSchema.extend({
  path: z.string().default(''),
  // The CLI also labels `services/*` workspaces "service", which the wire enum does not list. A
  // category the dashboard does not know is shown as a plain package instead of failing the
  // whole Overview (it is not an app either way, so the app/service split is unchanged).
  type: workspaceTypeWireSchema.catch('package').default('package'),
  version: z.string().default('0.0.0'),
  dependencies: z.array(z.string()).default([]),
});

/** One canonical health check (see CLI health-normalizer). */
const canonicalCheckSchema = healthCheckWireSchema.extend({
  status: healthCheckStatusWireSchema.default('healthy'),
});

const canonicalHealthSchema = workspaceHealthWireSchema.extend({
  score: z.number().default(0),
  status: healthStatusWireSchema.default('critical'),
  checks: z.array(canonicalCheckSchema).default([]),
});

/**
 * The full CLI summary envelope payload, validated leniently. `graph` is part of
 * the wire shape but not read by the dashboard, so it is not required here;
 * `packageManager` is a free string that the adapter narrows to the domain enum.
 */
export const summaryFeedSchema = workspaceSummaryWireSchema.omit({ graph: true }).extend({
  root: z.string().default(''),
  packageManager: z.string().default('unknown'),
  workspaces: z.array(workspaceInfoSchema).default([]),
  health: canonicalHealthSchema,
});
export type SummaryFeed = z.infer<typeof summaryFeedSchema>;

// ---------------------------------------------------------------------------
// Adapters: CLI wire shape -> contracts WorkspaceSummary
// ---------------------------------------------------------------------------

/** Live status per workspace name, as reported by `workspace status --json`. */
export type LiveStatusMap = ReadonlyMap<string, WorkspaceLiveStatus>;

/**
 * Map a live status onto the contract's node status. `unhealthy` (running but
 * failing its probes) is the contract's `error`; workspaces with no reported
 * status stay `unknown` rather than being guessed.
 */
export function toNodeStatus(live: WorkspaceLiveStatus | undefined): WorkspaceNodeStatus {
  if (live === 'unhealthy') return 'error';
  if (live === 'running' || live === 'stopped') return live;
  return 'unknown';
}

/**
 * Adapt the validated CLI summary feed into the rich contracts
 * {@link WorkspaceSummary}. Apps are the `type: 'app'` workspaces; everything
 * else (package/lib/tool) is treated as a service, matching the CLI's own
 * `buildContractGraph` app/service split. (Shared adapter: see
 * `workspaceSummaryWireToModel` in `@re-shell/contracts`.)
 *
 * Node `status` comes from `live` (the `workspace.status` poll) when supplied;
 * without it every node is honestly `unknown`.
 */
export function feedToWorkspaceSummary(feed: SummaryFeed, live?: LiveStatusMap): WorkspaceSummary {
  const model = workspaceSummaryWireToModel(feed);
  return {
    ...model,
    apps: model.apps.map((app) => ({ ...app, status: toNodeStatus(live?.get(app.name)) })),
    services: model.services.map((svc) => ({ ...svc, status: toNodeStatus(live?.get(svc.name)) })),
  };
}

// ---------------------------------------------------------------------------
// health  (`re-shell workspace health --json` → canonical health directly)
// ---------------------------------------------------------------------------

/**
 * Wire shape of `workspace health --json` — the canonical health object emitted
 * directly as the envelope `data` (NOT wrapped in a summary). It differs from the
 * contracts domain `HealthSummary` (`id`/`title`/`level`, status `pass|warn|fail`),
 * so we validate the real shape (derived from `workspaceHealthWireSchema`) and
 * adapt it with the shared `healthWireToSummary`.
 */
export const healthFeedSchema = canonicalHealthSchema;
export type HealthFeed = z.infer<typeof healthFeedSchema>;

/** Adapt the canonical health feed into the contracts {@link HealthSummary}. */
export function feedToHealthSummary(feed: HealthFeed): HealthSummary {
  return healthWireToSummary(feed);
}
