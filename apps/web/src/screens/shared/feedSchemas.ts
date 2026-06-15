import { z } from 'zod';

/**
 * Web-side zod schemas for the hub feeds whose stdout shape differs from the
 * coarse `@re-shell/contracts` domain types.
 *
 * The contracts package types (`WorkspaceApp`, `TemplateSummary`) describe the
 * RICH internal model. The CLI's `--json` projections that the hub forwards are
 * deliberately narrower (see `buildContractGraph` and `toTemplateSummary`), so
 * we validate against the EXACT wire shape here. Validating the real envelope
 * keeps unknown/partial data from crashing the screens while still failing fast
 * on a genuinely malformed feed.
 */

// ---------------------------------------------------------------------------
// workspace graph  (`re-shell workspace graph --json` → { apps, services })
// ---------------------------------------------------------------------------

/**
 * One node in the contract graph. `framework` is nullable on the wire (a node
 * may have none); `dependencies` lists internal workspace-to-workspace edges by
 * node name. `.catch`/`.default` keep a slightly-off node from failing the
 * whole feed.
 */
export const graphNodeSchema = z.object({
  name: z.string(),
  path: z.string().default(''),
  framework: z.string().nullable().default(null),
  dependencies: z.array(z.string()).default([]),
});
export type GraphNode = z.infer<typeof graphNodeSchema>;

export const workspaceGraphSchema = z.object({
  apps: z.array(graphNodeSchema).default([]),
  services: z.array(graphNodeSchema).default([]),
});
export type WorkspaceGraph = z.infer<typeof workspaceGraphSchema>;

export type GraphNodeKind = 'app' | 'service';

/** A graph node tagged with its kind, used by the canvas + drawer. */
export interface KindedGraphNode extends GraphNode {
  kind: GraphNodeKind;
}

// ---------------------------------------------------------------------------
// templates  (`re-shell templates list|show --json`)
// ---------------------------------------------------------------------------

/**
 * The template summary as the CLI actually emits it (NOT the richer contracts
 * `templateSummarySchema`): no `domain`/`tier`/`command`/`database` fields, and
 * `tags`/`features` are optional. Missing collections default to empty so the
 * grid never throws on a sparse template.
 */
export const templateFeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().default(''),
  language: z.string().default('unknown'),
  framework: z.string().default('unknown'),
  version: z.string().optional(),
  tags: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  port: z.number().optional(),
  fileCount: z.number().optional(),
});
export type TemplateFeed = z.infer<typeof templateFeedSchema>;

export const templateListSchema = z.array(templateFeedSchema);
export type TemplateList = z.infer<typeof templateListSchema>;

// ---------------------------------------------------------------------------
// scorecard  (`re-shell scorecard --json` → ScorecardResponse)
// ---------------------------------------------------------------------------

/**
 * The exact wire shape of `ScorecardResponse` (mirrors the contracts
 * `scorecardResponseSchema`). Validated here so the dashboard panel never
 * crashes on a sparse/slightly-off feed while still failing fast on genuinely
 * malformed data. Missing collections default to empty for robustness.
 */
export const scorecardGradeSchema = z.enum(['A', 'B', 'C', 'D', 'F']);
export type ScorecardGradeFeed = z.infer<typeof scorecardGradeSchema>;

export const scorecardDimensionFeedSchema = z.object({
  id: z.string(),
  label: z.string(),
  weight: z.number(),
  score: z.number(),
  weighted: z.number(),
  pass: z.boolean(),
  detail: z.string().optional(),
});
export type ScorecardDimensionFeed = z.infer<typeof scorecardDimensionFeedSchema>;

export const scorecardServiceFeedSchema = z.object({
  service: z.string(),
  path: z.string().default(''),
  totalScore: z.number(),
  grade: scorecardGradeSchema,
  dimensions: z.array(scorecardDimensionFeedSchema).default([]),
  warnings: z.array(z.string()).default([]),
});
export type ScorecardServiceFeed = z.infer<typeof scorecardServiceFeedSchema>;

export const scorecardFeedSchema = z.object({
  score: z.number(),
  grade: scorecardGradeSchema,
  threshold: z.number(),
  pass: z.boolean(),
  services: z.array(scorecardServiceFeedSchema).default([]),
  driftEntries: z.number().default(0),
  policyScore: z.number().default(0),
  warnings: z.array(z.string()).default([]),
});
export type ScorecardFeed = z.infer<typeof scorecardFeedSchema>;

// ---------------------------------------------------------------------------
// software catalog  (`re-shell catalog --json`)
// ---------------------------------------------------------------------------

export const catalogEntityFeedSchema = z.object({
  kind: z.string(),
  metadata: z.object({
    name: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
  spec: z
    .object({
      type: z.string().optional(),
      owner: z.string().optional(),
      lifecycle: z.string().optional(),
      system: z.string().optional(),
    })
    .catchall(z.unknown())
    .default({}),
});
export type CatalogEntityFeed = z.infer<typeof catalogEntityFeedSchema>;

export const catalogFeedSchema = z.object({
  system: z.string(),
  dryRun: z.boolean().default(true),
  entities: z.array(catalogEntityFeedSchema).default([]),
  counts: z
    .object({
      components: z.number().default(0),
      apis: z.number().default(0),
      resources: z.number().default(0),
      groups: z.number().default(0),
      systems: z.number().default(0),
    })
    .default({ components: 0, apis: 0, resources: 0, groups: 0, systems: 0 }),
  warnings: z.array(z.string()).default([]),
});
export type CatalogFeed = z.infer<typeof catalogFeedSchema>;
