import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';
import { RECOGNIZED_PKG_SCOPES } from './scope';
import {
  upsertPluginEntry,
  pluginsDir,
  readPluginsFile,
  type PluginGitRecord,
  type PluginInstallSource,
  type PluginSignatureRecord,
} from './plugin-store';

export type { PluginInstallSource } from './plugin-store';

/**
 * Real plugin installer for `re-shell plugin install`.
 *
 * Resolves a plugin identifier from one of three sources, validates the plugin
 * manifest, copies/clones/extracts it into `<workspace>/.re-shell/plugins/<name>`,
 * and registers it in the workspace plugin registry (`.re-shell/plugins.json`).
 *
 * This module is intentionally free of CLI/chalk/spinner concerns so it can be
 * unit-tested directly and reused by the command layer, the updater, the
 * marketplace and the policy-pack installer.
 */

/** Subset of a plugin's package.json the installer cares about. */
export interface PluginManifestData {
  /** Package name; must be a non-empty string for a valid plugin. */
  name: string;
  /** Semver-style version string; must be a non-empty string for a valid plugin. */
  version: string;
  /** Optional human-readable description of the package. */
  description?: string;
  /** Optional entry-point module relative path (e.g. `"dist/index.js"`). */
  main?: string;
  /** Optional npm keywords; presence of `"reshell-plugin"` marks a valid plugin. */
  keywords?: string[];
  /** Optional Re-Shell manifest block; presence marks a valid plugin. */
  reshell?: unknown;
  /** Optional legacy Re-Shell plugin manifest key; presence marks a valid plugin. */
  'reshell-plugin'?: unknown;
  /** Optional Re-Shell CLI manifest key; presence marks a valid plugin. */
  'reshell-cli'?: unknown;
  /** Index signature allowing any other package.json fields to pass through. */
  [key: string]: unknown;
}

/** Outcome of a successful install (or a dry-run resolve+validate). */
export interface PluginInstallResult {
  /** Resolved plugin package name from its manifest. */
  name: string;
  /** Resolved plugin version from its manifest. */
  version: string;
  /** Source the plugin was resolved from. */
  source: PluginInstallSource;
  /** Final on-disk location, or the would-be location for a dry run. */
  path: string;
  /** True when nothing was written (dry run). */
  dryRun: boolean;
  /** The pin recorded for this install, when one was requested. */
  pin?: string;
  /** Resolved git commit for git installs. */
  commit?: string;
}

/** Options accepted by {@link installPluginFromIdentifier}. */
export interface PluginInstallOptions {
  /** Workspace root that owns `.re-shell/plugins`. Defaults to process.cwd(). */
  workspaceRoot?: string;
  /** Resolve + validate only; never write to disk or registry. */
  dryRun?: boolean;
  /** Overwrite an existing plugin dir of the same name. */
  force?: boolean;
  /**
   * Record a version pin. `true` pins what the identifier asked for (an exact
   * version or semver range for `name@spec`), falling back to the resolved
   * version (npm/local) or commit (git). A string pins that exact value.
   */
  pin?: boolean | string;
  /** npm registry URL passed to `npm pack` (defaults to the user's npm config). */
  registry?: string;
  /** Signature/integrity facts to record alongside the entry (set by callers that verified). */
  record?: { integrity?: string; signature?: PluginSignatureRecord };
}

/**
 * Raised for every install failure so the command layer can map to
 * PLUGIN_INSTALL_ERROR. Carries an optional `details` bag for structured
 * error reporting (e.g. the offending plugin name or path).
 */
export class PluginInstallError extends Error {
  /** Optional structured details describing the failure context. */
  readonly details?: Record<string, unknown>;
  /**
   * Create a new PluginInstallError.
   *
   * @param message - Human-readable error message.
   * @param details - Optional structured details forwarded to the caller
   *   (e.g. `{ name, path }`) for richer reporting.
   */
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PluginInstallError';
    this.details = details;
  }
}

/**
 * Classify a raw identifier into a source. Order matters:
 *  1. An existing path on disk -> local.
 *  2. A git URL (git+, .git suffix, ssh form, or known host) -> git.
 *  3. Anything else -> npm package spec.
 *
 * @param identifier - Raw user-supplied plugin identifier (path, git URL, or npm spec).
 * @returns The resolved {@link PluginInstallSource}.
 */
