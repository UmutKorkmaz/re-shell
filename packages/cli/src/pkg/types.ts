// Types for the unified package-manager abstraction (`re-shell pkg`).

export const ECOSYSTEMS = [
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
] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const PKG_OPERATIONS = ['add', 'remove', 'install', 'list', 'outdated'] as const;
export type PkgOperation = (typeof PKG_OPERATIONS)[number];

export type DependencyKind = 'prod' | 'dev' | 'optional' | 'peer' | 'build' | 'indirect';

/** Normalized dependency declaration parsed from a manifest. */
export interface PkgDependency {
  name: string;
  /** Requested version/constraint exactly as written, or null when absent. */
  requested: string | null;
  kind: DependencyKind;
  ecosystem: Ecosystem;
  /** Manifest file (relative to the target dir) the entry came from. */
  manifest: string;
}

/** Normalized outdated entry. */
export interface PkgOutdated {
  name: string;
  current: string | null;
  /** Newest version satisfying the declared range, when the tool reports it. */
  wanted: string | null;
  latest: string;
  kind: DependencyKind | null;
  ecosystem: Ecosystem;
}

/** One native command (argv, never a shell string). */
export interface PlannedCommand {
  argv: string[];
  cwd: string;
  purpose: string;
  /** Exit codes treated as success (default [0]); e.g. `npm outdated` exits 1 when outdated. */
  okExitCodes?: number[];
  /** Regex source: a successful exit whose stdout matches it is still a failure (gradle prints FAILED but exits 0). */
  failPattern?: string;
}

/** A manifest edit performed by re-shell itself where no native command exists. */
export interface ManifestEditPlan {
  kind: 'pip-requirements' | 'maven-pom' | 'gradle-build';
  /** Absolute path of the file edited. */
  file: string;
  action: 'add' | 'remove';
  entries: string[];
  /** Run before the native commands (maven/gradle) or after they succeed (pip). */
  phase: 'before' | 'after';
}

export interface OperationPlan {
  commands: PlannedCommand[];
  edits: ManifestEditPlan[];
}

/** Error carrying a machine-readable code (mapped onto the JSON envelope). */
export type PkgErrorCode =
  | 'PKG_ERROR'
  | 'PKG_TOOLCHAIN_MISSING'
  | 'PKG_ECOSYSTEM_UNDETECTED'
  | 'PKG_ECOSYSTEM_AMBIGUOUS'
  | 'PKG_UNSUPPORTED_OPERATION'
  | 'PKG_INVALID_ARGS'
  | 'PKG_COMMAND_FAILED';

export class PkgError extends Error {
  constructor(
    public readonly code: PkgErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PkgError';
  }
}
