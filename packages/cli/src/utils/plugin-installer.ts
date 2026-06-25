import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { RECOGNIZED_PKG_SCOPES } from './scope';

/**
 * Real plugin installer for `re-shell plugin install`.
 *
 * Resolves a plugin identifier from one of three sources, validates the plugin
 * manifest, copies/clones/extracts it into `<workspace>/.re-shell/plugins/<name>`,
 * and registers it in the workspace plugin registry (`.re-shell/plugins.json`).
 *
 * This module is intentionally free of CLI/chalk/spinner concerns so it can be
 * unit-tested directly and reused by the command layer and the JSON envelope.
 */

/** Where a plugin identifier resolves from. */
export type PluginInstallSource = 'local' | 'git' | 'npm';

/** Subset of a plugin's package.json the installer cares about. */
export interface PluginManifestData {
  name: string;
  version: string;
  description?: string;
  main?: string;
  keywords?: string[];
  reshell?: unknown;
  'reshell-plugin'?: unknown;
  'reshell-cli'?: unknown;
  [key: string]: unknown;
}

/** Outcome of a successful install (or a dry-run resolve+validate). */
export interface PluginInstallResult {
  name: string;
  version: string;
  source: PluginInstallSource;
  /** Final on-disk location, or the would-be location for a dry run. */
  path: string;
  /** True when nothing was written (dry run). */
  dryRun: boolean;
}

export interface PluginInstallOptions {
  /** Workspace root that owns `.re-shell/plugins`. Defaults to process.cwd(). */
  workspaceRoot?: string;
  /** Resolve + validate only; never write to disk or registry. */
  dryRun?: boolean;
  /** Overwrite an existing plugin dir of the same name. */
  force?: boolean;
}

