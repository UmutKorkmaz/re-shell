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
