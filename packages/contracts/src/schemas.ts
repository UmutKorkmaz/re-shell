import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const packageManagerSchema = z.enum(['pnpm', 'npm', 'yarn', 'bun', 'unknown']);
export type PackageManager = z.infer<typeof packageManagerSchema>;

export const workspaceNodeStatusSchema = z.enum(['unknown', 'stopped', 'running', 'error']);
export type WorkspaceNodeStatus = z.infer<typeof workspaceNodeStatusSchema>;

export const workspaceAppTypeSchema = z.enum(['frontend', 'microfrontend', 'shell', 'unknown']);
export type WorkspaceAppType = z.infer<typeof workspaceAppTypeSchema>;

export const workspaceServiceTypeSchema = z.enum([
  'api',
  'worker',
  'database',
  'cache',
  'queue',
  'unknown',
]);
export type WorkspaceServiceType = z.infer<typeof workspaceServiceTypeSchema>;

export const templateDomainSchema = z.enum(['frontend', 'backend', 'infrastructure']);
export type TemplateDomain = z.infer<typeof templateDomainSchema>;

export const healthStatusSchema = z.enum(['pass', 'warn', 'fail']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthCheckLevelSchema = z.enum(['pass', 'warn', 'fail', 'info']);
export type HealthCheckLevel = z.infer<typeof healthCheckLevelSchema>;

export const jobStatusSchema = z.enum(['queued', 'running', 'success', 'failed', 'cancelled']);
export type JobStatus = z.infer<typeof jobStatusSchema>;

// ---------------------------------------------------------------------------
// Workspace types
// ---------------------------------------------------------------------------

export const gitSummarySchema = z.object({
  branch: z.string(),
  dirty: z.boolean(),
  ahead: z.number().optional(),
  behind: z.number().optional(),
});
export type GitSummary = z.infer<typeof gitSummarySchema>;

export const workspaceAppSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: workspaceAppTypeSchema,
  path: z.string(),
  framework: z.string().optional(),
  port: z.number().optional(),
  scripts: z.record(z.string(), z.string()),
  status: workspaceNodeStatusSchema,
});
export type WorkspaceApp = z.infer<typeof workspaceAppSchema>;

export const workspaceServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: workspaceServiceTypeSchema,
  path: z.string(),
  framework: z.string().optional(),
  port: z.number().optional(),
  healthUrl: z.string().optional(),
  status: workspaceNodeStatusSchema,
});
export type WorkspaceService = z.infer<typeof workspaceServiceSchema>;

export const templateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  domain: templateDomainSchema,
  language: z.string(),
  framework: z.string(),
  tier: z.number().optional(),
  tags: z.array(z.string()),
  command: z.array(z.string()),
  database: z.string().optional(),
});
export type TemplateSummary = z.infer<typeof templateSummarySchema>;

export const healthCheckSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: healthCheckLevelSchema,
  message: z.string(),
});
export type HealthCheck = z.infer<typeof healthCheckSchema>;

export const healthSummarySchema = z.object({
  score: z.number(),
  status: healthStatusSchema,
  checks: z.array(healthCheckSchema),
});
export type HealthSummary = z.infer<typeof healthSummarySchema>;

// ---------------------------------------------------------------------------
// Remediation / suggestion types
//
// Emitted by `doctor --explain` / `workspace health --explain`. Each failing or
// warning health check is mapped to a plain-language cause and a concrete,
// actionable suggestion. When `fixable` is true, `fixCommand` carries an
// allow-listed shell command the `--fix` planner may compose into a dry-run plan.
// ---------------------------------------------------------------------------

export const suggestionSchema = z.object({
  // The health check id/code this suggestion remediates (e.g. "security-audit").
  checkId: z.string(),
  // Plain-language explanation of why the check failed.
  cause: z.string(),
  // Concrete next step: a command to run or an edit to make.
  suggestion: z.string(),
  // Whether `doctor --fix` can apply this automatically.
  fixable: z.boolean(),
  // Allow-listed shell command to run when applying the fix. Present only when
  // `fixable` is true and the fix is a command (edits carry no fixCommand).
  fixCommand: z.string().optional(),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

// A single step in a fix plan. `command` is the allow-listed shell command the
// step would run (empty for edit-only steps). `apply` reflects whether the step
// was actually executed (false in the default dry-run path).
export const fixPlanStepSchema = z.object({
  checkId: z.string(),
  description: z.string(),
  command: z.string().optional(),
  applied: z.boolean(),
});
export type FixPlanStep = z.infer<typeof fixPlanStepSchema>;

export const fixPlanSchema = z.object({
  // True when steps were actually executed; false for the default dry-run plan.
  applied: z.boolean(),
  steps: z.array(fixPlanStepSchema),
});
export type FixPlan = z.infer<typeof fixPlanSchema>;

export const workspaceSummarySchema = z.object({
  path: z.string(),
  name: z.string(),
  packageManager: packageManagerSchema,
  nodeVersion: z.string().optional(),
  git: gitSummarySchema.optional(),
  apps: z.array(workspaceAppSchema),
  services: z.array(workspaceServiceSchema),
  templates: z.array(templateSummarySchema),
  health: healthSummarySchema,
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export const jobRecordSchema = z.object({
  id: z.string(),
  commandId: z.string(),
  command: z.array(z.string()),
  cwd: z.string(),
  status: jobStatusSchema,
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  exitCode: z.number().optional(),
});
export type JobRecord = z.infer<typeof jobRecordSchema>;

// ---------------------------------------------------------------------------
// Command spec
// ---------------------------------------------------------------------------

export const commandSpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  command: z.array(z.string()),
  cwd: z.string(),
  dryRunSupported: z.boolean(),
  destructive: z.boolean(),
  requiresConfirmation: z.boolean(),
});
export type CommandSpec = z.infer<typeof commandSpecSchema>;

/**
 * Input shape for building a {@link CommandSpec}.
 *
 * It mirrors every {@link CommandSpec} field and adds an optional, derivable
 * `commandText` (a pre-rendered shell string). Builders accept it as optional
 * and fill it in from `command` when omitted, so the field is intentional —
 * not the no-op `Omit` it used to be.
 */
export const commandSpecInputSchema = commandSpecSchema.extend({
  commandText: z.string().optional(),
});
export type CommandSpecInput = z.infer<typeof commandSpecInputSchema>;

// ---------------------------------------------------------------------------
// Find / search results
//
// `re-shell find "<query>"` performs an offline, deterministic search across
// the command catalogue and the template registry. Each hit is a
// {@link FindResult}; the command returns a {@link FindResponse}. Authored as
// zod so the CLI and any UI consuming `find --json` validate one shape.
// ---------------------------------------------------------------------------

export const findResultTypeSchema = z.enum(['command', 'template']);
export type FindResultType = z.infer<typeof findResultTypeSchema>;

/**
 * A single ranked search hit. `score` is a normalised relevance in [0, 1].
 * `matched` lists the query terms that contributed to the score (explainability).
 * `usage` is present for commands (the invocation string), `path` for templates
 * is omitted — templates carry no filesystem path, so the optional `path` field
 * exists for forward-compatibility and is left unset by the current emitters.
 */
export const findResultSchema = z.object({
  type: findResultTypeSchema,
  id: z.string(),
  title: z.string(),
  score: z.number(),
  matched: z.array(z.string()),
  usage: z.string().optional(),
  path: z.string().optional(),
});
export type FindResult = z.infer<typeof findResultSchema>;

/**
 * Envelope payload for `find --json`: the ranked result list plus the echoed
 * query and the requested limit, so consumers can render context without
 * re-parsing argv.
 */
export const findResponseSchema = z.object({
  query: z.string(),
  limit: z.number(),
  results: z.array(findResultSchema),
});
export type FindResponse = z.infer<typeof findResponseSchema>;

// ---------------------------------------------------------------------------
// Template recommendations
//
// `re-shell templates recommend "<query>"` ranks the TEMPLATE-only corpus with
// the same offline ranker `find` uses, then attaches a deterministic, offline
// `rationale` derived from the matched query terms plus the template's
// language/framework/category. It is a focused, explainable flavour of `find`
// scoped to templates, so it gets its own result shape rather than overloading
// {@link FindResult}: every recommendation carries a rationale and the metadata
// fields the rationale is built from.
// ---------------------------------------------------------------------------

/**
 * A single ranked template recommendation. `score` is a normalised relevance in
 * [0, 1] (identical scale to {@link FindResult}); `matched` lists the query
 * terms that contributed (explainability); `rationale` is a human-readable,
 * deterministic, offline sentence explaining *why* this template was suggested.
 * `language`/`framework`/`category` are the registry metadata the rationale is
 * derived from, exposed so consumers can render or re-derive it without a lookup.
 */
export const templateRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  score: z.number(),
  rationale: z.string(),
  matched: z.array(z.string()),
  language: z.string().optional(),
  framework: z.string().optional(),
  category: z.string().optional(),
});
export type TemplateRecommendation = z.infer<typeof templateRecommendationSchema>;