export function classifySource(identifier: string): PluginInstallSource {
  if (fs.existsSync(identifier)) {
    return 'local';
  }
  if (isGitUrl(identifier)) {
    return 'git';
  }
  return 'npm';
}

function isGitUrl(id: string): boolean {
  return (
    id.startsWith('git+') ||
    id.startsWith('git@') ||
    id.startsWith('ssh://') ||
    /^https?:\/\/.+\.git(#.+)?$/.test(id) ||
    /^(https?:\/\/)?(www\.)?github\.com\//.test(id)
  );
}

/**
 * First-party Re-Shell packages that live in this monorepo. They share the
 * `@re-shell/` scope with third-party plugins but are libraries/apps, never
 * plugins, so discovery and installation must not treat them as plugins.
 */
export const FIRST_PARTY_PACKAGES: readonly string[] = [
  '@re-shell/cli',
  '@re-shell/ui',
  '@re-shell/contracts',
  '@re-shell/mcp',
  '@re-shell/dashboard',
  '@re-shell/control-plane',
  '@re-shell/site',
];

/**
 * Whether a package name is one of the first-party (non-plugin) Re-Shell
 * packages listed in {@link FIRST_PARTY_PACKAGES}.
 *
 * @param name - Package name to test.
 */
export function isFirstPartyPackage(name: unknown): boolean {
  return typeof name === 'string' && FIRST_PARTY_PACKAGES.includes(name);
}

/** npm-style package name (optionally scoped); also excludes `.`/`..` path tricks. */
const PACKAGE_NAME_RE = /^(@[A-Za-z0-9][A-Za-z0-9-._]*\/)?[A-Za-z0-9][A-Za-z0-9-._]*$/;

/**
 * Whether a string is a usable npm-style package name. Names become on-disk
 * directory names, so anything that could escape the plugins dir is rejected.
 *
 * @param name - Candidate package name.
 */
export function isValidPackageName(name: unknown): name is string {
  return typeof name === 'string' && name.length <= 214 && PACKAGE_NAME_RE.test(name);
}

/**
 * Validate a plugin manifest. A valid plugin must have name + version and one of:
 *  - a `reshell` / `reshell-plugin` / `reshell-cli` manifest key,
 *  - the `reshell-plugin` keyword,
 *  - a recognized scope (`@re-shell/`),
 *  - a `reshell-plugin-` name prefix.
 *
 * Returns a normalized {name, version}. Throws PluginInstallError otherwise.
 *
 * @param data - Parsed package.json contents (typed as `unknown` until validated).
 * @returns Normalized `{ name, version }` extracted from the manifest.
 * @throws {PluginInstallError} If the manifest is missing, not an object, lacks
 *   a valid name/version, or is not a recognized Re-Shell plugin.
 */
export function validatePluginManifest(data: unknown): { name: string; version: string } {
  if (!data || typeof data !== 'object') {
    throw new PluginInstallError('Plugin manifest is missing or not an object');
  }
  const manifest = data as PluginManifestData;

  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new PluginInstallError('Plugin manifest must have a valid "name"');
  }
  if (!isValidPackageName(manifest.name)) {
    throw new PluginInstallError(
      `Plugin name "${manifest.name}" is not a valid npm package name`,
      { name: manifest.name }
    );
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new PluginInstallError('Plugin manifest must have a valid "version"');
  }

  if (isFirstPartyPackage(manifest.name)) {
    throw new PluginInstallError(
      `${manifest.name} is a first-party Re-Shell package, not a plugin`,
      { name: manifest.name }
    );
  }

  if (!isRecognizedPlugin(manifest)) {
    throw new PluginInstallError(
      'Package is not a Re-Shell plugin: missing reshell/reshell-plugin manifest key, ' +
        '"reshell-plugin" keyword, or a recognized scope',
      { name: manifest.name }
    );
  }

  return { name: manifest.name, version: manifest.version };
}

/**
 * The single source of truth for "is this package.json a Re-Shell plugin?",
 * used by the installer, `plugin validate` and node_modules discovery.
 * Recognizes the `@re-shell/*` scope, the `reshell`/`reshell-plugin`/`reshell-cli`
 * manifest keys and the `reshell-plugin` keyword / name prefix. First-party
 * packages ({@link FIRST_PARTY_PACKAGES}) are never plugins.
 *
 * @param manifest - Parsed package.json contents to inspect.
 * @returns `true` if any recognized Re-Shell plugin signal is present,
 *   otherwise `false`.
 */
