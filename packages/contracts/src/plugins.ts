import { z } from 'zod';

// ---------------------------------------------------------------------------
// Plugin lifecycle, marketplace data and policy-pack distribution (P9-F + P9-G1)
//
// Wire payloads for `re-shell plugin list|info|uninstall|update|validate|pin|
// unpin|review` and `re-shell workspace policy search|install|list|remove|check`.
// Every payload is the `data` of the canonical `{ ok, data, warnings }` envelope
// (see ./envelope). Commands that detect a failing run (a failed update, an
// invalid plugin) emit `ok:false` with the same payload under `error.details`
// so machine consumers get the full report AND a non-zero exit.
// ---------------------------------------------------------------------------

// --- shared ----------------------------------------------------------------

/**
 * Where an installed plugin came from. `npm`/`git`/`local` are plugins that the
 * CLI installed itself (recorded in `.re-shell/plugins.json`); `workspace` is a
 * plugin directory that was dropped into `.re-shell/plugins` or `plugins/` by
 * hand; `node_modules`/`global`/`builtin` were discovered on disk.
 */
export const pluginOriginSchema = z.enum([
  'npm',
  'git',
  'local',
  'workspace',
  'node_modules',
  'global',
  'builtin',
]);
export type PluginOrigin = z.infer<typeof pluginOriginSchema>;

/** Outcome of the (config-gated) npm registry signature check. */
export const pluginSignatureSchema = z.object({
  /** True only when a registry signature cryptographically validated. */
  verified: z.boolean(),
  /** True when verification was required (enabled) for this operation. */
  gated: z.boolean(),
  /** The registry key id that validated the signature, when verified. */
  keyid: z.string().optional(),
  /** Why verification failed or was skipped. */
  reason: z.string().optional(),
});
export type PluginSignature = z.infer<typeof pluginSignatureSchema>;

// --- reviews ---------------------------------------------------------------

/** One team review stored in `.re-shell/plugin-reviews.json`. */
export const pluginReviewSchema = z.object({
  id: z.string(),
  plugin: z.string(),
  /** Integer 1-5. */
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  author: z.string(),
  /** Plugin version the review was written against, when known. */
  version: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});
export type PluginReview = z.infer<typeof pluginReviewSchema>;

/** Aggregate of the team reviews for one plugin. */
export const pluginReviewAggregateSchema = z.object({
  count: z.number().int().nonnegative(),
  /** Mean rating (1 decimal); null when there are no reviews. */
  average: z.number().nullable(),
  /** Count per star value, keys "1".."5". */
  distribution: z.record(z.string(), z.number()),
});
export type PluginReviewAggregate = z.infer<typeof pluginReviewAggregateSchema>;

/** Payload of `plugin review add <name> --json`. */
export const pluginReviewAddResponseSchema = z.object({
  review: pluginReviewSchema,
  /** True when an earlier review by the same author was replaced. */
  updated: z.boolean(),
  aggregate: pluginReviewAggregateSchema,
  /** Workspace-relative path of the shared review file. */
  file: z.string(),
});
export type PluginReviewAddResponse = z.infer<typeof pluginReviewAddResponseSchema>;

/** Payload of `plugin review list <name> --json`. */
export const pluginReviewListResponseSchema = z.object({
  plugin: z.string(),
  reviews: z.array(pluginReviewSchema),
  aggregate: pluginReviewAggregateSchema,
});
export type PluginReviewListResponse = z.infer<typeof pluginReviewListResponseSchema>;

// --- quality / ratings -----------------------------------------------------

/**
 * Real registry-derived quality data for a published plugin. `npms` means the
 * scores were returned by api.npms.io; `npm-registry` means npms.io was not
 * usable and the values were derived locally from npm download counts and
 * registry metadata (`derived: true`, with the raw `signals` included);
 * `unavailable` means nothing could be fetched (no fabricated numbers).
 */
export const pluginQualitySchema = z.object({
  source: z.enum(['npms', 'npm-registry', 'unavailable']),
  /** 0-5 rating derived from `score`; null when unavailable. */
  rating: z.number().min(0).max(5).nullable(),
  /** Overall 0-1 score; null when unavailable. */
  score: z.number().min(0).max(1).nullable(),
  quality: z.number().min(0).max(1).nullable(),
  popularity: z.number().min(0).max(1).nullable(),
  maintenance: z.number().min(0).max(1).nullable(),
  downloadsLastMonth: z.number().nullable(),
  /** ISO timestamp the data was fetched from the network. */
  fetchedAt: z.string(),
  /** True when served from the local cache. */
  cached: z.boolean(),
  /** True when the cache entry was past its TTL and the network failed. */
  stale: z.boolean(),
  /** True when `score` was computed locally rather than returned by npms. */
  derived: z.boolean(),
  /** Raw inputs (downloads, last publish, versions, ...) behind a derived score. */
  signals: z.record(z.string(), z.unknown()).optional(),
  /** Why data is unavailable, when it is. */
  error: z.string().optional(),
});
export type PluginQuality = z.infer<typeof pluginQualitySchema>;

// --- list / info -----------------------------------------------------------

