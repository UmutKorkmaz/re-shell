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
