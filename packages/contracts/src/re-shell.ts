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
  // ai command interface (P9-A)
  aiProviderNameSchema,
  aiWorkspaceNodeRefSchema,
  aiIntentCandidateSchema,
  aiResolutionSourceSchema,
  aiIntentResolvedSchema,
  aiIntentClarifySchema,
  aiIntentResponseSchema,
  aiSuggestionSchema,
  aiSuggestResponseSchema,
  aiSessionTurnSchema,
  aiPendingClarificationSchema,
  aiSessionSchema,
  aiSessionSummarySchema,
  aiSessionListResponseSchema,
  aiSessionShowResponseSchema,
  aiSessionClearResponseSchema,
  aiCacheStatsResponseSchema,
  aiCacheClearResponseSchema,
  aiConfigSourceSchema,
  aiConfigViewSchema,
  aiConfigShowResponseSchema,
  aiConfigValueResponseSchema,
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
  // software catalog auto-discovery
  catalogEntityKindSchema,
  catalogMetadataSchema,
  catalogEntitySchema,
  catalogCountsSchema,
  catalogSyncFileSchema,
  catalogResponseSchema,
  // module federation contract enforcement
  federationSeveritySchema,
  federationFindingSchema,
  federationExposeSchema,
  federationSharedSchema,
  federationRemoteSchema,
  federationResponseSchema,
  // api contract verify
  apiBreakingKindSchema,
  apiFindingSchema,
  apiVerifyResponseSchema,
  // autonomous fix loop
  fixLoopOutcomeSchema,
  fixLoopIterationSchema,
  fixCiResponseSchema,
  // module boundaries
  boundaryViolationKindSchema,
  boundaryViolationSchema,
  boundariesResponseSchema,
  // reproducible dev environment
  envFileSchema,
  envResponseSchema,
  // storybook ui test
  uiTestKindSchema,
  uiDimensionRollupSchema,
  uiFailureSchema,
  uiTestResponseSchema,
  // kubernetes rollback / crd / operator / mesh
  k8sRollbackMethodSchema,
  k8sRollbackFailureReasonSchema,
  k8sRollbackResponseSchema,
  k8sCrdIdentitySchema,
  k8sGeneratedManifestSchema,
  k8sToolCheckSchema,
  k8sCrdResponseSchema,
  k8sMeshResponseSchema,
  k8sOperatorResponseSchema,
  // create (scaffold + dry-run)
  createModeSchema,
  scaffoldFileStatusSchema,
  scaffoldFileActionSchema,
  scaffoldFileSchema,
  scaffoldDryRunSummarySchema,
  createDryRunResponseSchema,
  createResponseSchema,
  // sse / ws wire messages
  sseEventSchema,
  wsJobMessageSchema,
  wsAuthMessageSchema,
  wsClientMessageSchema,
  wsServerMessageSchema,
  hubServerConfigSchema,
  // service bridge (P9-B)
  bridgeProtocolSchema,
  bridgeClientLanguageSchema,
  bridgeArtifactSchema,
  bridgeVerifyResultSchema,
  bridgeStubResultSchema,
  bridgeGenerateResponseSchema,
  bridgeLinkResponseSchema,
  bridgeServiceLinkSchema,
  bridgeUnlinkResponseSchema,
  bridgeChangeSeveritySchema,
  bridgeContractChangeSchema,
  bridgeValidateResponseSchema,
  bridgeDiffResponseSchema,
  bridgeMockResponseSchema,
  bridgeGatewayResponseSchema,
  bridgeAsyncResponseSchema,
  bridgeTransformResponseSchema,
  // service bridge (P9-B)
  BridgeProtocolName,
  BridgeClientLanguage,
  BridgeArtifactPayload,
  BridgeVerifyResult,
  BridgeStubResult,
  BridgeGenerateResponse,
  BridgeLinkResponse,
  BridgeServiceLink,
  BridgeUnlinkResponse,
  BridgeChangeSeverity,
  BridgeContractChange,
  BridgeValidateResponse,
  BridgeDiffResponse,
  BridgeMockResponse,
  BridgeGatewayResponse,
  BridgeAsyncResponse,
  BridgeTransformResponse,
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
  // ai command interface (P9-A)
  AiProviderName,
  AiWorkspaceNodeRef,
  AiIntentCandidate,
  AiResolutionSource,
  AiIntentResolved,
  AiIntentClarify,
  AiIntentResponse,
  AiSuggestion,
  AiSuggestResponse,
  AiSessionTurn,
  AiPendingClarification,
  AiSession,
  AiSessionSummary,
  AiSessionListResponse,
  AiSessionShowResponse,
  AiSessionClearResponse,
  AiCacheStatsResponse,
  AiCacheClearResponse,
  AiConfigView,
  AiConfigShowResponse,
  AiConfigValueResponse,
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
  // software catalog auto-discovery
  CatalogEntityKind,
  CatalogMetadata,
  CatalogEntity,
  CatalogCounts,
  CatalogSyncFile,
  CatalogResponse,
  // module federation contract enforcement
  FederationSeverity,
  FederationFinding,
  FederationExpose,
  FederationShared,
  FederationRemote,
  FederationResponse,
  // api contract verify
  ApiBreakingKind,
  ApiFinding,
  ApiVerifyResponse,
  // autonomous fix loop
  FixLoopOutcome,
  FixLoopIteration,
  FixCiResponse,
  // module boundaries
  BoundaryViolationKind,
  BoundaryViolation,
  BoundariesResponse,
  // reproducible dev environment
  EnvFile,
  EnvResponse,
  // storybook ui test
  UiTestKind,
  UiDimensionRollup,
  UiFailure,
  UiTestResponse,
  // kubernetes rollback / crd / operator / mesh
  K8sRollbackMethod,
  K8sRollbackFailureReason,
  K8sRollbackResponse,
  K8sCrdIdentity,
  K8sGeneratedManifest,
  K8sToolCheck,
  K8sCrdResponse,
  K8sMeshResponse,
  K8sOperatorResponse,
  // create (scaffold + dry-run)
  CreateMode,
  ScaffoldFileStatus,
  ScaffoldFileAction,
  ScaffoldFile,
  ScaffoldDryRunSummary,
  CreateDryRunResponse,
  CreateResponse,
  // sse / ws wire messages
  SseEvent,
  WsJobMessage,
  WsAuthMessage,
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

// Workstream R-1a: pkg / debug / refactor / cloud iac contracts.
export * from './platform.js';
