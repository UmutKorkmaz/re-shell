import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { fail } from './json-output';
import { ValidationError } from './error-handler';
import {
  DEFAULT_WORKSPACE_DEFINITION,
  WorkspaceDefinition,
  WorkspaceDependency,
  WorkspaceEntry,
  WorkspaceSchemaValidator,
  loadWorkspaceDefinition,
} from './workspace-schema';
import { WorkspaceInfo, findMonorepoRoot, getWorkspaces } from './monorepo';

/**
 * Adapter between the two workspace models the CLI knows about:
 *
 *  - the *detected* model (`getWorkspaces()`): whatever the package manager
 *    declares (`workspaces` in package.json / `pnpm-workspace.yaml`), available
 *    in every plain npm/yarn/pnpm monorepo, and
 *  - the *rich* model (`WorkspaceDefinition`): the `re-shell.workspaces.yaml`
 *    document the graph-analysis and diagnostics engines operate on.
 *
 * Before this adapter those engines refused to run without the yaml. The
 * adapter derives an honest `WorkspaceDefinition` from the detected workspaces
 * so the engines work on any plain monorepo. Nothing is invented: only data the
 * package manifests actually carry (names, paths, dependency edges) ends up in
 * the derived definition. Where data is genuinely missing (no monorepo, or a
 * monorepo with zero workspaces) resolution fails with an explicit
 * {@link WorkspaceDefinitionError} instead of fabricating an empty definition.
 */

/** Default file name of the rich workspace definition document. */
export const DEFAULT_WORKSPACE_DEFINITION_FILE = 're-shell.workspaces.yaml';

/** Machine-readable reasons a definition could not be resolved. */
export type WorkspaceDefinitionErrorCode =
  | 'NOT_IN_MONOREPO'
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_DEFINITION_ERROR';

/**
 * Raised when no workspace definition could be loaded or derived. Carries the
 * JSON error code the calling command should surface.
 */
export class WorkspaceDefinitionError extends Error {
  readonly code: WorkspaceDefinitionErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: WorkspaceDefinitionErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkspaceDefinitionError';
    this.code = code;
    this.details = details;
  }
}

/** The slice of a workspace `package.json` the adapter reads for dependency edges. */
export interface WorkspaceManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  description?: string;
}

/** Options accepted by {@link toWorkspaceDefinition}. */
export interface ToWorkspaceDefinitionOptions {
  /** Name of the derived definition. Defaults to `"monorepo"`. */
  name?: string;
  /** Description of the derived definition. */
  description?: string;
  /** Definition root, relative to the definition. Defaults to `"."`. */
  root?: string;
  /**
   * Discovery patterns. Defaults to one `<parent>/*` pattern per distinct parent
   * directory of the detected workspaces (e.g. `packages/*`, `apps/*`).
   */
  patterns?: string[];
  /**
   * Per-workspace manifests, keyed by the workspace's relative path. When given,
   * dependency edges keep their real kind (`dependencies` -> runtime,
   * `devDependencies` -> dev) and version ranges; without it every edge is
   * `runtime` because {@link WorkspaceInfo} only carries merged names.
   */
  manifests?: Record<string, WorkspaceManifest>;
}

function stripScope(name: string): string {
  return name.startsWith('@') && name.includes('/') ? name.slice(name.indexOf('/') + 1) : name;
}

