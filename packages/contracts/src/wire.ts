import { z } from 'zod';
import { fixPlanSchema, suggestionSchema } from './schemas.js';

// ---------------------------------------------------------------------------
// Wire schemas: the EXACT `data` payloads the CLI prints for `--json`.
//
// Two layers live in this package and they are deliberately different:
//
//   1. WIRE schemas (this file). They describe byte-for-byte what a command
//      puts under `data` in the `{ ok, data, warnings }` envelope. They are what
//      the real CLI output is validated against (CLI conformance suite, MCP
//      server, VS Code extension, dashboard feed parsing, the generated
//      docs/CLI-CONTRACTS.md). If the CLI output changes and this file does not,
//      the conformance suite fails.
//
//   2. DOMAIN schemas (./schemas.ts: `workspaceSummarySchema`,
//      `healthSummarySchema`, `templateSummarySchema`, ...). They are the UI
//      models the React components render. They are richer than (and shaped
//      differently from) the wire, so they are NEVER validated against raw CLI
//      output. The adapters in ./adapters.ts turn a validated wire payload into
//      the matching domain model.
//
// Wire objects are `looseObject`s: every declared key is validated strictly, but
// an unknown key is preserved instead of stripped. Consumers that forward the
// validated payload (the MCP server) therefore never lose data when a newer CLI
// adds a field; the CLI conformance suite separately fails on undeclared keys so
// the contract still gets updated.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// workspace  (`workspace list|summary|graph|health --json`)
// ---------------------------------------------------------------------------

/** Workspace category the CLI infers from the parent directory. */
export const workspaceTypeWireSchema = z.enum(['app', 'package', 'lib', 'tool']);
export type WorkspaceTypeWire = z.infer<typeof workspaceTypeWireSchema>;

/**
 * One discovered workspace, as `workspace list --json` emits it (and as it is
 * nested under `workspaces[]` in `workspace summary --json`). `path` is relative
 * to the monorepo root; `dependencies` merges dependencies + devDependencies;
 * `framework` is omitted when none was detected.
 */
export const workspaceInfoWireSchema = z.looseObject({
  name: z.string(),
  path: z.string(),
  type: workspaceTypeWireSchema,
  framework: z.string().optional(),
  version: z.string(),
  dependencies: z.array(z.string()),
});
export type WorkspaceInfoWire = z.infer<typeof workspaceInfoWireSchema>;

/** `data` of `workspace list --json`: a flat array of workspaces. */
export const workspaceListWireSchema = z.array(workspaceInfoWireSchema);
export type WorkspaceListWire = z.infer<typeof workspaceListWireSchema>;

/**
 * One node of the consumer graph projection. `framework` is `null` (not absent)
 * when none was detected; `dependencies` lists only INTERNAL workspace-to-
 * workspace edges, by node name.
 */
export const graphNodeWireSchema = z.looseObject({
  name: z.string(),
  path: z.string(),
  framework: z.string().nullable(),
  dependencies: z.array(z.string()),
});
export type GraphNodeWire = z.infer<typeof graphNodeWireSchema>;

/** `data` of `workspace graph --json`: workspaces split into apps and services. */
export const workspaceGraphWireSchema = z.looseObject({
  apps: z.array(graphNodeWireSchema),
  services: z.array(graphNodeWireSchema),
});
export type WorkspaceGraphWire = z.infer<typeof workspaceGraphWireSchema>;

/** Overall status bucket derived from the 0-100 health score. */
export const healthStatusWireSchema = z.enum(['healthy', 'degraded', 'critical']);
export type HealthStatusWire = z.infer<typeof healthStatusWireSchema>;

/** Per-check severity. */
export const healthCheckStatusWireSchema = z.enum(['healthy', 'warning', 'critical']);
export type HealthCheckStatusWire = z.infer<typeof healthCheckStatusWireSchema>;

/**
 * One normalized health check. `message` is omitted when empty. `details` is
 * intentionally opaque (`string[]` for the monorepo checks, a metadata object
 * for the rich `re-shell.workspaces.yaml` checks).
 */
export const healthCheckWireSchema = z.looseObject({
  name: z.string(),
  status: healthCheckStatusWireSchema,
  message: z.string().optional(),
  details: z.unknown().optional(),
});
export type HealthCheckWire = z.infer<typeof healthCheckWireSchema>;

