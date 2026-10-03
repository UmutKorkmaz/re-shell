import { z } from 'zod';

// ---------------------------------------------------------------------------
// R-1b: compliance audit trail, compliance report, architecture analysis,
// profile insights/optimization. Kept in its own module so these contracts do
// not collide with unrelated schema additions.
// ---------------------------------------------------------------------------

// --- audit trail (`security audit verify`) ----------------------------------

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

/** One line of `.re-shell/audit/audit.jsonl`. */
export const auditEntrySchema = z.object({
  v: z.literal(1),
  seq: z.number().int().min(1),
  timestamp: z.string(),
  actor: z.string(),
  actorSource: z.enum(['git', 'os']),
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string(),
  exitCode: z.number().int(),
  durationMs: z.number(),
  prevHash: hex64,
  hash: hex64,
});
export type AuditEntryContract = z.infer<typeof auditEntrySchema>;

export const auditVerifyFailureCodeSchema = z.enum([
  'invalid-json',
  'invalid-entry',
  'hash-mismatch',
  'chain-broken',
  'sequence-gap',
  'sequence-reordered',
  'head-mismatch',
  'log-missing',
  'anchor-mismatch',
]);

export const auditVerifyFailureSchema = z.object({
  seq: z.number().int().nullable(),
  line: z.number().int().min(0),
  code: auditVerifyFailureCodeSchema,
  message: z.string(),
});

/** `data` of `security audit verify --json` (also `error.details` on failure). */
export const auditVerifyResponseSchema = z.object({
  valid: z.boolean(),
  entries: z.number().int().min(0),
  failures: z.array(auditVerifyFailureSchema),
  lastSeq: z.number().int().nullable(),
  lastHash: hex64.nullable(),
  logPath: z.string(),
  logExists: z.boolean(),
  head: z.object({ seq: z.number().int(), hash: hex64 }).nullable(),
});
export type AuditVerifyResponse = z.infer<typeof auditVerifyResponseSchema>;

// --- compliance report (`security compliance report`) -----------------------

export const complianceFrameworkSchema = z.enum(['soc2', 'iso27001']);
export const complianceEvidenceStatusSchema = z.enum(['evidence', 'partial', 'no-evidence']);

export const complianceEvidenceItemSchema = z.object({
  source: z.enum(['audit-log', 'policy-check', 'config', 'repository']),
  summary: z.string(),
});

export const complianceControlSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(['change-management', 'access', 'logging', 'configuration']),
  objective: z.string(),
  status: complianceEvidenceStatusSchema,
  evidence: z.array(complianceEvidenceItemSchema),
  gaps: z.array(z.string()),
});

export const complianceReportSchema = z.object({
  framework: complianceFrameworkSchema,
  frameworkName: z.string(),
  generatedAt: z.string(),
  since: z.string().nullable(),
  disclaimer: z.string(),
  audit: z.object({
    present: z.boolean(),
    enabled: z.boolean(),
    disabledBy: z.enum(['env', 'config']).optional(),
    chainValid: z.boolean(),
    entriesTotal: z.number().int(),
    entriesInWindow: z.number().int(),
    actors: z.array(z.string()),
    firstTimestamp: z.string().nullable(),
    lastTimestamp: z.string().nullable(),
    byCategory: z.record(z.string(), z.number()),
    failedCommands: z.number().int(),
    verifyFailures: z.number().int(),
  }),
  policy: z.object({
    ran: z.boolean(),
    pack: z.string().optional(),
    score: z.number().optional(),
    passedRules: z.number().int().optional(),
    failedErrors: z.number().int().optional(),
    failedWarnings: z.number().int().optional(),
    error: z.string().optional(),
  }),
  controls: z.array(complianceControlSchema),
  summary: z.object({
    total: z.number().int(),
    evidence: z.number().int(),
    partial: z.number().int(),
    noEvidence: z.number().int(),
  }),
  notEvaluated: z.array(z.object({ id: z.string(), title: z.string(), reason: z.string() })),
});
export type ComplianceReportContract = z.infer<typeof complianceReportSchema>;