/**
 * Envelope payload for `templates recommend --json`: the ranked recommendation
 * list plus the echoed query and requested limit, mirroring {@link FindResponse}
 * so consumers can render context without re-parsing argv.
 */
export const recommendResponseSchema = z.object({
  query: z.string(),
  limit: z.number(),
  results: z.array(templateRecommendationSchema),
});
export type RecommendResponse = z.infer<typeof recommendResponseSchema>;

// ---------------------------------------------------------------------------
// AI scaffold plan
//
// `re-shell ai create "<description>"` turns a free-text project description
// into a REVIEWABLE, dry-run-by-default PLAN of REAL re-shell commands. The
// description is parsed OFFLINE + deterministically into a structured intent
// (frontend framework, backend services, datastores, infra), each slot is
// resolved to a REAL template id via the same ranker `find`/`recommend` use,
// and the plan is composed from commands/flags that actually exist
// (`create`, `generate backend|service`, `k8s generate`).
//
// The shape mirrors the {@link FixPlan} discipline (a dry-run-first plan of
// ordered steps with an `applied` flag) so consumers that already render fix
// plans can render scaffold plans without new machinery. It gets its own shape
// rather than overloading FixPlan because every scaffold step is a structured
// argv (not an allow-listed shell string) and may carry the resolved template
// id + a "why" rationale for explainability.
// ---------------------------------------------------------------------------

/**
 * A single resolved intent slot: one component the description asked for, mapped
 * to a REAL template/framework id by the offline ranker. `kind` is the role the
 * component plays; `id` is the resolved REAL id; `matched` lists the description
 * terms that drove the match (explainability); `score` is the ranker relevance.
 */
export const scaffoldIntentSlotSchema = z.object({
  kind: z.enum(['frontend', 'backend', 'datastore', 'infra']),
  // The raw phrase from the description that triggered this slot.
  term: z.string(),
  // The resolved REAL template id / framework id (never an invented value).
  id: z.string(),
  // Human title for the resolved template (registry display name or id).
  title: z.string(),
  score: z.number(),
  matched: z.array(z.string()),
});
export type ScaffoldIntentSlot = z.infer<typeof scaffoldIntentSlotSchema>;

/**
 * The structured intent extracted from the description: the model of what the
 * user asked for, before it is composed into commands. Every slot references a
 * REAL id; unresolvable mentions are dropped, never fabricated.
 */
export const scaffoldIntentSchema = z.object({
  // Echoed, normalised description the intent was extracted from.
  description: z.string(),
  // Project name slug derived from the description (safe identifier charset).
  projectName: z.string(),
  // At most one frontend framework slot (the shell app's framework).
  frontend: scaffoldIntentSlotSchema.optional(),
  // Zero or more backend service slots.
  backends: z.array(scaffoldIntentSlotSchema),
  // Zero or more datastore slots.
  datastores: z.array(scaffoldIntentSlotSchema),
  // Zero or more infra slots (k8s/helm/gitops).
  infra: z.array(scaffoldIntentSlotSchema),
});
export type ScaffoldIntent = z.infer<typeof scaffoldIntentSchema>;

/**
 * A single step in a scaffold plan. `command` is the ordered argv the step would
 * run (the binary `re-shell` is implicit and NOT included), every token of which
 * originates from a real command/flag or a sanitised value slot. `template` is
 * the REAL resolved id the step scaffolds (absent for infra steps). `why`
 * explains the step. `applied` reflects whether it actually ran (false on the
 * default dry-run path).
 */
export const scaffoldPlanStepSchema = z.object({
  command: z.array(z.string()),
  description: z.string(),
  template: z.string().optional(),
  why: z.string().optional(),
  applied: z.boolean(),
});
export type ScaffoldPlanStep = z.infer<typeof scaffoldPlanStepSchema>;

/**
 * A full, reviewable scaffold plan. `applied` is false for the default dry-run
 * plan and true only when `--yes` actually executed the steps. `resolved` is the
 * flat list of every resolved template id surfaced for quick inspection.
 */
export const scaffoldPlanSchema = z.object({
  applied: z.boolean(),
  steps: z.array(scaffoldPlanStepSchema),
  // The flat list of REAL resolved template/framework ids this plan references.
  resolved: z.array(z.string()),
});
export type ScaffoldPlan = z.infer<typeof scaffoldPlanSchema>;

/**
 * Envelope payload for `ai create --json`: the extracted intent plus the
 * composed plan. Consumers render the plan and, on the dry-run path, the
 * `intent` model that produced it.
 */