function slug(value: string): string {
  return value
    .replace(/^@/, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Pick a unique definition key for every workspace. The unscoped package name is
 * preferred (it matches the kebab-case convention the health checks look for);
 * collisions fall back to `scope-name`, then to the path slug, so keys are
 * deterministic and unique.
 */
function assignKeys(workspaces: readonly WorkspaceInfo[]): Map<WorkspaceInfo, string> {
  const keys = new Map<WorkspaceInfo, string>();
  const taken = new Set<string>();

  const byUnscoped = new Map<string, WorkspaceInfo[]>();
  for (const ws of workspaces) {
    const base = stripScope(ws.name);
    const group = byUnscoped.get(base) ?? [];
    group.push(ws);
    byUnscoped.set(base, group);
  }

  for (const ws of workspaces) {
    const base = stripScope(ws.name);
    const group = byUnscoped.get(base) ?? [];
    const candidates =
      group.length === 1
        ? [base]
        : [slug(ws.name), `${slug(ws.name)}-${slug(ws.path)}`, slug(ws.path)];
    let key = candidates.find(c => c.length > 0 && !taken.has(c));
    if (!key) {
      let n = 2;
      key = `${slug(ws.path) || base}-${n}`;
      while (taken.has(key)) key = `${slug(ws.path) || base}-${++n}`;
    }
    taken.add(key);
    keys.set(ws, key);
  }
  return keys;
}

function derivePatterns(workspaces: readonly WorkspaceInfo[]): string[] {
  const patterns = new Set<string>();
  for (const ws of workspaces) {
    const dir = path.posix.dirname(ws.path.split(path.sep).join('/'));
    patterns.add(dir === '.' ? ws.path : `${dir}/*`);
  }
  return [...patterns].sort();
}

function cloneTypes(): WorkspaceDefinition['types'] {
  const types = JSON.parse(JSON.stringify(DEFAULT_WORKSPACE_DEFINITION.types)) as WorkspaceDefinition['types'];
  // getWorkspaces() classifies `libs/*` as `lib`, which the stock definition has
  // no type for; derive it from `package` so every detected workspace has a type.
  if (!types.lib) {
    types.lib = { ...JSON.parse(JSON.stringify(types.package)), name: 'Library', description: 'Library workspaces' };
  }
  return types;
}

function dependencyEdges(
  ws: WorkspaceInfo,
  keyByPackageName: ReadonlyMap<string, string>,
  selfKey: string,
  manifest?: WorkspaceManifest
): WorkspaceDependency[] {
  const edges = new Map<string, WorkspaceDependency>();

  const add = (
    pkg: string,
    type: WorkspaceDependency['type'],
    version?: string,
    optional?: boolean
  ): void => {
    const target = keyByPackageName.get(pkg);
    if (!target || target === selfKey) return;
    const existing = edges.get(target);
    // A runtime edge outranks a dev-only edge to the same workspace.
    if (existing && (existing.type === 'runtime' || type !== 'runtime')) return;
    edges.set(target, {
      name: target,
      type,
      ...(version ? { version } : {}),
      ...(optional ? { optional: true } : {}),
    });
  };

  if (manifest) {
    for (const [pkg, range] of Object.entries(manifest.dependencies ?? {})) add(pkg, 'runtime', range);
    for (const [pkg, range] of Object.entries(manifest.peerDependencies ?? {})) add(pkg, 'runtime', range, true);
    for (const [pkg, range] of Object.entries(manifest.optionalDependencies ?? {})) add(pkg, 'runtime', range, true);
    for (const [pkg, range] of Object.entries(manifest.devDependencies ?? {})) add(pkg, 'dev', range);
  } else {
    for (const pkg of ws.dependencies) add(pkg, 'runtime');
  }

  return [...edges.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Derive a {@link WorkspaceDefinition} from the workspaces the package manager
 * declares. Pure: no filesystem access.
 *
 * - every detected workspace becomes a `workspaces` entry (key = unscoped
 *   package name, `path` = its relative path, `type` as classified by
 *   `getWorkspaces()`),
 * - workspace-to-workspace dependency edges become `dependencies`
 *   (external packages are ignored),
 * - the stock workspace types are attached so type checks resolve.
 *
 * @param workspaces - Workspaces from `getWorkspaces()`.
 * @param options - Naming, root, pattern and manifest overrides.
 * @returns The derived definition.
 * @throws {WorkspaceDefinitionError} `WORKSPACE_NOT_FOUND` when `workspaces` is empty.
 */
export function toWorkspaceDefinition(
  workspaces: readonly WorkspaceInfo[],
  options: ToWorkspaceDefinitionOptions = {}
): WorkspaceDefinition {
  if (workspaces.length === 0) {
    throw new WorkspaceDefinitionError(
      'WORKSPACE_NOT_FOUND',
      'No workspaces were detected, so no workspace definition can be derived. ' +
        'Declare workspaces in package.json / pnpm-workspace.yaml or create re-shell.workspaces.yaml.'
    );
  }

  const keys = assignKeys(workspaces);
  const keyByPackageName = new Map<string, string>();
  for (const ws of workspaces) keyByPackageName.set(ws.name, keys.get(ws)!);

  const entries: Record<string, WorkspaceEntry> = {};
  const dependencies: Record<string, WorkspaceDependency[]> = {};

  for (const ws of [...workspaces].sort((a, b) => a.path.localeCompare(b.path))) {
    const key = keys.get(ws)!;
    const manifest = options.manifests?.[ws.path];
    entries[key] = {
      name: key,
      type: ws.type,
      path: ws.path,
      ...(manifest?.description ? { description: manifest.description } : {}),
      metadata: {
        packageName: ws.name,
        version: ws.version,
        ...(ws.framework ? { framework: ws.framework } : {}),
        derived: true,
      },
    };
    const edges = dependencyEdges(ws, keyByPackageName, key, manifest);
    if (edges.length > 0) dependencies[key] = edges;
  }

  return {
    version: '1.0',
    name: options.name ?? 'monorepo',
    description:
      options.description ?? 'Derived from the detected workspaces (no re-shell.workspaces.yaml)',
    root: options.root ?? '.',
    patterns: options.patterns ?? derivePatterns(workspaces),
    types: cloneTypes(),
    workspaces: entries,
    dependencies,
    // Nothing is configured when deriving; the stock definition's build/dev/test
    // tuning and placeholder scripts are deliberately not claimed here.
    build: {},
    dev: {},
    test: {},
    scripts: {},
  };
}

async function readManifest(rootPath: string, workspacePath: string): Promise<WorkspaceManifest | undefined> {
  try {
    return (await fs.readJson(path.join(rootPath, workspacePath, 'package.json'))) as WorkspaceManifest;
  } catch {
    return undefined;
  }
}

/** Where a resolved definition came from. */
export type WorkspaceDefinitionSource = 'file' | 'derived';

/** A resolved definition plus the provenance callers surface to the user. */
export interface ResolvedWorkspaceDefinition {
  definition: WorkspaceDefinition;
  source: WorkspaceDefinitionSource;
  /** Absolute path of the yaml file when `source` is `"file"`. */
  file?: string;
  /** Absolute directory workspace paths in the definition are relative to. */
  rootPath: string;
}

/**
 * Derive a definition for the monorepo containing `cwd`, reading each workspace
 * manifest so dependency kinds and ranges are preserved, and validating the
 * result with the same schema validator the yaml path uses.
 *
 * @throws {WorkspaceDefinitionError} `NOT_IN_MONOREPO` when `cwd` is not inside a
 *   monorepo, `WORKSPACE_NOT_FOUND` when it declares no workspaces, and
 *   `WORKSPACE_DEFINITION_ERROR` when the derived definition fails validation.
 */
export async function deriveWorkspaceDefinition(cwd: string = process.cwd()): Promise<ResolvedWorkspaceDefinition> {
  const rootPath = await findMonorepoRoot(cwd);
  if (!rootPath) {
    throw new WorkspaceDefinitionError(
      'NOT_IN_MONOREPO',
      `Not inside a monorepo (no package.json "workspaces" or pnpm-workspace.yaml found from ${cwd}), ` +
        'and no re-shell.workspaces.yaml exists.',
      { cwd }
    );
  }

  let detected: WorkspaceInfo[];
  try {
    detected = await getWorkspaces(rootPath);
  } catch (error) {
    throw new WorkspaceDefinitionError(
      'WORKSPACE_DEFINITION_ERROR',
      `Could not detect workspaces in ${rootPath}: ${error instanceof Error ? error.message : String(error)}`,
      { rootPath }
    );
  }

  const manifests: Record<string, WorkspaceManifest> = {};
  for (const ws of detected) {
    const manifest = await readManifest(rootPath, ws.path);
    if (manifest) manifests[ws.path] = manifest;
  }

  let rootName = path.basename(rootPath);
  try {
    const rootPkg = (await fs.readJson(path.join(rootPath, 'package.json'))) as { name?: string };
    if (rootPkg.name) rootName = rootPkg.name;
  } catch {
    // The directory name is an honest fallback for the definition name.
  }

  let definition: WorkspaceDefinition;
  try {
    definition = toWorkspaceDefinition(detected, { name: rootName, manifests });
  } catch (error) {
    if (error instanceof WorkspaceDefinitionError) {
      throw new WorkspaceDefinitionError(error.code, error.message, { rootPath });
    }
    throw error;
  }

  const validation = await new WorkspaceSchemaValidator(definition, rootPath).validateDefinition();
  if (!validation.valid) {
    throw new WorkspaceDefinitionError(
      'WORKSPACE_DEFINITION_ERROR',
      `Derived workspace definition is invalid: ${validation.errors.map(e => e.message).join(', ')}`,
      { rootPath }
    );
  }

  return { definition, source: 'derived', rootPath };
}

/** Options for {@link resolveWorkspaceDefinition}. */
export interface ResolveWorkspaceDefinitionOptions {
  /** Definition file as given on the command line. Defaults to `re-shell.workspaces.yaml`. */
  file?: string;
  /** Directory to resolve `file` and detect workspaces from. Defaults to `process.cwd()`. */
  cwd?: string;
}

/**
 * Resolve the workspace definition a graph/diagnostics command should operate on.
 *
 * 1. If the definition file exists it is loaded and validated (`source: "file"`).
 * 2. If it does not exist and the file is the default one, the definition is
 *    derived from the detected workspaces (`source: "derived"`).
 * 3. If the user explicitly named a file that does not exist, resolution fails
 *    rather than silently analyzing something else.
 *
 * @throws {WorkspaceDefinitionError} See {@link deriveWorkspaceDefinition}; an
 *   explicit missing file reports `WORKSPACE_NOT_FOUND`; an invalid yaml reports
 *   `WORKSPACE_DEFINITION_ERROR`.
 */
export async function resolveWorkspaceDefinition(
  options: ResolveWorkspaceDefinitionOptions = {}
): Promise<ResolvedWorkspaceDefinition> {
  const cwd = options.cwd ?? process.cwd();
  const requested = options.file ?? DEFAULT_WORKSPACE_DEFINITION_FILE;
  const filePath = path.resolve(cwd, requested);

  if (await fs.pathExists(filePath)) {
    try {
      const definition = await loadWorkspaceDefinition(filePath);
      return { definition, source: 'file', file: filePath, rootPath: path.dirname(filePath) };
    } catch (error) {
      throw new WorkspaceDefinitionError(
        'WORKSPACE_DEFINITION_ERROR',
        error instanceof Error ? error.message : String(error),
        { file: filePath }
      );
    }
  }

  if (requested !== DEFAULT_WORKSPACE_DEFINITION_FILE) {
    throw new WorkspaceDefinitionError(
      'WORKSPACE_NOT_FOUND',
      `No workspace definition found at ${filePath}`,
      { file: filePath }
    );
  }

  return deriveWorkspaceDefinition(cwd);
}

/** Human-readable note surfaced (as a JSON warning) when a definition was derived. */
export function derivedDefinitionNote(resolved: ResolvedWorkspaceDefinition): string | undefined {
  return resolved.source === 'derived'
    ? `No ${DEFAULT_WORKSPACE_DEFINITION_FILE} found; derived the workspace definition from the ${
        Object.keys(resolved.definition.workspaces).length
      } detected workspace(s) in ${resolved.rootPath}`
    : undefined;
}

/**
 * Pick the JSON error code for a failure while loading or using a workspace
 * definition: the adapter's own code when it threw, `WORKSPACE_NOT_FOUND` for the
 * loader's "file not found" validation error, otherwise
 * `WORKSPACE_DEFINITION_ERROR`.
 *
 * @param error - The caught value.
 * @returns The error code to report.
 */
export function workspaceDefinitionErrorCode(
  error: unknown
): 'NOT_IN_MONOREPO' | 'WORKSPACE_NOT_FOUND' | 'WORKSPACE_DEFINITION_ERROR' {
  if (error instanceof WorkspaceDefinitionError) {
    return error.code;
  }
  if (error instanceof ValidationError && /not found/i.test(error.message)) {
    return 'WORKSPACE_NOT_FOUND';
  }
  return 'WORKSPACE_DEFINITION_ERROR';
}

/**
 * Report that a command which needs a workspace definition could not find it.
 *
 * JSON mode: a `WORKSPACE_NOT_FOUND` error envelope. Human mode: the usual hint,
 * and, so the command no longer "succeeds" without doing its job, a non-zero
 * exit code.
 *
 * @param options - `json` selects the mode; `file` is the definition path that
 *   was expected; `spinner` (optional) is stopped before printing.
 */
export function reportMissingWorkspaceDefinition(options: {
  json?: boolean;
  file: string;
  spinner?: { stop(): unknown };
}): void {
  const resolved = path.resolve(options.file);
  if (options.spinner) {
    options.spinner.stop();
  }
  if (options.json) {
    fail('WORKSPACE_NOT_FOUND', `No workspace definition found at ${resolved}`, { file: resolved });
    return;
  }
  console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
  console.log(chalk.gray(`Expected: ${options.file}`));
  console.log(chalk.cyan("\nRun 're-shell workspace-def init' to initialize your workspace."));
  process.exitCode = 1;
}