// --- architecture analysis (`analyze --type ...`) ---------------------------

export const analysisTypeSchema = z.enum(['security', 'performance', 'scalability', 'architecture']);
export const analysisSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

export const analysisEvidenceSchema = z.object({
  kind: z.enum(['file', 'graph', 'config']),
  file: z.string().optional(),
  line: z.number().int().min(1).optional(),
  /** Ordered package names for graph evidence, e.g. a dependency cycle. */
  path: z.array(z.string()).optional(),
  detail: z.string(),
});

export const analysisFindingSchema = z.object({
  /** Stable per-instance id: `<ruleId>:<subject>`. */
  id: z.string(),
  /** Rule identifier, e.g. `arch.dependency-cycle`. */
  ruleId: z.string(),
  type: analysisTypeSchema,
  severity: analysisSeveritySchema,
  title: z.string(),
  message: z.string(),
  evidence: z.array(analysisEvidenceSchema).min(1),
  recommendation: z.string(),
});
export type AnalysisFinding = z.infer<typeof analysisFindingSchema>;

/** `data` of `analyze --json`. Legacy per-workspace sections stay under `analysis`. */
export const analysisReportSchema = z.object({
  timestamp: z.string(),
  monorepo: z.string(),
  workspaces: z.number().int(),
  analysis: z.record(z.string(), z.record(z.string(), z.unknown())),
  types: z.array(analysisTypeSchema),
  graph: z.object({
    packages: z.number().int(),
    edges: z.number().int(),
    services: z.number().int(),
  }),
  findings: z.array(analysisFindingSchema),
  summary: z.object({
    total: z.number().int(),
    bySeverity: z.record(z.string(), z.number()),
    byType: z.record(z.string(), z.number()),
  }),
});
export type AnalysisReport = z.infer<typeof analysisReportSchema>;

// --- profile insights / optimization ----------------------------------------

export const profileInsightSchema = z.object({
  type: z.enum(['usage', 'performance', 'optimization', 'warning']),
  severity: z.enum(['info', 'suggestion', 'warning', 'critical']),
  title: z.string(),
  description: z.string(),
  recommendation: z.string().optional(),
  impact: z.string().optional(),
  /** The recorded data points the insight was computed from. */
  evidence: z.array(z.string()).optional(),
});

export const profileDataSourceSchema = z.object({
  file: z.string(),
  /** Number of recorded activation-history events available. */
  events: z.number().int().min(0),
  profilesTracked: z.number().int().min(0),
  /** True when no history has been recorded yet (insights are limited to configuration checks). */
  empty: z.boolean(),
});

/** `data` of `config profile insights --json`. */
export const profileInsightsResponseSchema = z.object({
  profile: z.string().nullable(),
  generatedAt: z.string(),
  dataSource: profileDataSourceSchema,
  insights: z.array(profileInsightSchema),
});
export type ProfileInsightsResponse = z.infer<typeof profileInsightsResponseSchema>;