/** One installed plugin as reported by `plugin list --json`. */
export const pluginListItemSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  path: z.string(),
  origin: pluginOriginSchema,
  /** Lifecycle state (unloaded, loaded, initialized, active, error, ...). */
  state: z.string(),
  isLoaded: z.boolean(),
  isActive: z.boolean(),
  usageCount: z.number(),
  /** Pinned exact version / semver range / git commit, or null. */
  pin: z.string().nullable(),
  installedAt: z.string().nullable(),
  /** True when the plugin is recorded in `.re-shell/plugins.json`. */
  managed: z.boolean(),
  reviews: pluginReviewAggregateSchema,
});
export type PluginListItem = z.infer<typeof pluginListItemSchema>;

/** Payload of `plugin list --json`. */
export const pluginListResponseSchema = z.object({
  plugins: z.array(pluginListItemSchema),
  total: z.number().int().nonnegative(),
});
export type PluginListResponse = z.infer<typeof pluginListResponseSchema>;

/** Recorded install provenance (from `.re-shell/plugins.json`). */
export const pluginInstallRecordSchema = z.object({
  source: z.enum(['npm', 'git', 'local']),
  spec: z.string().nullable(),
  installedAt: z.string(),
  updatedAt: z.string().nullable(),
  git: z
    .object({
      url: z.string(),
      ref: z.string().nullable(),
      commit: z.string().nullable(),
    })
    .nullable(),
  integrity: z.string().nullable(),
  signature: pluginSignatureSchema.nullable(),
});
export type PluginInstallRecord = z.infer<typeof pluginInstallRecordSchema>;

/** Payload of `plugin info <name> --json`. */
export const pluginInfoResponseSchema = pluginListItemSchema.extend({
  manifest: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    main: z.string(),
    author: z.string().nullable(),
    license: z.string().nullable(),
    homepage: z.string().nullable(),
    keywords: z.array(z.string()),
    engines: z.record(z.string(), z.string()).nullable(),
    dependencies: z.record(z.string(), z.string()).nullable(),
    peerDependencies: z.record(z.string(), z.string()).nullable(),
    reshell: z.unknown().nullable(),
  }),
  install: pluginInstallRecordSchema.nullable(),
  lifecycle: z.object({
    lastUsed: z.number().nullable(),
    loadMs: z.number(),
    initMs: z.number(),
    activationMs: z.number(),
    errors: z.array(
      z.object({ stage: z.string(), message: z.string(), timestamp: z.number() })
    ),
  }),
  dependencies: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      required: z.boolean(),
      resolved: z.boolean(),
    })
  ),
  dependents: z.array(z.string()),
  /** Most recent team reviews (newest first). */
  recentReviews: z.array(pluginReviewSchema),
  /** Registry quality data; null when not applicable or fetching was skipped. */
  quality: pluginQualitySchema.nullable(),
});
export type PluginInfoResponse = z.infer<typeof pluginInfoResponseSchema>;

// --- uninstall -------------------------------------------------------------

/** Payload of `plugin uninstall <name> --json`. */
export const pluginUninstallResponseSchema = z.object({
  name: z.string(),
  version: z.string().nullable(),
  dryRun: z.boolean(),
  removed: z.object({
    /** Absolute paths deleted from disk (plugin dir, cache dir, ...). */
    paths: z.array(z.string()),
    /** True when the `.re-shell/plugins.json` entry was removed. */
    registryEntry: z.boolean(),
  }),
  /** Paths intentionally left in place (e.g. plugin data without --purge). */
  kept: z.array(z.string()),
  deregistered: z.object({
    /** True when a loaded/active plugin instance was deactivated and unloaded. */
    unloaded: z.boolean(),
    hooks: z.number().int().nonnegative(),
    commands: z.number().int().nonnegative(),
  }),
});
export type PluginUninstallResponse = z.infer<typeof pluginUninstallResponseSchema>;

// --- update ----------------------------------------------------------------

export const pluginUpdateStatusSchema = z.enum([
  'up-to-date',
  'update-available',
  'updated',
  'pinned',
  'not-updatable',
  'failed',
]);
export type PluginUpdateStatus = z.infer<typeof pluginUpdateStatusSchema>;

/** One plugin's update outcome. */
export const pluginUpdateItemSchema = z.object({
  name: z.string(),
  source: z.enum(['npm', 'git', 'local']),
  /** Version recorded at install time. */
  installed: z.string(),
  /** Version/commit the update resolves to (respecting the pin); null if unknown. */
  target: z.string().nullable(),
  /** Newest version the registry advertises under `latest`; null if unknown. */
  latest: z.string().nullable(),
  pin: z.string().nullable(),
  status: pluginUpdateStatusSchema,
  message: z.string().nullable(),
  signature: pluginSignatureSchema.nullable(),
});
export type PluginUpdateItem = z.infer<typeof pluginUpdateItemSchema>;