export const aiPlanResponseSchema = z.object({
  intent: scaffoldIntentSchema,
  plan: scaffoldPlanSchema,
});
export type AiPlanResponse = z.infer<typeof aiPlanResponseSchema>;

// ---------------------------------------------------------------------------
// Agent-readiness docs
//
// `re-shell agents init|sync|check` make a repo "agent-ready by construction":
// they generate a ROOT AGENTS.md, PER-PACKAGE AGENTS.md, and an llms.txt-style
// machine index from the workspace graph + each package's scripts + the command
// catalogue. The generator is PURE (no I/O): the command layer discovers the
// workspace on disk, feeds the surface to the generator, then writes/compares
// the returned files. These schemas describe the --json shapes for `init`/`sync`
// (which files were written) and `check` (the drift report for CI).
// ---------------------------------------------------------------------------

/**
 * A single generated agent-doc artifact. `path` is repo-relative (e.g.
 * "AGENTS.md", "packages/cli/AGENTS.md", "llms.txt"); `kind` is its role.
 * `bytes` is the UTF-8 byte length of the freshly-generated content.
 */
export const agentsDocFileSchema = z.object({
  path: z.string(),
  kind: z.enum(['root', 'package', 'index']),
  bytes: z.number(),
});
export type AgentsDocFile = z.infer<typeof agentsDocFileSchema>;

/**
 * Envelope payload for `agents init --json` / `agents sync --json`: the list of
 * files written (or that would be written) plus whether they were actually
 * persisted. `written` is true once the files hit disk; the generator itself is
 * pure, so consumers can render the plan before anything is touched.
 */
export const agentsDocResponseSchema = z.object({
  // Always true: there is no dry-run path; files are always written to disk.
  written: z.literal(true),
  files: z.array(agentsDocFileSchema),
});
export type AgentsDocResponse = z.infer<typeof agentsDocResponseSchema>;

/**
 * A single drift entry from `agents check`: one artifact whose on-disk content
 * does not byte-match the freshly-generated content. `reason` distinguishes a
 * missing file from a stale (content-mismatch) one, so CI logs are actionable.
 */
export const agentsDriftFileSchema = z.object({
  path: z.string(),
  kind: z.enum(['root', 'package', 'index']),
  reason: z.enum(['missing', 'stale']),
});
export type AgentsDriftFile = z.infer<typeof agentsDriftFileSchema>;

/**
 * Envelope payload for `agents check --json`: the drift report for CI. `drift`
 * is true when any expected artifact is missing or stale; `files` enumerates
 * exactly which ones (empty when in sync). `checked` is the total number of
 * expected artifacts compared.
 */
export const agentsCheckResponseSchema = z.object({
  drift: z.boolean(),
  checked: z.number(),
  files: z.array(agentsDriftFileSchema),
});
export type AgentsCheckResponse = z.infer<typeof agentsCheckResponseSchema>;

// ---------------------------------------------------------------------------
// SSE / WS wire messages
//
// Authored as zod schemas so both the hub (emit side) and the browser clients
// (consume side) validate against the exact same shape. The TS types are
// derived via `z.infer`, so the validators and types cannot drift.
// ---------------------------------------------------------------------------

/**
 * A single SSE event written to the `/events` stream. `content` carries a chunk
 * of stdout/stderr (which may be a partial line or partial JSON document, hence
 * client-side reassembly). `code` is always a number on `exit` (never undefined).
 */
export const sseEventSchema = z.object({
  type: z.enum(['stdout', 'stderr', 'exit', 'error', 'heartbeat']),
  content: z.string().optional(),
  code: z.number().optional(),
  message: z.string().optional(),
  id: z.string().optional(),
  ts: z.string().optional(),
});
export type SseEvent = z.infer<typeof sseEventSchema>;

/**
 * A message sent FROM the browser client TO the hub over the `/jobs` WebSocket.
 * Browsers may only ever supply a stable `commandId` + opaque `params`; never a
 * raw command/argv. The hub resolves these against its allow-listed registry.
 */
export const wsClientMessageSchema = z.object({
  type: z.enum(['start', 'cancel']),
  id: z.string(),
  commandId: z.string().optional(),
  params: z.unknown().optional(),
});
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

/**
 * A message sent FROM the hub TO the browser client over the `/jobs` WebSocket.
 * Mirrors {@link SseEvent} but is keyed per job via `id`.
 */
export const wsServerMessageSchema = z.object({
  type: z.enum(['stdout', 'stderr', 'exit', 'heartbeat', 'error']),
  id: z.string().optional(),
  content: z.string().optional(),
  code: z.number().optional(),
  message: z.string().optional(),
  ts: z.string().optional(),
});
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;

/**
 * Configuration handed to the hub server at launch.
 */
export const hubServerConfigSchema = z.object({
  port: z.number(),
  workspace: z.string(),
  cliBin: z.string(),
});
export type HubServerConfig = z.infer<typeof hubServerConfigSchema>;

// ---------------------------------------------------------------------------
// Task runner (`re-shell run <task>`)
//
// The workspace config may carry an optional `tasks` section mapping a task
// name (e.g. "build", "test") to its dependencies. A dependency string is one
// of two forms:
//   - "build"   — a sibling task in the SAME package (intra-package edge),
//   - "^build"  — the same task name on this package's workspace DEPENDENCIES
//                 (upstream-package edge: run upstream's `build` first).
// When no config is present the runner falls back to sensible defaults
// (build -> ^build; test -> build), so a bare monorepo still gets correct
// dependency-aware ordering without authoring any config.
// ---------------------------------------------------------------------------

/**
 * Per-task dependency declaration plus optional content-addressed cache hints.
 *
 *   - `dependsOn` entries are either a sibling task name (intra-package) or a
 *     `^`-prefixed task name (the same edge applied to every upstream workspace
 *     dependency of the package).
 *   - `inputs` is an optional list of globs (relative to the package dir) that
 *     define the file set hashed into the cache key. When omitted the runner
 *     hashes the whole package dir minus declared outputs/node_modules.
 *   - `outputs` is an optional list of globs (relative to the package dir) that
 *     define the artifacts captured on a cache MISS and restored on a HIT.
 */