export function isRecognizedPlugin(manifest: PluginManifestData): boolean {
  if (isFirstPartyPackage(manifest.name)) {
    return false;
  }

  // Manifest-key signal: any of the reshell-family keys present.
  if (
    manifest.reshell !== undefined ||
    manifest['reshell-plugin'] !== undefined ||
    manifest['reshell-cli'] !== undefined
  ) {
    return true;
  }

  // Keyword signal.
  if (Array.isArray(manifest.keywords) && manifest.keywords.includes('reshell-plugin')) {
    return true;
  }

  // Name-prefix signal.
  if (typeof manifest.name === 'string' && manifest.name.startsWith('reshell-plugin-')) {
    return true;
  }

  // Scope signal: new + LEGACY-COMPAT (@re-shell/) via RECOGNIZED_PKG_SCOPES.
  if (
    typeof manifest.name === 'string' &&
    RECOGNIZED_PKG_SCOPES.some((scope) => manifest.name.startsWith(scope))
  ) {
    return true;
  }

  return false;
}

/**
 * Strip a scope (and any parent path segments) so `@re-shell/foo` -> `foo`
 * for the on-disk dir name.
 *
 * @param pluginName - Full plugin package name, possibly scope-prefixed.
 * @returns The unscoped plugin name suitable for use as a directory name.
 */
export function pluginDirName(pluginName: string): string {
  const slash = pluginName.lastIndexOf('/');
  return slash >= 0 ? pluginName.slice(slash + 1) : pluginName;
}

// --- Identifier parsing ----------------------------------------------------

/** Parsed `name@spec` npm identifier. */
export interface NpmSpec {
  /** Package name (null when the identifier is a tarball/URL/alias, not name@spec). */
  name: string | null;
  /** Requested version, range or dist-tag (null when none was given). */
  requested: string | null;
}

/**
 * Split an npm identifier into package name and requested spec. Handles
 * scoped names (`@scope/name@1.2.3`). Identifiers that are not a plain
 * `name[@spec]` (tarball URLs, `file:`, `npm:` aliases, `github:`) yield
 * `name: null`.
 *
 * @param identifier - Raw npm identifier.
 */
export function parseNpmSpec(identifier: string): NpmSpec {
  const at = identifier.lastIndexOf('@');
  const hasSpec = at > 0;
  const name = hasSpec ? identifier.slice(0, at) : identifier;
  const requested = hasSpec ? identifier.slice(at + 1) : null;
  if (!isValidPackageName(name)) return { name: null, requested: null };
  return { name, requested: requested && requested.length > 0 ? requested : null };
}

/** Parsed git identifier. */
export interface GitSpec {
  /** Clone URL without `git+` prefix and `#ref` fragment. */
  url: string;
  /** Branch, tag or commit from the `#ref` fragment. */
  ref?: string;
}

/**
 * Parse a git identifier (`git+https://host/x.git#ref`, `git@host:x/y.git`).
 *
 * @param identifier - Raw git identifier.
 */
export function parseGitSpec(identifier: string): GitSpec {
  const withoutPrefix = identifier.replace(/^git\+/, '');
  const hash = withoutPrefix.indexOf('#');
  if (hash < 0) return { url: withoutPrefix };
  const ref = decodeURIComponent(withoutPrefix.slice(hash + 1));
  return { url: withoutPrefix.slice(0, hash), ...(ref ? { ref } : {}) };
}

const COMMIT_RE = /^[0-9a-f]{40}$/i;

/**
 * Whether a ref is a full 40-hex commit SHA (immutable, never moves).
 *
 * @param ref - Candidate ref.
 */
export function isCommitSha(ref: string | undefined): boolean {
  return typeof ref === 'string' && COMMIT_RE.test(ref);
}

// --- Source resolution -----------------------------------------------------

/** A package resolved onto disk, ready to validate and copy. */
export interface ResolvedPackage {
  /** How the identifier resolved. */
  source: PluginInstallSource;
  /** Directory on disk containing the package's package.json (source location). */
  sourceDir: string;
  /** Git provenance (git sources only). */
  git?: PluginGitRecord;
  /** `sha512-<base64>` integrity of the downloaded npm tarball (npm sources only). */
  integrity?: string;
  /** Cleanup callback for any tmp dirs created during resolution. */
  cleanup: () => void;
}

/** Options for {@link resolvePackageSource}. */
export interface ResolvePackageOptions {
  /** npm registry URL for `npm pack`. */
  registry?: string;
}