/** Payload of `plugin update [name] [--check] --json`. */
export const pluginUpdateResponseSchema = z.object({
  /** True for `--check`: nothing was changed. */
  checkOnly: z.boolean(),
  plugins: z.array(pluginUpdateItemSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    updateAvailable: z.number().int().nonnegative(),
    upToDate: z.number().int().nonnegative(),
    pinned: z.number().int().nonnegative(),
    notUpdatable: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
});
export type PluginUpdateResponse = z.infer<typeof pluginUpdateResponseSchema>;

// --- validate --------------------------------------------------------------

export const pluginFindingCategorySchema = z.enum([
  'manifest',
  'entry',
  'engines',
  'dependencies',
  'security',
  'size',
]);
export type PluginFindingCategory = z.infer<typeof pluginFindingCategorySchema>;

/** One validation finding. `error` findings make the plugin invalid. */
export const pluginFindingSchema = z.object({
  /** Stable rule id, e.g. `entry-missing`, `security-eval`. */
  id: z.string(),
  category: pluginFindingCategorySchema,
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  /** Plugin-relative file for source-level findings. */
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
});
export type PluginFinding = z.infer<typeof pluginFindingSchema>;

/**
 * Payload of `plugin validate <path> --json`. Emitted as `data` when the plugin
 * is valid and as `error.details` (with `valid:false`) when it is not.
 */
export const pluginValidateResponseSchema = z.object({
  path: z.string(),
  name: z.string().nullable(),
  version: z.string().nullable(),
  valid: z.boolean(),
  /** True when warnings were promoted to errors (`--strict`). */
  strict: z.boolean(),
  cliVersion: z.string(),
  findings: z.array(pluginFindingSchema),
  counts: z.object({
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  }),
  size: z.object({ bytes: z.number(), files: z.number() }),
  engines: z.object({
    reshellCli: z.string().nullable(),
    node: z.string().nullable(),
    /** True/false when evaluated against the running CLI; null if undeclared. */
    reshellCliSatisfied: z.boolean().nullable(),
    nodeSatisfied: z.boolean().nullable(),
  }),
  /** Per-category verdict. */
  checks: z.record(z.string(), z.enum(['pass', 'warn', 'fail', 'skip'])),
});
export type PluginValidateResponse = z.infer<typeof pluginValidateResponseSchema>;

// --- pin -------------------------------------------------------------------

/** Payload of `plugin pin|unpin <name> --json`. */
export const pluginPinResponseSchema = z.object({
  name: z.string(),
  /** The pin now in effect, or null after `unpin`. */
  pin: z.string().nullable(),
  previousPin: z.string().nullable(),
  installed: z.string(),
});
export type PluginPinResponse = z.infer<typeof pluginPinResponseSchema>;

// --- policy packs ----------------------------------------------------------

export const policyPackSourceSchema = z.enum(['builtin', 'npm', 'git', 'local']);
export type PolicyPackSource = z.infer<typeof policyPackSourceSchema>;

/** One policy pack (built-in or installed) as listed by `workspace policy list`. */
export const policyPackSummarySchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  version: z.string().nullable(),
  source: policyPackSourceSchema,
  ruleCount: z.number().int().nonnegative(),
  /** npm package (or git/local package) name the pack was installed from. */
  package: z.string().nullable(),
  /** Absolute path of the stored pack file; null for built-ins. */
  path: z.string().nullable(),
  installedAt: z.string().nullable(),
  /** sha256 of the stored pack file; null for built-ins. */
  sha256: z.string().nullable(),
});
export type PolicyPackSummary = z.infer<typeof policyPackSummarySchema>;

/** Payload of `workspace policy list --json`. */
export const policyListResponseSchema = z.object({
  packs: z.array(policyPackSummarySchema),
  total: z.number().int().nonnegative(),
});
export type PolicyListResponse = z.infer<typeof policyListResponseSchema>;

/** One registry search hit for a `reshell-policy-pack` package. */
export const policySearchHitSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  publisher: z.string().nullable(),
  date: z.string().nullable(),
  homepage: z.string().nullable(),
  repository: z.string().nullable(),
});
export type PolicySearchHit = z.infer<typeof policySearchHitSchema>;

/** Payload of `workspace policy search <query> --json`. */
export const policySearchResponseSchema = z.object({
  query: z.string().nullable(),
  packs: z.array(policySearchHitSchema),
  total: z.number().int().nonnegative(),
});
export type PolicySearchResponse = z.infer<typeof policySearchResponseSchema>;

/** Payload of `workspace policy install <source> --json`. */
export const policyInstallResponseSchema = z.object({
  name: z.string(),
  version: z.string().nullable(),
  source: policyPackSourceSchema,
  package: z.string().nullable(),
  /** Absolute path of the stored pack file. */
  path: z.string(),
  ruleCount: z.number().int().nonnegative(),
  replaced: z.boolean(),
  dryRun: z.boolean(),
  sha256: z.string(),
  signature: pluginSignatureSchema.nullable(),
});
export type PolicyInstallResponse = z.infer<typeof policyInstallResponseSchema>;

/** Payload of `workspace policy remove <name> --json`. */
export const policyRemoveResponseSchema = z.object({
  name: z.string(),
  removed: z.array(z.string()),
});
export type PolicyRemoveResponse = z.infer<typeof policyRemoveResponseSchema>;