export const taskConfigSchema = z.object({
  dependsOn: z.array(z.string()).optional(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
});
export type TaskConfig = z.infer<typeof taskConfigSchema>;

/**
 * The optional `tasks` map: task name -> {@link TaskConfig}. Authored in the
 * workspace config; consumed by the scheduler to build the execution DAG.
 */
export const tasksConfigSchema = z.record(z.string(), taskConfigSchema);
export type TasksConfig = z.infer<typeof tasksConfigSchema>;

/**
 * Terminal status of a single (package, task) execution.
 *   - "success" — the script ran and exited 0,
 *   - "failed"  — the script ran and exited non-zero (or could not be spawned),
 *   - "skipped" — the package does not define that task script, OR an upstream
 *                 dependency failed and the runner did not reach this node.
 *   - "cached"  — a content-addressed cache HIT: the declared outputs were
 *                 restored from the cache and the script was NOT spawned.
 */
export const taskRunStatusSchema = z.enum([
  'success',
  'failed',
  'skipped',
  'cached',
]);
export type TaskRunStatus = z.infer<typeof taskRunStatusSchema>;

/**
 * Result of one scheduled (package, task) node. `exitCode` is the child
 * process exit code (null when the node was skipped and never spawned).
 */
export const taskRunResultSchema = z.object({
  package: z.string(),
  task: z.string(),
  status: taskRunStatusSchema,
  exitCode: z.number().nullable(),
  durationMs: z.number(),
});
export type TaskRunResult = z.infer<typeof taskRunResultSchema>;

/**
 * Envelope payload for `re-shell run <task> --json`: the per-node results plus
 * the resolved concurrency and, when `--affected` was used, the changed-set the
 * targets were scoped to.
 */
export const runResponseSchema = z.object({
  task: z.string(),
  concurrency: z.number(),
  results: z.array(taskRunResultSchema),
  affected: z.array(z.string()).optional(),
});
export type RunResponse = z.infer<typeof runResponseSchema>;

// ---------------------------------------------------------------------------
// Build cache (`re-shell cache stats|clean`)
//
// The content-addressed build cache stores one record per (package,task) cache
// KEY: an exit code, the list of captured output files, and the captured logs,
// alongside the signed output artifacts. These schemas describe the
// command-layer envelope payloads only; the on-disk record format lives in the
// CLI's cache-store implementation.
// ---------------------------------------------------------------------------

/**
 * Envelope payload for `re-shell cache stats --json`: a point-in-time view of
 * the local cache store. `hitRate` is null when no run has recorded any
 * hit/miss telemetry yet (so the consumer can distinguish "0%" from "unknown").
 */
export const cacheStatsResponseSchema = z.object({
  /** Absolute path to the active cache directory. */
  location: z.string(),
  /** Number of cached (package,task) entries. */
  entries: z.number(),
  /** Total size of all cached artifacts + records, in bytes. */
  sizeBytes: z.number(),
  /** Cumulative recorded cache hits across runs (telemetry). */
  hits: z.number(),
  /** Cumulative recorded cache misses across runs (telemetry). */
  misses: z.number(),
  /** hits / (hits + misses) in [0,1], or null when no telemetry recorded. */
  hitRate: z.number().nullable(),
});
export type CacheStatsResponse = z.infer<typeof cacheStatsResponseSchema>;

/**
 * Envelope payload for `re-shell cache clean --json`: what the prune removed.
 */
export const cacheCleanResponseSchema = z.object({
  /** Absolute path to the cache directory that was pruned. */
  location: z.string(),
  /** Number of entries removed. */
  removedEntries: z.number(),
  /** Bytes reclaimed by the prune. */
  reclaimedBytes: z.number(),
});
export type CacheCleanResponse = z.infer<typeof cacheCleanResponseSchema>;

// ---------------------------------------------------------------------------
// Skaffold-backed k8s inner-loop dev runtime (`re-shell dev --cluster`)
//
// The CLI generates a Skaffold config from the workspace graph and drives the
// inner development loop (build-watch + in-cluster file-sync + port-forwards).
// All cluster/skaffold operations go through an injectable backend; these
// schemas describe ONLY the offline, deterministic config + plan envelope that
// `--dry-run --json` emits (and that the dashboard reads for status). No live
// cluster is required to produce or validate them.
// ---------------------------------------------------------------------------

/**
 * One file-sync rule for a Skaffold artifact: edits matching `src` are copied
 * straight into the running container at `dest` WITHOUT a rebuild, which is the
 * core of the fast inner loop. `src` is a glob relative to the artifact context.
 */
export const devClusterSyncRuleSchema = z.object({
  /** Glob (relative to the artifact context) selecting files to sync. */
  src: z.string(),
  /** Destination directory inside the running container. */
  dest: z.string(),
});
export type DevClusterSyncRule = z.infer<typeof devClusterSyncRuleSchema>;

/**
 * A single buildable artifact in the generated Skaffold config — one per
 * workspace service. `image` is the local dev image name, `context` the build
 * context (the service directory), and `sync` the inner-loop file-sync rules.
 */
export const devClusterArtifactSchema = z.object({
  /** Owning workspace service name (the graph key). */
  service: z.string(),
  /** Local dev image name Skaffold builds and the manifests reference. */
  image: z.string(),
  /** Build context directory, relative to the workspace root. */
  context: z.string(),
  /** Dockerfile path relative to `context`. */
  dockerfile: z.string(),
  /** In-cluster file-sync rules driving the no-rebuild fast path. */
  sync: z.array(devClusterSyncRuleSchema),
});
export type DevClusterArtifact = z.infer<typeof devClusterArtifactSchema>;

/**
 * A generated port-forward: maps a local port to a service's container port so
 * the developer can reach the in-cluster service from localhost.
 */
export const devClusterPortForwardSchema = z.object({
  /** Service the forward targets. */
  service: z.string(),
  /** Kubernetes resource type (always "service" for the generated forwards). */
  resourceType: z.literal('service'),
  /** In-cluster container/service port. */
  port: z.number(),
  /** Local port bound on the developer's machine. */
  localPort: z.number(),
});
export type DevClusterPortForward = z.infer<typeof devClusterPortForwardSchema>;

/**
 * The generated, offline Skaffold dev config: artifacts (one per service),
 * port-forwards, and the manifest globs Skaffold deploys. This is pure data —
 * producing it never touches a cluster, skaffold, or the network.
 */
export const devClusterConfigSchema = z.object({
  /** Skaffold config apiVersion the generator targets. */
  apiVersion: z.string(),
  /** Always "Config" for a Skaffold config document. */
  kind: z.literal('Config'),
  /** Target Kubernetes namespace for the dev deploy. */
  namespace: z.string(),
  /** One build artifact per service. */
  artifacts: z.array(devClusterArtifactSchema),
  /** Kubernetes manifest globs Skaffold applies on deploy. */
  manifests: z.array(z.string()),
  /** Generated port-forwards for local access. */
  portForwards: z.array(devClusterPortForwardSchema),
});
export type DevClusterConfig = z.infer<typeof devClusterConfigSchema>;

/**
 * The plan `re-shell dev --cluster --dry-run` would execute: which services are
 * in scope, the affected-set the scope was derived from (when `--filter` or
 * affected-scoping narrowed it), and whether the run is a dry-run. `dryRun` is
 * true for any `--dry-run` invocation; the cluster is never touched in that case.
 */
export const devClusterPlanSchema = z.object({
  /** Services that would be built/deployed/watched, in stable order. */
  services: z.array(z.string()),
  /**
   * The changed/requested set the in-scope services were derived from, when
   * scoping was applied (filter or affected). Omitted for a full-workspace run.
   */
  affected: z.array(z.string()).optional(),
  /** True when no cluster/skaffold action will be taken. */
  dryRun: z.boolean(),
});
export type DevClusterPlan = z.infer<typeof devClusterPlanSchema>;

/**
 * Envelope payload for `re-shell dev --cluster --dry-run --json`: the generated
 * Skaffold config plus the execution plan. Validating this requires no cluster.
 */
export const devClusterResponseSchema = z.object({
  config: devClusterConfigSchema,
  plan: devClusterPlanSchema,
});
export type DevClusterResponse = z.infer<typeof devClusterResponseSchema>;

// ---------------------------------------------------------------------------
// scorecard  (`re-shell scorecard [--json] [--threshold n]`)  — issue #12
//
// A weighted production-readiness score computed over EXISTING signals
// (workspace health, policy-pack evaluation, dependency drift) plus per-service
// build/test/health-endpoint presence. Every dimension is normalised to 0-100,
// weighted, and summed into a per-service total with a letter grade; the
// monorepo rollup averages the per-service totals. Producing the score is pure
// data — it never touches a cluster or the network.
// ---------------------------------------------------------------------------

/** Letter grade derived from a 0-100 score (A best, F worst). */
export const scorecardGradeSchema = z.enum(['A', 'B', 'C', 'D', 'F']);
export type ScorecardGrade = z.infer<typeof scorecardGradeSchema>;

/**
 * One weighted dimension of a service's scorecard: a normalised 0-100 `score`,
 * its `weight` in the rollup (weights sum to 1.0), the `weighted` contribution
 * (score * weight), whether it `pass`es its threshold, and an optional human
 * `detail` (e.g. "not-applicable" when a signal does not apply to the workspace).
 */
export const scorecardDimensionSchema = z.object({
  /** Stable dimension id (e.g. "health", "policy", "has-build"). */
  id: z.string(),
  /** Human-readable dimension label. */
  label: z.string(),
  /** Weight of this dimension in the rollup (0-1; all weights sum to 1.0). */
  weight: z.number(),
  /** Normalised dimension score, 0-100. */
  score: z.number(),
  /** Weighted contribution to the total (score * weight). */
  weighted: z.number(),
  /** True when the dimension meets its pass threshold. */
  pass: z.boolean(),
  /** Optional human explanation (e.g. why a dimension is not-applicable). */
  detail: z.string().optional(),
});
export type ScorecardDimension = z.infer<typeof scorecardDimensionSchema>;

/**
 * A single service's production-readiness scorecard: its weighted `totalScore`
 * (0-100), the derived letter `grade`, the per-dimension breakdown, and any
 * service-scoped `warnings` surfaced while scoring.
 */
export const scorecardServiceSchema = z.object({
  /** Workspace service name (the graph key). */
  service: z.string(),
  /** Service directory path (relative to the workspace root), or "". */
  path: z.string(),
  /** Weighted total score across all dimensions, 0-100. */
  totalScore: z.number(),
  /** Letter grade derived from `totalScore`. */
  grade: scorecardGradeSchema,
  /** Per-dimension breakdown driving the total. */
  dimensions: z.array(scorecardDimensionSchema),
  /** Service-scoped warnings (e.g. degraded signal sources). */
  warnings: z.array(z.string()),
});
export type ScorecardService = z.infer<typeof scorecardServiceSchema>;

/**
 * Envelope payload for `re-shell scorecard --json`: the monorepo rollup
 * `score` (average of per-service totals) and `grade`, the `threshold` the
 * rollup is gated against, whether it `pass`es, the per-service scorecards, and
 * the shared monorepo signal context (drift entry count, policy score) plus any
 * rollup-level `warnings`. When `pass` is false the command still emits this
 * payload (ok:true) AND exits non-zero — the gate is advisory data, not an error.
 */
export const scorecardResponseSchema = z.object({
  /** Monorepo rollup score (average of per-service totals), 0-100. */
  score: z.number(),
  /** Letter grade derived from the rollup `score`. */
  grade: scorecardGradeSchema,
  /** Threshold the rollup score is gated against. */
  threshold: z.number(),
  /** True when `score >= threshold`. */
  pass: z.boolean(),
  /** Per-service scorecards. */
  services: z.array(scorecardServiceSchema),
  /** Number of drifting dependencies detected across the monorepo. */
  driftEntries: z.number(),
  /** Monorepo policy-pack score, 0-100. */
  policyScore: z.number(),
  /** Rollup-level warnings (e.g. degraded signals, gate failure, no services). */
  warnings: z.array(z.string()),
});
export type ScorecardResponse = z.infer<typeof scorecardResponseSchema>;

// ---------------------------------------------------------------------------
// release  (`re-shell release [--json] [--no-dry-run] [--publish] [--bump l]`)
//   — issue #9
//
// Graph-aware semantic-version bump propagation across internal workspace
// dependencies. The set of CHANGED packages (since a git ref) is bumped at the
// requested level; their transitive internal DEPENDENTS are bumped `patch` with
// reason `dependent` (unless a dependent is itself changed with a higher bump).
// The command writes bumped manifests + a CHANGELOG fragment + annotated git
// tags only under `--no-dry-run`; registry publish runs only under BOTH
// `--no-dry-run` AND `--publish`. Computing the plan is pure data and never
// touches git or the network.
// ---------------------------------------------------------------------------

/** Semantic-version bump level applied to a releasable unit. */
export const releaseBumpLevelSchema = z.enum(['major', 'minor', 'patch']);
export type ReleaseBumpLevel = z.infer<typeof releaseBumpLevelSchema>;

/**
 * Why a unit is in the release plan: `changed` (a file under it changed since
 * the base ref) or `dependent` (a transitive internal dependent of a changed
 * unit, propagated a `patch`).
 */
export const releaseReasonSchema = z.enum(['changed', 'dependent']);
export type ReleaseReason = z.infer<typeof releaseReasonSchema>;

/**
 * One unit's entry in the release plan: its identity + detected manifest type +
 * current version, the computed `nextVersion`/`bumpLevel`/`reason`, the rendered
 * markdown `changelogEntry`, the target `registry`, and whether it was actually
 * `published` (always false on the dry-run path and when `--publish` is absent).
 */
export const releaseUnitPlanSchema = z.object({
  /** Package name (the graph key). */
  name: z.string(),
  /** Package directory path (relative to the workspace root), or "". */
  path: z.string(),
  /** Detected language (e.g. "typescript", "rust"). */
  language: z.string(),
  /** Detected manifest type (e.g. "package.json", "Cargo.toml"). */
  manifestType: z.string(),
  /** Current version read from the manifest. */
  currentVersion: z.string(),
  /** Computed next version after the bump. */
  nextVersion: z.string(),
  /** Bump level applied to reach `nextVersion`. */
  bumpLevel: releaseBumpLevelSchema,
  /** Why this unit is in the plan. */
  reason: releaseReasonSchema,
  /** Rendered markdown changelog fragment for this unit. */
  changelogEntry: z.string(),
  /** Target registry the unit publishes to (e.g. "npm", "crates.io"). */
  registry: z.string(),
  /** True only when the unit was actually published to its registry. */
  published: z.boolean(),
});
export type ReleaseUnitPlan = z.infer<typeof releaseUnitPlanSchema>;

/**
 * Envelope payload for `re-shell release --json`: whether the run was a
 * `dryRun` (the safe default), the per-unit release plan, and any `warnings`
 * surfaced while planning/applying (unknown registries, skipped units, etc).
 */
export const releaseResponseSchema = z.object({
  /** True when nothing was written, tagged, or published (the safe default). */
  dryRun: z.boolean(),
  /** Per-unit release plan. */
  units: z.array(releaseUnitPlanSchema),
  /** Plan/apply-level warnings. */
  warnings: z.array(z.string()),
});
export type ReleaseResponse = z.infer<typeof releaseResponseSchema>;

// ---------------------------------------------------------------------------
// migrate  (`re-shell migrate [<to-version>] [--json] [--no-dry-run] [--filter]`)
//   — issue #10
//
// A version-scoped migration/codemod engine. It selects the recipes whose
// `fromVersionRange` satisfies the workspace's current version and whose
// `toVersion` is at or below the requested target, resolves their concrete
// target files across the discovered packages in dependency-graph (topological)
// order, and either LISTS them for review (the safe default, dry-run) or APPLIES
// them — rewriting each outdated config/YAML scaffold to the new schema after
// writing a `.bak` backup. Source transforms (ast-grep kind) are gated behind an
// injectable runner and degrade to `skipped` when ast-grep is not installed.
// Computing the plan is pure data and never touches disk or the network.
// ---------------------------------------------------------------------------

/** The transform mechanism a migration recipe uses against its target file. */
export const migrationKindSchema = z.enum(['config', 'yaml', 'json', 'ast-grep']);
export type MigrationKind = z.infer<typeof migrationKindSchema>;

/**
 * Terminal status of a single migration descriptor:
 *   - "pending" — listed for review; nothing applied (the dry-run default),
 *   - "applied" — the transform was written to every resolved target,
 *   - "skipped" — intentionally not applied (e.g. ast-grep not installed),
 *   - "failed"  — applying the transform raised an error.
 */
export const migrationStatusSchema = z.enum([
  'pending',
  'applied',
  'skipped',
  'failed',
]);
export type MigrationStatus = z.infer<typeof migrationStatusSchema>;

/**
 * One migration in the plan: its identity + the version window it bridges, the
 * transform `kind`, a human title/description, the concrete resolved `targets`
 * (repo-relative file paths in DEPENDENCY-GRAPH/topological order so deps are
 * migrated before dependents), and its terminal `status`/`applied` flag.
 */
export const migrationDescriptorSchema = z.object({
  /** Stable recipe id (e.g. "workspace-v1-to-v2"). */
  id: z.string(),
  /** The workspace version the migration applies from. */
  fromVersion: z.string(),
  /** The version the migration brings the workspace to. */
  toVersion: z.string(),
  /** Transform mechanism. */
  kind: migrationKindSchema,
  /** Short human title. */
  title: z.string(),
  /** Human description of what the migration does. */
  description: z.string(),
  /** Resolved target file paths, ordered deps-before-dependents (topological). */
  targets: z.array(z.string()),
  /** Terminal status. */
  status: migrationStatusSchema,
  /** True only when the transform was actually written to disk. */
  applied: z.boolean(),
});
export type MigrationDescriptor = z.infer<typeof migrationDescriptorSchema>;

/**
 * Envelope payload for `re-shell migrate --json`: the resolved target
 * `toVersion`, whether the run was a `dryRun` (the safe default), the per-recipe
 * migration descriptors, and any `warnings` surfaced while planning/applying
 * (skipped source transforms, dependency-graph cycles, unknown filters, etc).
 */
export const migrateResponseSchema = z.object({
  /** The version the plan migrates the workspace to. */
  toVersion: z.string(),
  /** True when nothing was written (the safe default). */
  dryRun: z.boolean(),
  /** Per-recipe migration descriptors. */
  migrations: z.array(migrationDescriptorSchema),
  /** Plan/apply-level warnings. */
  warnings: z.array(z.string()),
});
export type MigrateResponse = z.infer<typeof migrateResponseSchema>;

// ---------------------------------------------------------------------------
// software catalog  (`re-shell catalog|catalog sync`)  — issue #11
//
// Auto-discovers every service / microfrontend / API / package from the real
// workspace graph and serializes it into a typed catalog model. Emits native
// catalog entities AND Backstage `catalog-info.yaml` for interop with the
// dominant IDP — no hand-written YAML, no catalog drift. `catalog sync` writes
// the catalog-info.yaml files and is idempotent (re-running after a graph
// change updates entities with no manual edits). Building the model is pure
// data and never touches disk or the network.
// ---------------------------------------------------------------------------

/** The Backstage entity kinds the catalog emits. */
export const catalogEntityKindSchema = z.enum([
  'Component',
  'API',
  'Resource',
  'Group',
  'System',
  'Domain',
]);
export type CatalogEntityKind = z.infer<typeof catalogEntityKindSchema>;

/** A generated metadata block shared by every catalog entity. */
export const catalogMetadataSchema = z.object({
  /** Entity name (slug, lowercase, unique per kind). */
  name: z.string(),
  /** Optional display title. */
  title: z.string().optional(),
  /** Optional human description. */
  description: z.string().optional(),
  /** Optional free-form tags (language, framework, domain). */
  tags: z.array(z.string()).optional(),
  /** Optional k8s-style labels. */
  labels: z.record(z.string(), z.string()).optional(),
  /** Optional k8s-style annotations (e.g. re-shell.io/* provenance). */
  annotations: z.record(z.string(), z.string()).optional(),
  /** Optional external links. */
  links: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        type: z.string().optional(),
      })
    )
    .optional(),
});
export type CatalogMetadata = z.infer<typeof catalogMetadataSchema>;