/**
 * Canonical health report: the `data` of `workspace health --json` and the
 * `health` member of `workspace summary --json`. `suggestions` is present only
 * under `--explain`.
 */
export const workspaceHealthWireSchema = z.looseObject({
  score: z.number(),
  status: healthStatusWireSchema,
  checks: z.array(healthCheckWireSchema),
  suggestions: z.array(suggestionSchema).optional(),
});
export type WorkspaceHealthWire = z.infer<typeof workspaceHealthWireSchema>;

/** Package manager detected from lockfiles (`pnpm-lock.yaml`, `yarn.lock`, else npm). */
export const packageManagerWireSchema = z.enum(['npm', 'yarn', 'pnpm']);
export type PackageManagerWire = z.infer<typeof packageManagerWireSchema>;

/**
 * `data` of `workspace summary --json`: the aggregate of discovered workspaces,
 * the graph projection and the canonical health report. `root` is an absolute
 * path.
 */
export const workspaceSummaryWireSchema = z.looseObject({
  root: z.string(),
  packageManager: packageManagerWireSchema,
  workspaces: z.array(workspaceInfoWireSchema),
  graph: workspaceGraphWireSchema,
  health: workspaceHealthWireSchema,
});
export type WorkspaceSummaryWire = z.infer<typeof workspaceSummaryWireSchema>;

// ---------------------------------------------------------------------------
// templates  (`templates list|show|matrix --json`)
// ---------------------------------------------------------------------------

/**
 * One template as `templates list --json` / `templates show <id> --json` emit
 * it. This is the registry projection (`toTemplateSummary`): it carries NO
 * `domain`, `tier`, `command` or `database`; the UI derives those in its
 * adapter. `fileCount` is the number of files the scaffold would write.
 */
export const templateWireSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string(),
  language: z.string(),
  framework: z.string(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  port: z.number().optional(),
  fileCount: z.number().optional(),
});
export type TemplateWire = z.infer<typeof templateWireSchema>;

/** `data` of `templates list --json`. */
export const templatesListWireSchema = z.array(templateWireSchema);
export type TemplatesListWire = z.infer<typeof templatesListWireSchema>;

/** One row of the compatibility matrix. */
export const templateMatrixRowWireSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  language: z.string(),
  framework: z.string(),
  databases: z.array(z.string()),
  caches: z.array(z.string()),
  deploymentTargets: z.array(z.string()),
  features: z.array(z.string()),
});
export type TemplateMatrixRowWire = z.infer<typeof templateMatrixRowWireSchema>;

/** Distinct values across every matrix row, for filter UIs and coverage checks. */
export const templateMatrixFacetsWireSchema = z.looseObject({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  databases: z.array(z.string()),
  caches: z.array(z.string()),
  deploymentTargets: z.array(z.string()),
  features: z.array(z.string()),
});
export type TemplateMatrixFacetsWire = z.infer<typeof templateMatrixFacetsWireSchema>;

/** `data` of `templates matrix --json`. */
export const templatesMatrixWireSchema = z.looseObject({
  matrix: z.array(templateMatrixRowWireSchema),
  facets: templateMatrixFacetsWireSchema,
});
export type TemplatesMatrixWire = z.infer<typeof templatesMatrixWireSchema>;

// ---------------------------------------------------------------------------
// commands  (`commands list --json`)
// ---------------------------------------------------------------------------

/** One positional argument of a catalog command. */
export const commandCatalogArgWireSchema = z.looseObject({
  name: z.string(),
  required: z.boolean(),
});
export type CommandCatalogArgWire = z.infer<typeof commandCatalogArgWireSchema>;

/** One flag/option of a catalog command. `default` is present only when declared. */
export const commandCatalogFlagWireSchema = z.looseObject({
  name: z.string(),
  description: z.string(),
  takesValue: z.boolean(),
  default: z.unknown().optional(),
});
export type CommandCatalogFlagWire = z.infer<typeof commandCatalogFlagWireSchema>;

/**
 * One runnable command in the machine-readable catalog. Distinct from the domain
 * `commandSpecSchema` (a resolved, ready-to-spawn argv): this is the declarative
 * description a Command Builder renders its form from.
 */
