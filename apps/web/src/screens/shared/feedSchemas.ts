import { z } from 'zod';

/**
 * Web-side zod schemas for the hub feeds whose stdout shape differs from the
 * coarse `re-shell-contracts` domain types.
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