/**
 * A single catalog entity. `apiVersion` is always `backstage.io/v1alpha1` for
 * the emitted kinds; `spec` is an opaque record whose shape depends on `kind`
 * (Component/API/Resource/Group/System) — authored as a passthrough so the
 * serializer owns the per-kind spec, not the contract.
 */
export const catalogEntitySchema = z.object({
  apiVersion: z.string(),
  kind: catalogEntityKindSchema,
  metadata: catalogMetadataSchema,
  spec: z.record(z.string(), z.unknown()),
});
export type CatalogEntity = z.infer<typeof catalogEntitySchema>;

/** Per-kind counts in the catalog rollup. */
export const catalogCountsSchema = z.object({
  components: z.number(),
  apis: z.number(),
  resources: z.number(),
  groups: z.number(),
  systems: z.number(),
});
export type CatalogCounts = z.infer<typeof catalogCountsSchema>;

/**
 * One Backstage catalog-info.yaml file the sync would write (or wrote): its
 * repo-relative `path`, the entity `kind` + `name` it contains, and whether it
 * was actually written to disk (`written`).
 */
export const catalogSyncFileSchema = z.object({
  path: z.string(),
  kind: catalogEntityKindSchema,
  name: z.string(),
  written: z.boolean(),
});
export type CatalogSyncFile = z.infer<typeof catalogSyncFileSchema>;

