import { z } from 'zod';

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