/**
 * Resolve an identifier (local path, git URL, npm spec) to a directory on disk.
 * No manifest validation happens here, so plugin and policy-pack installers can
 * share the same source handling.
 *
 * @param identifier - Local path, git URL, or npm package spec.
 * @param options - Resolution options.
 * @throws {PluginInstallError} If the source cannot be fetched.
 */
export async function resolvePackageSource(
  identifier: string,
  options: ResolvePackageOptions = {}
): Promise<ResolvedPackage> {
  const source = classifySource(identifier);
  switch (source) {
    case 'local':
      return resolveLocal(identifier);
    case 'git':
      return resolveGit(identifier);
    case 'npm':
      return resolveNpm(identifier, options);
    default:
      throw new PluginInstallError(`Unknown plugin source: ${String(source)}`);
  }
}

async function resolveLocal(identifier: string): Promise<ResolvedPackage> {
  const abs = path.resolve(identifier);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) {
    throw new PluginInstallError(`Local plugin path does not exist: ${abs}`);
  }
  const sourceDir = stat.isDirectory() ? abs : path.dirname(abs);
  return { source: 'local', sourceDir, cleanup: () => {} };
}

async function resolveGit(identifier: string): Promise<ResolvedPackage> {
  const { url, ref } = parseGitSpec(identifier);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-plugin-git-'));
  const fail = async (error: unknown): Promise<never> => {
    await fs.remove(tmpDir).catch(() => {});
    throw new PluginInstallError(
      `git clone failed for ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  };

  try {
    if (isCommitSha(ref)) {
      // A bare SHA cannot be passed to `git clone --branch`; fetch it directly.
      await runGit(['init', '--quiet', tmpDir]);
      await runGit(['-C', tmpDir, 'remote', 'add', 'origin', url]);
      await runGit(['-C', tmpDir, 'fetch', '--quiet', '--depth', '1', 'origin', ref as string]);
      await runGit(['-C', tmpDir, 'checkout', '--quiet', 'FETCH_HEAD']);
    } else {
      const args = ['clone', '--quiet', '--depth', '1'];
      if (ref) args.push('--branch', ref);
      args.push('--', url, tmpDir);
      await runGit(args);
    }
  } catch (error) {
    return fail(error);
  }

  let commit: string | undefined;
  try {
    commit = (await runGit(['-C', tmpDir, 'rev-parse', 'HEAD'])).trim() || undefined;
  } catch {
    commit = undefined;
  }

  return {
    source: 'git',
    sourceDir: tmpDir,
    git: { url, ...(ref ? { ref } : {}), ...(commit ? { commit } : {}) },
    cleanup: () => {
      fs.removeSync(tmpDir);
    },
  };
}

async function resolveNpm(
  identifier: string,
  options: ResolvePackageOptions
): Promise<ResolvedPackage> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-plugin-npm-'));
  try {
    // `npm pack` downloads the tarball into tmpDir without running install
    // scripts, then we extract it. This avoids a full `npm i` side effect.
    const args = ['pack', identifier, '--silent'];
    if (options.registry) args.push('--registry', options.registry);
    const tarball = (await runNpm(args, tmpDir)).trim().split('\n').pop();
    if (!tarball) {
      throw new PluginInstallError(`npm pack produced no tarball for ${identifier}`);
    }
    const tarballPath = path.join(tmpDir, tarball);
    // npm already verified the tarball against the registry; record its hash so
    // the install carries a verifiable fingerprint.
    const integrity = `sha512-${crypto
      .createHash('sha512')
      .update(await fs.readFile(tarballPath))
      .digest('base64')}`;
    const extractDir = path.join(tmpDir, 'package-extract');
    await fs.ensureDir(extractDir);
    await runTar(['-xzf', tarballPath, '-C', extractDir]);
    // npm tarballs extract under a top-level "package/" directory.
    const packageDir = path.join(extractDir, 'package');
    const sourceDir = (await fs.pathExists(packageDir)) ? packageDir : extractDir;
    return {
      source: 'npm',
      sourceDir,
      integrity,
      cleanup: () => {
        fs.removeSync(tmpDir);
      },
    };
  } catch (error) {
    await fs.remove(tmpDir).catch(() => {});
    if (error instanceof PluginInstallError) throw error;
    throw new PluginInstallError(
      `npm resolution failed for ${identifier}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Read package.json from a directory.
 *
 * @param dir - Directory expected to contain package.json.
 * @throws {PluginInstallError} If it is missing or unparsable.
 */
export async function readPackageJson(dir: string): Promise<Record<string, unknown>> {
  const manifestPath = path.join(dir, 'package.json');
  if (!(await fs.pathExists(manifestPath))) {
    throw new PluginInstallError(`No package.json found in ${dir}`);
  }
  try {
    const data: unknown = await fs.readJSON(manifestPath);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('package.json must contain a JSON object');
    }
    return data as Record<string, unknown>;
  } catch (error) {
    throw new PluginInstallError(
      `Failed to parse package.json in ${dir}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function readAndValidateManifest(dir: string): Promise<{ name: string; version: string }> {
  return validatePluginManifest(await readPackageJson(dir));
}

/**
 * Decide the pin to record from the install options and identifier.
 *
 * @returns The pin string, or undefined when no pin was requested.
 */
function resolvePin(
  pin: boolean | string | undefined,
  source: PluginInstallSource,
  identifier: string,
  resolved: { version: string },
  git: PluginGitRecord | undefined
): string | undefined {
  if (pin === undefined || pin === false) return undefined;
  if (typeof pin === 'string') {
    if (pin.length === 0) return undefined;
    if (source === 'npm' && !semver.validRange(pin)) {
      throw new PluginInstallError(`Invalid version pin "${pin}": expected a semver version or range`);
    }
    return pin;
  }
  // pin === true
  if (source === 'npm') {
    const { requested } = parseNpmSpec(identifier);
    if (requested && semver.validRange(requested)) return requested;
    return resolved.version;
  }
  if (source === 'git') {
    return git?.commit ?? git?.ref ?? resolved.version;
  }
  return resolved.version;
}

/**
 * Install a plugin end-to-end: resolve -> validate -> copy into the workspace
 * plugins dir -> register. With `dryRun`, stops after validate and reports the
 * would-be path without touching disk or registry.
 *
 * When replacing an existing install (`force`), the new files are staged next to
 * the old ones and swapped in, so a failed copy never destroys a working plugin.
 *
 * @param identifier - Raw plugin identifier (local path, git URL, or npm spec).
 * @param options - Optional install behavior (workspace root, dry-run, force, pin).
 * @returns A {@link PluginInstallResult} describing the installed (or would-be)
 *   plugin location and metadata.
 * @throws {PluginInstallError} If resolution, validation, copy, or registration
 *   fails, or when the target path already exists without `force`.
 */
export async function installPluginFromIdentifier(
  identifier: string,
  options: PluginInstallOptions = {}
): Promise<PluginInstallResult> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;

  const resolved = await resolvePackageSource(identifier, { registry: options.registry });

  try {
    const manifest = await readAndValidateManifest(resolved.sourceDir);
    const dirName = pluginDirName(manifest.name);
    const targetPath = path.join(pluginsDir(workspaceRoot), dirName);
    const pin = resolvePin(options.pin, resolved.source, identifier, manifest, resolved.git);

    if (dryRun) {
      return {
        name: manifest.name,
        version: manifest.version,
        source: resolved.source,
        path: targetPath,
        dryRun: true,
        ...(pin ? { pin } : {}),
        ...(resolved.git?.commit ? { commit: resolved.git.commit } : {}),
      };
    }

    // Scoped names share a directory name (`@a/foo` and `@b/foo` are both `foo`):
    // never let one plugin's install overwrite another plugin's files.
    const recorded = (await readPluginsFile(workspaceRoot)).plugins;
    const owner = Object.entries(recorded).find(
      ([owner, entry]) =>
        owner !== manifest.name && path.resolve(entry.path) === path.resolve(targetPath)
    );
    if (owner) {
      throw new PluginInstallError(
        `Cannot install '${manifest.name}': ${targetPath} is already used by plugin '${owner[0]}' (uninstall it first)`,
        { name: manifest.name, path: targetPath, conflictsWith: owner[0] }
      );
    }

    if ((await fs.pathExists(targetPath)) && !force) {
      throw new PluginInstallError(
        `Plugin '${manifest.name}' is already installed at ${targetPath} (use --force to overwrite)`,
        { name: manifest.name, path: targetPath }
      );
    }

    await replaceDirectory(targetPath, resolved.sourceDir, (src) => {
      // Judge only the part of the path below the package root, so a source that
      // itself lives under node_modules (pnpm layouts) still copies.
      const parts = path.relative(resolved.sourceDir, src).split(path.sep);
      // node_modules is never carried into the workspace plugins folder, and a
      // git checkout's own .git dir is dropped (the commit is recorded instead).
      return !parts.includes('node_modules') && !(resolved.source === 'git' && parts.includes('.git'));
    });

    await upsertPluginEntry(workspaceRoot, manifest.name, {
      version: manifest.version,
      source: resolved.source,
      path: targetPath,
      spec: resolved.source === 'local' ? path.resolve(identifier) : identifier,
      ...(pin ? { pin } : {}),
      ...(resolved.git ? { git: resolved.git } : {}),
      ...((options.record?.integrity ?? resolved.integrity)
        ? { integrity: (options.record?.integrity ?? resolved.integrity) as string }
        : {}),
      ...(options.record?.signature ? { signature: options.record.signature } : {}),
    });

    return {
      name: manifest.name,
      version: manifest.version,
      source: resolved.source,
      path: targetPath,
      dryRun: false,
      ...(pin ? { pin } : {}),
      ...(resolved.git?.commit ? { commit: resolved.git.commit } : {}),
    };
  } finally {
    resolved.cleanup();
  }
}

/**
 * Copy `sourceDir` to `targetPath`, replacing whatever is there. The copy is
 * staged in a hidden sibling directory first; an existing target is moved aside
 * and restored if the swap fails, so the previous contents survive any error.
 */
async function replaceDirectory(
  targetPath: string,
  sourceDir: string,
  filter: (src: string) => boolean
): Promise<void> {
  const parent = path.dirname(targetPath);
  await fs.ensureDir(parent);
  const suffix = `${process.pid}-${Date.now()}`;
  const stage = path.join(parent, `.${path.basename(targetPath)}.staging-${suffix}`);
  const backup = path.join(parent, `.${path.basename(targetPath)}.backup-${suffix}`);

  try {
    await fs.copy(sourceDir, stage, { filter });
  } catch (error) {
    await fs.remove(stage).catch(() => {});
    throw new PluginInstallError(
      `Failed to copy plugin into ${targetPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const hadExisting = await fs.pathExists(targetPath);
  try {
    if (hadExisting) await fs.move(targetPath, backup);
    await fs.move(stage, targetPath);
  } catch (error) {
    await fs.remove(targetPath).catch(() => {});
    if (hadExisting) await fs.move(backup, targetPath).catch(() => {});
    await fs.remove(stage).catch(() => {});
    throw new PluginInstallError(
      `Failed to install plugin into ${targetPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (hadExisting) await fs.remove(backup).catch(() => {});
}

/**
 * Read the registry plugin map (used by tests / listing).
 *
 * @param workspaceRoot - Workspace root that owns `.re-shell/plugins.json`.
 * @returns A map of plugin name to its stored `{ version, source, path }`
 *   entry. Returns an empty object when the registry file does not exist.
 */
export async function readPluginRegistry(
  workspaceRoot: string
): Promise<Record<string, { version: string; source: string; path: string }>> {
  return (await readPluginsFile(workspaceRoot)).plugins;
}

// --- Process helpers (execFile-style; no shell interpolation) -------------
//
// Asynchronous on purpose: a synchronous child process would freeze the event
// loop (spinners, and any in-process HTTP server such as a test registry) for
// the whole download.

const execFileAsync = promisify(execFile);

/** Environment for child processes: git must never block on a credentials prompt. */
function childEnv(): NodeJS.ProcessEnv {
  return { ...process.env, GIT_TERMINAL_PROMPT: '0' };
}

/**
 * Run git with arguments (no shell). Exported for the updater's `ls-remote`.
 *
 * @param args - git arguments.
 * @returns Captured stdout.
 * @throws An Error whose message is git's stderr when the command fails.
 */
export async function runGit(args: string[]): Promise<string> {
  return runProcess('git', args, undefined);
}

async function runNpm(args: string[], cwd: string): Promise<string> {
  return runProcess('npm', args, cwd);
}

async function runTar(args: string[]): Promise<string> {
  return runProcess('tar', args, undefined);
}

async function runProcess(file: string, args: string[], cwd: string | undefined): Promise<string> {
  try {
    const { stdout } = await execFileAsync(file, args, {
      cwd,
      encoding: 'utf8',
      env: childEnv(),
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const failure = error as { stderr?: string; message?: string };
    const detail = (failure.stderr ?? '').trim() || failure.message || String(error);
    throw new Error(detail);
  }
}
