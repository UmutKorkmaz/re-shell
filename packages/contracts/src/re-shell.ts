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
  // remediation / fix plan
  suggestionSchema,
  fixPlanStepSchema,
  fixPlanSchema,
  workspaceSummarySchema,
  // jobs
  jobRecordSchema,
  // command spec
  commandSpecSchema,
  commandSpecInputSchema,
  // find / search
  findResultTypeSchema,
  findResultSchema,
  findResponseSchema,
  // template recommendations
  templateRecommendationSchema,
  recommendResponseSchema,
  // ai scaffold plan
  scaffoldIntentSlotSchema,
  scaffoldIntentSchema,
  scaffoldPlanStepSchema,
  scaffoldPlanSchema,
  aiPlanResponseSchema,
  // agent-readiness docs
  agentsDocFileSchema,
  agentsDocResponseSchema,
  agentsDriftFileSchema,
  agentsCheckResponseSchema,
  // task runner
  taskConfigSchema,
  tasksConfigSchema,
  taskRunStatusSchema,
  taskRunResultSchema,
  runResponseSchema,
  // build cache
  cacheStatsResponseSchema,
  cacheCleanResponseSchema,
  // dev cluster (skaffold inner-loop)
  devClusterSyncRuleSchema,
  devClusterArtifactSchema,
  devClusterPortForwardSchema,
  devClusterConfigSchema,
  devClusterPlanSchema,
  devClusterResponseSchema,
  // production-readiness scorecard
  scorecardGradeSchema,
  scorecardDimensionSchema,
  scorecardServiceSchema,
  scorecardResponseSchema,
  // graph-aware release
  releaseBumpLevelSchema,
  releaseReasonSchema,
  releaseUnitPlanSchema,
  releaseResponseSchema,
  // version-scoped migration/codemod
  migrationKindSchema,
  migrationStatusSchema,
  migrationDescriptorSchema,
  migrateResponseSchema,
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
  // remediation / fix plan
  Suggestion,
  FixPlanStep,
  FixPlan,
  WorkspaceSummary,
  JobRecord,
  CommandSpec,
  CommandSpecInput,
  // find / search
  FindResultType,
  FindResult,
  FindResponse,
  // template recommendations
  TemplateRecommendation,
  RecommendResponse,
  // ai scaffold plan
  ScaffoldIntentSlot,
  ScaffoldIntent,
  ScaffoldPlanStep,
  ScaffoldPlan,
  AiPlanResponse,
  // agent-readiness docs
  AgentsDocFile,
  AgentsDocResponse,
  AgentsDriftFile,
  AgentsCheckResponse,
  // task runner
  TaskConfig,
  TasksConfig,
  TaskRunStatus,
  TaskRunResult,
  RunResponse,
  // build cache
  CacheStatsResponse,
  CacheCleanResponse,
  // dev cluster (skaffold inner-loop)
  DevClusterSyncRule,
  DevClusterArtifact,
  DevClusterPortForward,
  DevClusterConfig,
  DevClusterPlan,
  DevClusterResponse,
  // production-readiness scorecard
  ScorecardGrade,
  ScorecardDimension,
  ScorecardService,
  ScorecardResponse,
  // graph-aware release
  ReleaseBumpLevel,
  ReleaseReason,
  ReleaseUnitPlan,
  ReleaseResponse,
  // version-scoped migration/codemod
  MigrationKind,
  MigrationStatus,
  MigrationDescriptor,
  MigrateResponse,
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
