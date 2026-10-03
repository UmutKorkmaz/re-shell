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