export const commandCatalogEntryWireSchema = z.looseObject({
  path: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  args: z.array(commandCatalogArgWireSchema),
  flags: z.array(commandCatalogFlagWireSchema),
  supportsJson: z.boolean(),
  supportsDryRun: z.boolean(),
  destructive: z.boolean(),
});
export type CommandCatalogEntryWire = z.infer<typeof commandCatalogEntryWireSchema>;

/** `data` of `commands list --json`. */
export const commandCatalogWireSchema = z.array(commandCatalogEntryWireSchema);
export type CommandCatalogWire = z.infer<typeof commandCatalogWireSchema>;

// ---------------------------------------------------------------------------
// doctor  (`doctor --json`)
// ---------------------------------------------------------------------------

/**
 * Doctor check severity. This is a different vocabulary from the workspace
 * health checks (`healthy|warning|critical`): doctor uses `success|warning|error`.
 */
export const doctorCheckStatusWireSchema = z.enum(['success', 'warning', 'error']);
export type DoctorCheckStatusWire = z.infer<typeof doctorCheckStatusWireSchema>;

/** One doctor diagnostic. `suggestion` is present when the check did not pass. */
export const doctorCheckWireSchema = z.looseObject({
  name: z.string(),
  status: doctorCheckStatusWireSchema,
  message: z.string(),
  suggestion: z.string().optional(),
});
export type DoctorCheckWire = z.infer<typeof doctorCheckWireSchema>;

/** `data` of `doctor --json` (and `doctor --explain --json`, which adds `suggestions`). */
export const doctorWireSchema = z.looseObject({
  checks: z.array(doctorCheckWireSchema),
  suggestions: z.array(suggestionSchema).optional(),
});
export type DoctorWire = z.infer<typeof doctorWireSchema>;

/** `data` of `doctor --fix --json`: the (dry-run by default) remediation plan. */
export const doctorFixWireSchema = z.looseObject({
  plan: fixPlanSchema,
  suggestions: z.array(suggestionSchema),
});
export type DoctorFixWire = z.infer<typeof doctorFixWireSchema>;

// ---------------------------------------------------------------------------
// analyze  (`analyze --json`)
// ---------------------------------------------------------------------------

/**
 * One analysis block (bundle/dependencies/performance/security). Only the
 * `workspace` discriminator is contractual; the rest of each block is the
 * analyzer's own report and is passed through untouched.
 */
export const analysisBlockWireSchema = z.looseObject({ workspace: z.string() });
export type AnalysisBlockWire = z.infer<typeof analysisBlockWireSchema>;

/**
 * `data` of `analyze --json`. `analysis` is keyed by workspace path; each value
 * carries whichever of the four blocks the requested `--type` produced.
 * `timestamp` is an ISO-8601 instant, `workspaces` the number of workspaces
 * considered.
 */
export const analyzeWireSchema = z.looseObject({
  timestamp: z.string(),
  monorepo: z.string(),
  workspaces: z.number(),
  analysis: z.record(
    z.string(),
    z.looseObject({
      bundle: analysisBlockWireSchema.optional(),
      dependencies: analysisBlockWireSchema.optional(),
      performance: analysisBlockWireSchema.optional(),
      security: analysisBlockWireSchema.optional(),
    })
  ),
});
export type AnalyzeWire = z.infer<typeof analyzeWireSchema>;

// ---------------------------------------------------------------------------
// list  (`list --json`)
// ---------------------------------------------------------------------------

/**
 * One microfrontend found under `apps/`. Only `name` and `path` (absolute) are
 * guaranteed: an app directory without a package.json is listed bare, and
 * `team` is whatever the package.json `author` field holds (string or object).
 */
export const microfrontendWireSchema = z.looseObject({
  name: z.string(),
  path: z.string(),
  version: z.string().optional(),
  team: z.unknown().optional(),
  route: z.string().optional(),
});
export type MicrofrontendWire = z.infer<typeof microfrontendWireSchema>;

/**
 * `data` of `list --json`. A project with microfrontends emits
 * `{ microfrontends: [...] }`; a project whose `apps/` folder holds none emits a
 * bare empty array (with a warning). Both are part of the wire contract.
 */
export const microfrontendListWireSchema = z.union([
  z.looseObject({ microfrontends: z.array(microfrontendWireSchema) }),
  z.array(z.never()),
]);
export type MicrofrontendListWire = z.infer<typeof microfrontendListWireSchema>;
