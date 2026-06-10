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