export const profileOptimizationRecommendationSchema = z.object({
  id: z.string(),
  category: z.enum(['performance', 'security', 'maintainability', 'usage', 'configuration']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  effort: z.enum(['easy', 'medium', 'hard']),
  recommendation: z.string(),
  code: z.string().optional(),
});

/** `data` of `config profile optimize <profile> --json`. */
export const profileOptimizationResponseSchema = z.object({
  profileName: z.string(),
  totalRecommendations: z.number().int(),
  categories: z.record(z.string(), z.number()),
  bySeverity: z.record(z.string(), z.number()),
  recommendations: z.array(profileOptimizationRecommendationSchema),
  overallScore: z.number(),
  optimizedAt: z.string(),
  dataSource: profileDataSourceSchema,
});
export type ProfileOptimizationResponse = z.infer<typeof profileOptimizationResponseSchema>;

// ---------------------------------------------------------------------------
// Workstream R-1a: pkg / debug / refactor / cloud iac contracts.
// Authored in their own module so they merge cleanly next to other workstreams.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// pkg  (`re-shell pkg add|remove|install|list|outdated`)
//
// Unified package-manager abstraction: the ecosystem is detected per target
// directory (npm/pnpm/yarn/bun, pip/poetry/uv, cargo, maven/gradle, dotnet,
// composer, bundler, go), each operation maps to the native argv, and `list` /
// `outdated` normalize manifests and native output into one shape.
// ---------------------------------------------------------------------------

/** Ecosystems `re-shell pkg` can drive. */
export const pkgEcosystemSchema = z.enum([
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'pip',
  'poetry',
  'uv',
  'cargo',
  'maven',
  'gradle',
  'dotnet',
  'composer',
  'bundler',
  'go',
]);
export type PkgEcosystem = z.infer<typeof pkgEcosystemSchema>;

export const pkgOperationSchema = z.enum(['add', 'remove', 'install', 'list', 'outdated']);
export type PkgOperationName = z.infer<typeof pkgOperationSchema>;

export const pkgDependencyKindSchema = z.enum(['prod', 'dev', 'optional', 'peer', 'build', 'indirect']);
export type PkgDependencyKind = z.infer<typeof pkgDependencyKindSchema>;

/** One dependency declaration parsed from a manifest, normalized across ecosystems. */
export const pkgDependencySchema = z.object({
  name: z.string(),
  /** Requested version/constraint as written; null when none. */
  requested: z.string().nullable(),
  kind: pkgDependencyKindSchema,
  ecosystem: pkgEcosystemSchema,
  /** Manifest file, relative to the target directory. */
  manifest: z.string(),
});
export type PkgDependencyEntry = z.infer<typeof pkgDependencySchema>;

/** One outdated dependency, normalized across the native outdated commands. */
export const pkgOutdatedSchema = z.object({
  name: z.string(),
  current: z.string().nullable(),
  wanted: z.string().nullable(),
  latest: z.string(),
  kind: pkgDependencyKindSchema.nullable(),
  ecosystem: pkgEcosystemSchema,
});
export type PkgOutdatedEntry = z.infer<typeof pkgOutdatedSchema>;

/** A native command (argv, no shell) planned or executed by pkg. */
export const pkgCommandRecordSchema = z.object({
  argv: z.array(z.string()),
  cwd: z.string(),
  purpose: z.string(),
  executed: z.boolean(),
  exitCode: z.number().nullable(),
  durationMs: z.number().nullable(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});
export type PkgCommandRecordEntry = z.infer<typeof pkgCommandRecordSchema>;

/** A manifest edit re-shell performs itself (maven/gradle/pip have no native add). */
export const pkgManifestEditSchema = z.object({
  file: z.string(),
  action: z.enum(['add', 'remove']),
  entries: z.array(z.string()),
  applied: z.boolean(),
  changed: z.boolean(),
});
export type PkgManifestEdit = z.infer<typeof pkgManifestEditSchema>;

/** Envelope payload for `re-shell pkg <op> --json`. */
export const pkgResponseSchema = z.object({
  operation: pkgOperationSchema,
  ecosystem: pkgEcosystemSchema,
  /** Evidence the ecosystem was chosen from (lockfile, manifest, --ecosystem). */
  detectedBy: z.string(),
  dir: z.string(),
  service: z.string().nullable(),
  dryRun: z.boolean(),
  packages: z.array(z.string()),
  dev: z.boolean(),
  commands: z.array(pkgCommandRecordSchema),
  manifestEdits: z.array(pkgManifestEditSchema),
  dependencies: z.array(pkgDependencySchema),
  outdated: z.array(pkgOutdatedSchema),
});
export type PkgResponse = z.infer<typeof pkgResponseSchema>;

// ---------------------------------------------------------------------------
// cloud iac generate|validate / cloud deploy
//
// Terraform generated from the workspace v2 config for AWS (ECS Fargate), Azure
// (Container Apps) and GCP (Cloud Run); `validate` reports exactly which
// terraform steps ran; `deploy` applies with real credentials and an explicit
// --yes gate.
// ---------------------------------------------------------------------------

export const iacProviderSchema = z.enum(['aws', 'azure', 'gcp']);
export type IacProviderName = z.infer<typeof iacProviderSchema>;

export const iacValidationStepSchema = z.object({
  name: z.enum(['version', 'fmt', 'init', 'validate', 'hcl-structure']),
  /** False when the step could not run (e.g. terraform missing, init failed). */
  ran: z.boolean(),
  ok: z.boolean().nullable(),
  exitCode: z.number().nullable(),
  output: z.string(),
  reason: z.string().optional(),
});
export type IacValidationStep = z.infer<typeof iacValidationStepSchema>;

export const iacValidationSchema = z.object({
  terraform: z.object({ found: z.boolean(), path: z.string().optional(), version: z.string().optional() }),
  steps: z.array(iacValidationStepSchema),
  /** True only when `init -backend=false` and `validate` both ran and passed. */
  validated: z.boolean(),
  formatted: z.boolean().nullable(),
  providersInstalled: z.boolean().nullable(),
  summary: z.string(),
});
export type IacValidation = z.infer<typeof iacValidationSchema>;

export const iacFileSchema = z.object({
  path: z.string(),
  bytes: z.number(),
  /** File content (present on dry runs). */
  content: z.string().optional(),
});
export type IacFile = z.infer<typeof iacFileSchema>;

/** Envelope payload for `re-shell cloud iac generate --json`. */
export const iacGenerateResponseSchema = z.object({
  provider: iacProviderSchema,
  /** Deployment target (ECS Fargate, Container Apps, Cloud Run). */
  target: z.string(),
  outDir: z.string().nullable(),
  dryRun: z.boolean(),
  written: z.boolean(),
  services: z.array(z.object({ name: z.string(), port: z.number(), exposed: z.boolean() })),
  files: z.array(iacFileSchema),
  /** Variables for image tags and regions accepted by the generated configuration. */
  variables: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() })),
  /** Present when `--validate` was requested. */
  validation: iacValidationSchema.nullable(),
  warnings: z.array(z.string()),
});
export type IacGenerateResponse = z.infer<typeof iacGenerateResponseSchema>;