/**
 * Envelope payload for `re-shell catalog --json` (and `catalog sync --json`):
 * the workspace `system` name, the discovered `entities`, per-kind `counts`,
 * whether the sync was a `dryRun` (always true for `catalog`, false only for
 * `catalog sync --no-dry-run`), the files written (sync only), and any
 * `warnings` surfaced while building the model.
 */
export const catalogResponseSchema = z.object({
  /** The System entity name the catalog is scoped to (the workspace name). */
  system: z.string(),
  /** True when nothing was written (the safe default for `catalog`). */
  dryRun: z.boolean(),
  /** The discovered catalog entities (native model). */
  entities: z.array(catalogEntitySchema),
  /** Per-kind entity counts. */
  counts: catalogCountsSchema,
  /** Files written by `catalog sync` (empty for the default `catalog` view). */
  files: z.array(catalogSyncFileSchema),
  /** Model/sync-level warnings (unknown owners, missing manifests, etc). */
  warnings: z.array(z.string()),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

// ---------------------------------------------------------------------------
// module federation  (`re-shell federation check`)  — issue #15
//
// Continuous Module-Federation contract & type enforcement. Parses MF
// manifests to extract exposed-module types and shared-dependency ranges, diffs
// the current manifest against a baseline for breaking export/type changes,
// detects shared-dependency version skew across remotes, and emits a CI report
// that fails (non-zero) on incompatibility. Computing the report is pure data
// and never touches the network.
// ---------------------------------------------------------------------------

/** Severity of a single federation finding. */
export const federationSeveritySchema = z.enum(['breaking', 'skew', 'info']);
export type FederationSeverity = z.infer<typeof federationSeveritySchema>;

/**
 * One finding from `federation check`: a breaking export/type change
 * (`breaking`), a shared-dependency version skew across remotes (`skew`), or an
 * informational note (`info`). `remote` is the remote the finding is about
 * (absent for cross-remote skew entries that list multiple remotes in `detail`).
 */
export const federationFindingSchema = z.object({
  severity: federationSeveritySchema,
  /** Stable kind id (e.g. "expose-removed", "type-narrowed", "shared-skew"). */
  kind: z.string(),
  /** Human-readable description. */
  message: z.string(),
  /** The remote (federation container) the finding is scoped to, when applicable. */
  remote: z.string().optional(),
  /** Structured detail (both versions, the exposed id, etc). */
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type FederationFinding = z.infer<typeof federationFindingSchema>;

/** One exposed module discovered from a federation manifest. */
export const federationExposeSchema = z.object({
  /** The expose id (e.g. "./Counter"). */
  id: z.string(),
  /** Internal source path, when the manifest carries it. */
  path: z.string().optional(),
  /** Declared types path/file, when the manifest carries it. */
  types: z.string().optional(),
});
export type FederationExpose = z.infer<typeof federationExposeSchema>;

/** One shared dependency declared in a federation manifest. */
export const federationSharedSchema = z.object({
  /** Shared dependency name (e.g. "react"). */
  name: z.string(),
  /** Resolved version, when the manifest carries it. */
  version: z.string().optional(),
  /** Required version range, when declared. */
  requiredVersion: z.string().optional(),
  /** Whether the dep is a singleton. */
  singleton: z.boolean().optional(),
});
export type FederationShared = z.infer<typeof federationSharedSchema>;

/** One remote (federation container) parsed from a manifest. */
export const federationRemoteSchema = z.object({
  /** The remote/federation name (the container `name`). */
  name: z.string(),
  /** Repo-relative manifest path the remote was parsed from. */
  manifest: z.string(),
  exposes: z.array(federationExposeSchema),
  shared: z.array(federationSharedSchema),
});
export type FederationRemote = z.infer<typeof federationRemoteSchema>;

/**
 * Envelope payload for `re-shell federation check --json`: the parsed `remotes`,
 * the per-finding `findings`, the breaking/skew counts, whether the check `pass`
 * es (true when there are no breaking changes or skew), and any `warnings`
 * surfaced while parsing/diffing. When `pass` is false the command still emits
 * this payload (ok:true) AND exits non-zero — the gate is advisory data, not an
 * error.
 */
export const federationResponseSchema = z.object({
  /** True when there are no breaking changes and no shared-dep skew. */
  pass: z.boolean(),
  /** Number of breaking-change findings. */
  breakingCount: z.number(),
  /** Number of shared-dependency skew findings. */
  skewCount: z.number(),
  /** True when the run diffed against a baseline (absent → only skew check ran). */
  hasBaseline: z.boolean(),
  /** The parsed remotes. */
  remotes: z.array(federationRemoteSchema),
  /** The findings (breaking first, then skew, then info). */
  findings: z.array(federationFindingSchema),
  /** Parse/diff-level warnings (unparseable manifests, etc). */
  warnings: z.array(z.string()),
});
export type FederationResponse = z.infer<typeof federationResponseSchema>;

// ---------------------------------------------------------------------------
// api verify  (`re-shell api verify`)  — issue #16
//
// API contract testing + cross-service spec-drift detection. Normalizes an
// OpenAPI-ish spec, diffs it against a baseline for backward-incompatible
// changes, and uses the workspace dependency graph to compute the cross-service
// blast radius (which consumers break when a producer's spec changes). The
// verify command gates CI on backward-incompatible changes. Pure/offline.
// ---------------------------------------------------------------------------

/** The kind of a breaking API spec change. */
export const apiBreakingKindSchema = z.enum([
  'operation-removed',
  'response-field-removed',
  'param-became-required',
  'response-type-narrowed',
]);
export type ApiBreakingKind = z.infer<typeof apiBreakingKindSchema>;

/** One finding from `api verify`: a breaking spec change with its blast radius. */
export const apiFindingSchema = z.object({
  severity: z.enum(['breaking', 'skew', 'info']),
  kind: apiBreakingKindSchema,
  message: z.string(),
  operation: z.string().optional(),
  /** The consuming services impacted by this change (cross-service blast radius). */
  consumers: z.array(z.string()),
});
export type ApiFinding = z.infer<typeof apiFindingSchema>;

/**
 * Envelope payload for `re-shell api verify --json`: the producer API `name`,
 * whether the check `pass`es (no breaking changes), the per-finding `findings`
 * with their blast radius, whether a baseline was diffed, the total consumer
 * count impacted, and any `warnings`. When `pass` is false the command still
 * emits this payload (ok:true) AND exits non-zero — the gate is advisory data.
 */
export const apiVerifyResponseSchema = z.object({
  api: z.string(),
  pass: z.boolean(),
  hasBaseline: z.boolean(),
  breakingCount: z.number(),
  findings: z.array(apiFindingSchema),
  /** Total distinct consuming services impacted across all findings. */
  impactedConsumers: z.number(),
  warnings: z.array(z.string()),
});
export type ApiVerifyResponse = z.infer<typeof apiVerifyResponseSchema>;

// ---------------------------------------------------------------------------
// fix --ci  (`re-shell fix --ci`)  — issue #18
//
// An autonomous CI fixer: a bounded, gate-locked loop that drives remediation
// to green and opens a PR after gates pass (merge/push stay human-controlled).
// These schemas describe the durable --json run log + outcome.
// ---------------------------------------------------------------------------

/** Why the fix loop terminated. */
export const fixLoopOutcomeSchema = z.enum([
  'pr-ready',
  'no-progress',
  'bounded-out',
  'already-green',
]);
export type FixLoopOutcome = z.infer<typeof fixLoopOutcomeSchema>;

/** One iteration in the durable fix-loop log. */
export const fixLoopIterationSchema = z.object({
  iteration: z.number(),
  gatesBefore: z.object({
    passed: z.boolean(),
    failingGates: z.array(z.string()),
  }),
  fix: z
    .object({
      fixId: z.string(),
      description: z.string(),
      changed: z.boolean(),
    })
    .optional(),
  gatesAfter: z
    .object({
      passed: z.boolean(),
      failingGates: z.array(z.string()),
    })
    .optional(),
});
export type FixLoopIteration = z.infer<typeof fixLoopIterationSchema>;

/**
 * Envelope payload for `re-shell fix --ci --json`: the loop `outcome`, the
 * durable per-iteration `iterations`, whether `gatesPassed`, the `appliedFixes`,
 * a human `summary`, whether a `prOpened` was attempted (only under
 * `--no-dry-run` AND `pr-ready`; never auto-merged), and any `warnings`.
 */
export const fixCiResponseSchema = z.object({
  outcome: fixLoopOutcomeSchema,
  gatesPassed: z.boolean(),
  iterations: z.array(fixLoopIterationSchema),
  appliedFixes: z.array(
    z.object({ fixId: z.string(), description: z.string(), changed: z.boolean() })
  ),
  summary: z.string(),
  /** True only when the loop opened a PR (requires --no-dry-run + pr-ready). */
  prOpened: z.boolean(),
  /** The PR URL when one was opened, else "". */
  prUrl: z.string(),
  warnings: z.array(z.string()),
});
export type FixCiResponse = z.infer<typeof fixCiResponseSchema>;

// ---------------------------------------------------------------------------
// boundaries  (`re-shell boundaries`)  — issue #20
//
// Module-boundary / dependency-constraint enforcement. Tags packages
// (scope/type/layer) and evaluates declarative import rules over those tags to
// flag disallowed cross-package imports and undeclared runtime dependencies.
// Polyglot-agnostic (operates on tag + edge data, not source). CI-gatable.
// ---------------------------------------------------------------------------

/** The kind of a boundary violation. */
export const boundaryViolationKindSchema = z.enum([
  'disallowed-import',
  'undeclared-dependency',
]);
export type BoundaryViolationKind = z.infer<typeof boundaryViolationKindSchema>;

/** One boundary violation: a disallowed import or an undeclared dependency. */
export const boundaryViolationSchema = z.object({
  kind: boundaryViolationKindSchema,
  ruleId: z.string().optional(),
  from: z.string(),
  to: z.string(),
  file: z.string().optional(),
  message: z.string(),
});
export type BoundaryViolation = z.infer<typeof boundaryViolationSchema>;

/**
 * Envelope payload for `re-shell boundaries --json`: whether the check `pass`es
 * (no violations), the violation count per kind, the `violations`, the number of
 * `rules` evaluated, and any `warnings`. When `pass` is false the command still
 * emits this payload (ok:true) AND exits non-zero — the gate is advisory data.
 */
export const boundariesResponseSchema = z.object({
  pass: z.boolean(),
  disallowedCount: z.number(),
  undeclaredCount: z.number(),
  rules: z.number(),
  violations: z.array(boundaryViolationSchema),
  warnings: z.array(z.string()),
});
export type BoundariesResponse = z.infer<typeof boundariesResponseSchema>;

// ---------------------------------------------------------------------------
// env init  (`re-shell env init|verify`)  — issue #21
//
// Reproducible dev-environment generation: emits devbox.json +
// .devcontainer/devcontainer.json from detected toolchains, and verifies a
// generated config against current detection (drift). Serialization-only; pure.
// ---------------------------------------------------------------------------

/** One generated dev-environment file. */
export const envFileSchema = z.object({
  /** Repo-relative path, e.g. "devbox.json" or ".devcontainer/devcontainer.json". */
  path: z.string(),
  /** "devbox" or "devcontainer". */
  kind: z.enum(['devbox', 'devcontainer']),
  /** True only when the file was actually written (sync, --no-dry-run). */
  written: z.boolean(),
});
export type EnvFile = z.infer<typeof envFileSchema>;

/**
 * Envelope payload for `re-shell env init --json` / `env verify --json`: the
 * detected `languages`, whether it was a `dryRun`, the generated `files`, the
 * config-vs-detection `drift` (verify), and any `warnings`.
 */
export const envResponseSchema = z.object({
  languages: z.array(z.string()),
  dryRun: z.boolean(),
  files: z.array(envFileSchema),
  drift: z.object({
    missing: z.array(z.string()),
    extra: z.array(z.string()),
  }),
  warnings: z.array(z.string()),
});
export type EnvResponse = z.infer<typeof envResponseSchema>;