/** Raised for every install failure so the command layer can map to PLUGIN_INSTALL_ERROR. */
export class PluginInstallError extends Error {
  readonly details?: Record<string, unknown>;
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
 * Validate a plugin manifest. A valid plugin must have name + version and one of:
 *  - a `reshell` / `reshell-plugin` / `reshell-cli` manifest key,
 *  - the `reshell-plugin` keyword,
 *  - a recognized scope (`@re-shell/`),
 *  - a `reshell-plugin-` name prefix.
 *
 * Returns a normalized {name, version}. Throws PluginInstallError otherwise.
 */
export function validatePluginManifest(data: unknown): { name: string; version: string } {
  if (!data || typeof data !== 'object') {
    throw new PluginInstallError('Plugin manifest is missing or not an object');
  }
  const manifest = data as PluginManifestData;

  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new PluginInstallError('Plugin manifest must have a valid "name"');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new PluginInstallError('Plugin manifest must have a valid "version"');
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
 * Scope-aware plugin detection (P9-F4). Recognizes the
 * `@re-shell/*` scope, plus the
 * `reshell`/`reshell-plugin`/`reshell-cli` manifest keys and the
 * `reshell-plugin` keyword / name prefix.
 */
export function isRecognizedPlugin(manifest: PluginManifestData): boolean {
  // Manifest-key signal: unknown of the reshell-family keys present.
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

/** Strip a scope so `@re-shell/foo` -> `foo` for the on-disk dir name. */
export function pluginDirName(pluginName: string): string {
  const slash = pluginName.lastIndexOf('/');
  return slash >= 0 ? pluginName.slice(slash + 1) : pluginName;
}

interface ResolvedPlugin {
  /** Directory on disk containing the plugin's package.json (source location). */
  sourceDir: string;
  manifest: { name: string; version: string };
  /** Cleanup callback for any tmp dirs created during resolution. */
  cleanup: () => void;
}

/**
 * Resolve + validate an identifier without installing. Used by both the real
 * install path and `--dry-run`.
 */
async function resolvePlugin(
  identifier: string,
  source: PluginInstallSource
): Promise<ResolvedPlugin> {
  switch (source) {
    case 'local':
      return resolveLocal(identifier);
    case 'git':
      return resolveGit(identifier);
    case 'npm':
      return resolveNpm(identifier);
    default:
      throw new PluginInstallError(`Unknown plugin source: ${String(source)}`);
  }
}

async function resolveLocal(identifier: string): Promise<ResolvedPlugin> {
  const abs = path.resolve(identifier);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) {
    throw new PluginInstallError(`Local plugin path does not exist: ${abs}`);
  }
  const sourceDir = stat.isDirectory() ? abs : path.dirname(abs);
  const manifest = await readAndValidateManifest(sourceDir);
  return { sourceDir, manifest, cleanup: () => {} };
}

async function resolveGit(identifier: string): Promise<ResolvedPlugin> {
  const url = identifier.replace(/^git\+/, '');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-plugin-git-'));
  try {
    runGit(['clone', '--depth', '1', url, tmpDir]);
  } catch (error) {
    await fs.remove(tmpDir).catch(() => {});
    throw new PluginInstallError(
      `git clone failed for ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  let manifest: { name: string; version: string };
  try {
    manifest = await readAndValidateManifest(tmpDir);
  } catch (error) {
    await fs.remove(tmpDir).catch(() => {});
    throw error;
  }
  return {
    sourceDir: tmpDir,
    manifest,
    cleanup: () => {
      fs.removeSync(tmpDir);
    },
  };
}

async function resolveNpm(identifier: string): Promise<ResolvedPlugin> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-plugin-npm-'));
  try {
    // `npm pack` downloads the tarball into tmpDir without running install
    // scripts, then we extract it. This avoids a full `npm i` side effect.
    const tarball = runNpm(['pack', identifier, '--silent'], tmpDir).trim().split('\n').pop();
    if (!tarball) {
      throw new PluginInstallError(`npm pack produced no tarball for ${identifier}`);
    }
    const tarballPath = path.join(tmpDir, tarball);
    const extractDir = path.join(tmpDir, 'package-extract');
    await fs.ensureDir(extractDir);
    runTar(['-xzf', tarballPath, '-C', extractDir]);
    // npm tarballs extract under a top-level "package/" directory.
    const packageDir = path.join(extractDir, 'package');
    const sourceDir = (await fs.pathExists(packageDir)) ? packageDir : extractDir;
    const manifest = await readAndValidateManifest(sourceDir);
    return {
      sourceDir,
      manifest,
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

async function readAndValidateManifest(dir: string): Promise<{ name: string; version: string }> {
  const manifestPath = path.join(dir, 'package.json');
  if (!(await fs.pathExists(manifestPath))) {
    throw new PluginInstallError(`No package.json found in ${dir}`);
  }
  let data: unknown;
  try {
    data = await fs.readJSON(manifestPath);
  } catch (error) {
    throw new PluginInstallError(
      `Failed to parse package.json in ${dir}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  return validatePluginManifest(data);
}

/**
 * Install a plugin end-to-end: resolve -> validate -> copy into the workspace
 * plugins dir -> register. With `dryRun`, stops after validate and reports the
 * would-be path without touching disk or registry.
 */
export async function installPluginFromIdentifier(
  identifier: string,
  options: PluginInstallOptions = {}
): Promise<PluginInstallResult> {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;

  const source = classifySource(identifier);
  const resolved = await resolvePlugin(identifier, source);

  try {
    const dirName = pluginDirName(resolved.manifest.name);
    const targetPath = path.join(workspaceRoot, '.re-shell', 'plugins', dirName);

    if (dryRun) {
      return {
        name: resolved.manifest.name,
        version: resolved.manifest.version,
        source,
        path: targetPath,
        dryRun: true,
      };
    }

    if (await fs.pathExists(targetPath)) {
      if (!force) {
        throw new PluginInstallError(
          `Plugin '${resolved.manifest.name}' is already installed at ${targetPath} (use --force to overwrite)`,
          { name: resolved.manifest.name, path: targetPath }
        );
      }
      await fs.remove(targetPath);
    }

    await fs.ensureDir(path.dirname(targetPath));
    // Copy the resolved source into the plugins dir. node_modules is skipped so
    // we never carry a dependency tree into the workspace plugins folder.
    await fs.copy(resolved.sourceDir, targetPath, {
      filter: (src) => !src.split(path.sep).includes('node_modules'),
    });

    await registerPlugin(workspaceRoot, {
      name: resolved.manifest.name,
      version: resolved.manifest.version,
      source,
      path: targetPath,
    });

    return {
      name: resolved.manifest.name,
      version: resolved.manifest.version,
      source,
      path: targetPath,
      dryRun: false,
    };
  } finally {
    resolved.cleanup();
  }
}

interface RegistryEntry {
  name: string;
  version: string;
  source: PluginInstallSource;
  path: string;
}

/**
 * Persist the installed plugin into `.re-shell/plugins.json`, creating the
 * registry with sane defaults if it does not exist yet.
 */
async function registerPlugin(workspaceRoot: string, entry: RegistryEntry): Promise<void> {
  const configPath = path.join(workspaceRoot, '.re-shell', 'plugins.json');
  await fs.ensureDir(path.dirname(configPath));

  interface RegistryFile {
    version: string;
    plugins: Record<string, { version: string; source: string; path: string; installedAt: string }>;
    disabled: string[];
    settings: Record<string, unknown>;
  }

  let config: RegistryFile;
  if (await fs.pathExists(configPath)) {
    config = (await fs.readJSON(configPath)) as RegistryFile;
    if (!config.plugins || typeof config.plugins !== 'object') config.plugins = {};
    if (!Array.isArray(config.disabled)) config.disabled = [];
  } else {
    config = {
      version: '1.0.0',
      plugins: {},
      disabled: [],
      settings: {
        autoUpdate: false,
        security: { allowUnverified: false, trustedSources: ['npm', 'builtin'] },
      },
    };
  }

  // Immutable update of the plugins map.
  const nextPlugins = {
    ...config.plugins,
    [entry.name]: {
      version: entry.version,
      source: entry.source,
      path: entry.path,
      installedAt: new Date().toISOString(),
    },
  };

  await fs.writeJSON(configPath, { ...config, plugins: nextPlugins }, { spaces: 2 });
}

/** Read the registry plugin map (used by tests / listing). */
export async function readPluginRegistry(
  workspaceRoot: string
): Promise<Record<string, { version: string; source: string; path: string }>> {
  const configPath = path.join(workspaceRoot, '.re-shell', 'plugins.json');
  if (!(await fs.pathExists(configPath))) return {};
  const config = (await fs.readJSON(configPath)) as {
    plugins?: Record<string, { version: string; source: string; path: string }>;
  };
  return config.plugins ?? {};
}

// --- Process helpers (execFile-style; no shell interpolation) -------------

function runGit(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function runNpm(args: string[], cwd: string): string {
  return execFileSync('npm', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runTar(args: string[]): string {
  return execFileSync('tar', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