/** Envelope payload for `re-shell cloud iac validate --json`. */
export const iacValidateResponseSchema = z.object({
  dir: z.string(),
  validation: iacValidationSchema,
});
export type IacValidateResponse = z.infer<typeof iacValidateResponseSchema>;

export const cloudDeployStepSchema = z.object({
  name: z.enum(['init', 'plan', 'apply', 'output']),
  argv: z.array(z.string()),
  executed: z.boolean(),
  exitCode: z.number().nullable(),
  durationMs: z.number().nullable(),
  output: z.string(),
});
export type CloudDeployStep = z.infer<typeof cloudDeployStepSchema>;

/** Envelope payload for `re-shell cloud deploy --json` (success: apply ran). */
export const cloudDeployResponseSchema = z.object({
  provider: iacProviderSchema,
  dir: z.string(),
  dryRun: z.boolean(),
  credentials: z.object({ checked: z.boolean(), source: z.string().nullable() }),
  steps: z.array(cloudDeployStepSchema),
  /** True only when `terraform apply` ran and succeeded. */
  applied: z.boolean(),
  outputs: z.record(z.string(), z.unknown()),
});
export type CloudDeployResponse = z.infer<typeof cloudDeployResponseSchema>;

// ---------------------------------------------------------------------------
// debug config  (`re-shell debug config`)
//
// Generates a VS Code launch.json (one set of configurations per workspace
// service, chosen by language, plus a compound that debugs several services
// together) and a docker-compose debug override for services running in compose.
// ---------------------------------------------------------------------------

export const debugKindSchema = z.enum(['node', 'bun', 'python', 'go', 'rust', 'java', 'php', 'ruby', 'dotnet']);
export type DebugKind = z.infer<typeof debugKindSchema>;

