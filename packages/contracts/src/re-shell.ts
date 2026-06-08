// Single source of truth for cross-process contracts.
//
// Every type that crosses a process boundary is authored as a zod schema and
// the TS type is derived via `z.infer`, so validators and types cannot drift.
// Schemas live in ./schemas; the canonical wire envelope lives in ./envelope.

export {
  // enums
  packageManagerSchema,
  workspaceNodeStatusSchema,
  workspaceAppTypeSchema,
  workspaceServiceTypeSchema,
  templateDomainSchema,
  healthStatusSchema,
  healthCheckLevelSchema,
  jobStatusSchema,
  // workspace
  gitSummarySchema,
  workspaceAppSchema,
  workspaceServiceSchema,
  templateSummarySchema,
  healthCheckSchema,
  healthSummarySchema,
  workspaceSummarySchema,
  // jobs
  jobRecordSchema,
  // command spec
  commandSpecSchema,
  commandSpecInputSchema,
  // sse / ws wire messages
  sseEventSchema,
  wsClientMessageSchema,
  wsServerMessageSchema,
  hubServerConfigSchema,
} from './schemas.js';

export type {
  // Status enums (canonical, consumer-facing)
  PackageManager,
  WorkspaceNodeStatus,
  JobStatus,
  // Domain types
  GitSummary,
  WorkspaceApp,
  WorkspaceService,
  TemplateSummary,
  HealthCheck,
  HealthSummary,
  WorkspaceSummary,
  JobRecord,
  CommandSpec,
  CommandSpecInput,
  // sse / ws wire messages
  SseEvent,
  WsClientMessage,
  WsServerMessage,
  HubServerConfig,
} from './schemas.js';

export {
  errorCodeSchema,
  jsonErrorBodySchema,
  jsonResponseSchema,
} from './envelope.js';

export type {
  ErrorCode,
  JsonErrorBody,
  JsonSuccess,
  JsonError,
  JsonResponse,
} from './envelope.js';

// SSE / WS wire-message types (SseEvent, WsClientMessage, WsServerMessage) and
// HubServerConfig are now authored as zod schemas in ./schemas and re-exported
// above, so the hub (emit side) and browser clients (consume side) validate
// against one source of truth via `safeParse`.