export const debugServiceSchema = z.object({
  name: z.string(),
  language: z.string(),
  debugKind: debugKindSchema,
  /** Debug port; null for adapters that attach over a pipe (dotnet). */
  debugPort: z.number().nullable(),
  portSource: z.enum(['explicit', 'allocated', 'none']),
  /** Names of the generated launch configurations. */
  configurations: z.array(z.string()),
  inCompose: z.boolean(),
  composeService: z.string().nullable(),
  remoteRoot: z.string().nullable(),
});
export type DebugService = z.infer<typeof debugServiceSchema>;

/** Envelope payload for `re-shell debug config --json`. */
export const debugConfigResponseSchema = z.object({
  /** launch.json path (absolute). */
  out: z.string(),
  dryRun: z.boolean(),
  written: z.boolean(),
  services: z.array(debugServiceSchema),
  skipped: z.array(z.object({ name: z.string(), language: z.string(), reason: z.string() })),
  compound: z.object({ name: z.string(), configurations: z.array(z.string()) }).nullable(),
  launch: z.object({
    created: z.boolean(),
    added: z.array(z.string()),
    updated: z.array(z.string()),
    unchanged: z.array(z.string()),
    /** Existing entries the tool does not own (left untouched). */
    preserved: z.number(),
    /** Full merged launch.json text. */
    content: z.string(),
  }),
  compose: z
    .object({
      path: z.string(),
      written: z.boolean(),
      services: z.array(z.string()),
      content: z.string(),
    })
    .nullable(),
  notes: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type DebugConfigResponse = z.infer<typeof debugConfigResponseSchema>;

// ---------------------------------------------------------------------------
// refactor rename-service  (`re-shell refactor rename-service <old> <new>`)
//
// Renames a service across the workspace config, compose files, generated
// k8s/helm manifests, package manifests, references in other services and the
// service directory (VCS-aware move). Dry runs return the full unified diff.
// ---------------------------------------------------------------------------

export const refactorChangeKindSchema = z.enum([
  'workspace',
  'compose',
  'k8s',
  'helm',
  'manifest',
  'dependency',
  'env',
  'source',
  'docs',
  'config',
]);
export type RefactorChangeKind = z.infer<typeof refactorChangeKindSchema>;

/** One file whose content changes (paths are workspace-relative, POSIX). */
export const refactorFileSchema = z.object({
  /** Path before the rename. */
  from: z.string(),
  /** Path after the rename (differs when the file lives in a moved directory). */
  to: z.string(),
  kind: refactorChangeKindSchema,
  changedLines: z.number(),
});
export type RefactorFile = z.infer<typeof refactorFileSchema>;

export const refactorMoveSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(['directory', 'file']),
});
export type RefactorMove = z.infer<typeof refactorMoveSchema>;

/** A whole-word mention of the old name that was NOT rewritten automatically. */
export const refactorResidualSchema = z.object({
  path: z.string(),
  line: z.number(),
  text: z.string(),
});
export type RefactorResidual = z.infer<typeof refactorResidualSchema>;

/** Envelope payload for `re-shell refactor rename-service --json`. */
export const refactorRenameServiceResponseSchema = z.object({
  old: z.string(),
  new: z.string(),
  dryRun: z.boolean(),
  /** True only when the rename was actually written to disk. */
  applied: z.boolean(),
  root: z.string(),
  git: z.object({
    inRepo: z.boolean(),
    dirty: z.boolean(),
    moved: z.enum(['git-mv', 'fs-rename', 'none']),
  }),
  files: z.array(refactorFileSchema),
  moves: z.array(refactorMoveSchema),
  /** Unified diff (git style) of every content change and rename. */
  diff: z.string(),
  residualReferences: z.array(refactorResidualSchema),
  warnings: z.array(z.string()),
});
export type RefactorRenameServiceResponse = z.infer<typeof refactorRenameServiceResponseSchema>;
