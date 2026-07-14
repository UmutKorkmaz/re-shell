import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { globSync } from 'glob';

/** Supported monorepo source types. */
export type ImportSource = 'nx' | 'turbo' | 'lerna' | 'yarn' | 'pnpm' | 'auto';

/** A single detected project/service from the source monorepo. */
export interface DetectedService {
  /** Original project/package name as found in the source. */
  originalName: string;
  /** Schema-safe service key (lowercased, scope-stripped, kebab-cased). */
  name: string;
  /** Relative path to the project root. */
  path: string;
  /** v2 service type. */
  type: 'frontend' | 'backend' | 'worker' | 'function';
  /** Detected language. */
  language: string;
  /** Detected framework (always set; falls back to 'vanilla'). */
  framework: string;
  /** Production dependencies from package.json. */
  dependencies: Record<string, string>;
  /** Scripts from package.json. */
  scripts: Record<string, string>;
  /** Inferred port (frontend/backend only). */
  port?: number;
  /** Inferred route (frontend only). */
  route?: string;
}

/** Structured result of a monorepo import. */
export interface ImportResult {
  source: ImportSource;
  workspaceName: string;
  detected: DetectedService[];
  yaml: string;
}

export interface MonorepoImportOptions {
  source?: ImportSource;
  /** Directory containing the source monorepo (defaults to process.cwd()). */
  cwd?: string;
  /** Path to a specific config file (overrides auto-detection). */
  configPath?: string;
  /** Include dev dependencies in the output. */
  includeDev?: boolean;
}

interface PackageLike {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  packageManager?: string;
}

// --- Name sanitization ---

/**
 * Convert an arbitrary package name into a schema-valid service key.
 * The v2 schema requires `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`.
 */
export function sanitizeServiceName(raw: string): string {
  const withoutScope = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw;
  let name = withoutScope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (name.length === 0) name = 'service';
  if (name.length > 63) name = name.slice(0, 63).replace(/-+$/, '');
  return name;
}

// --- Inference helpers ---

/**
 * Infer the v2 service type from a package.json shape and the project name.
 */
export function inferType(pkg: PackageLike, name: string): DetectedService['type'] {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  if (deps.react || deps.vue || deps.svelte || deps.next || deps.nuxt || deps['@angular/core']) {
    return 'frontend';
  }
  if (deps.express || deps.fastify || deps['@nestjs/core'] || deps.koa || deps.hapi) {
    return 'backend';
  }

  const lower = name.toLowerCase();
  if (/(web|ui|app|frontend|client)/.test(lower)) return 'frontend';
  if (/(api|server|backend|service|gateway)/.test(lower)) return 'backend';
  if (/(worker|job|cron|queue)/.test(lower)) return 'worker';
  if (/(fn|function|lambda)/.test(lower)) return 'function';

  return 'worker';
}

/**
 * Infer a framework string. Always returns a non-empty value ('vanilla' fallback).
 */
export function inferFramework(pkg: PackageLike): string {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.next) return 'next';
  if (deps.nuxt) return 'nuxt';
  if (deps.remix) return 'remix';
  if (deps.react) return 'react';
  if (deps.vue) return 'vue';
  if (deps['@angular/core'] || deps.angular) return 'angular';
  if (deps.svelte) return 'svelte';
  if (deps['@nestjs/core']) return 'nestjs';
  if (deps.express) return 'express';
  if (deps.fastify) return 'fastify';
  if (deps.koa) return 'koa';
  if (deps.hapi) return 'hapi';
  return 'vanilla';
}

/** Infer language; returns 'typescript' or 'javascript'. */
export function inferLanguage(pkg: PackageLike): string {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return deps.typescript ? 'typescript' : 'javascript';
}

/** Deterministic hash for stable port allocation. */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/** Infer a port for frontend/backend services (deterministic by name). */
export function inferPort(name: string, type: DetectedService['type']): number | undefined {
  if (type === 'frontend') return (hashString(name) % 1000) + 3000;
  if (type === 'backend') return (hashString(name + 'backend') % 1000) + 4000;
  return undefined;
}

/** Infer a route for frontend services. */
export function inferRoute(name: string, type: DetectedService['type']): string | undefined {
  if (type === 'frontend') return '/' + name;
  return undefined;
}

// --- Source detection ---

/** Auto-detect the monorepo type from the filesystem. Returns null if not a monorepo. */
export function detectSource(cwd: string): ImportSource | null {
  if (fs.existsSync(path.join(cwd, 'nx.json'))) return 'nx';
  if (fs.existsSync(path.join(cwd, 'turbo.json'))) return 'turbo';
  if (fs.existsSync(path.join(cwd, 'lerna.json'))) return 'lerna';
  if (fs.existsSync(path.join(cwd, 'pnpm-workspace.yaml'))) return 'pnpm';

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = fs.readJsonSync(pkgPath) as PackageLike;
      if (pkg.workspaces) return 'yarn';
    } catch {
      // ignore
    }
  }

  return null;
}

// --- Workspace glob resolution ---

/** Resolve workspace globs into project directories that contain a package.json. */
function resolveWorkspaceDirs(cwd: string, globs: string[]): string[] {
  const dirs = new Set<string>();
  for (const pattern of globs) {
    const matches = globSync(pattern, { cwd });
    for (const match of matches) {
      const full = path.join(cwd, match);
      if (
        fs.existsSync(full) &&
        fs.statSync(full).isDirectory() &&
        fs.existsSync(path.join(full, 'package.json'))
      ) {
        dirs.add(match);
      }
    }
  }
  return [...dirs].sort();
}

// --- Build service ---

function buildService(originalName: string, projectPath: string, pkg: PackageLike): DetectedService {
  const type = inferType(pkg, originalName);
  return {
    originalName,
    name: sanitizeServiceName(originalName),
    path: projectPath,
    type,
    language: inferLanguage(pkg),
    framework: inferFramework(pkg),
    dependencies: pkg.dependencies || {},
    scripts: pkg.scripts || {},
    port: inferPort(sanitizeServiceName(originalName), type),
    route: inferRoute(sanitizeServiceName(originalName), type),
  };
}

// --- Per-source detectors ---

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!(await fs.pathExists(filePath))) return null;
  return (await fs.readJson(filePath)) as T;
}

/** Detect projects from an Nx workspace. */
export async function detectNx(cwd: string): Promise<DetectedService[]> {
  const nxJson = await readJsonIfExists<{
    projects?: Record<string, string | { root: string }>;
    workspaceLayout?: { appsDir?: string; libsDir?: string };
  }>(path.join(cwd, 'nx.json'));

  if (!nxJson) throw new Error('nx.json not found — not an Nx workspace');

  const projectRoots = new Map<string, string>();

  // Legacy explicit project map
  if (nxJson.projects) {
    for (const [name, conf] of Object.entries(nxJson.projects)) {
      const root = typeof conf === 'string' ? conf : conf.root;
      projectRoots.set(name, root);
    }
  }

  // Modern layout: discover project.json files
  const layout = nxJson.workspaceLayout || {};
  const searchRoots = [...new Set(
    [layout.appsDir, layout.libsDir, 'apps', 'libs', 'packages'].filter(
      (v): v is string => Boolean(v)
    )
  )];

  for (const root of searchRoots) {
    const matches = globSync(`${root}/*/project.json`, { cwd });
    for (const rel of matches) {
      const projectRoot = path.dirname(rel);
      const projJson = await readJsonIfExists<{ name?: string }>(path.join(cwd, rel));
      const name = projJson?.name || path.basename(projectRoot);
      if (![...projectRoots.values()].includes(projectRoot)) {
        projectRoots.set(name, projectRoot);
      }
    }
  }

  const services: DetectedService[] = [];
  for (const [name, root] of projectRoots) {
    const pkg = (await readJsonIfExists<PackageLike>(path.join(cwd, root, 'package.json'))) || {};
    services.push(buildService(name, root, pkg));
  }
  return services.sort((a, b) => a.name.localeCompare(b.name));
}

/** Detect packages from a Turborepo workspace. */
export async function detectTurbo(cwd: string): Promise<DetectedService[]> {
  const turboJson = await readJsonIfExists<Record<string, unknown>>(path.join(cwd, 'turbo.json'));
  if (!turboJson) throw new Error('turbo.json not found — not a Turborepo workspace');

  return detectFromPackageWorkspaces(cwd);
}

/** Detect packages from a Lerna workspace. */
export async function detectLerna(cwd: string): Promise<DetectedService[]> {
  const lernaJson = await readJsonIfExists<{ packages?: string[] }>(path.join(cwd, 'lerna.json'));
  if (!lernaJson) throw new Error('lerna.json not found — not a Lerna workspace');

  const globs = lernaJson.packages || ['packages/*'];
  return detectFromGlobs(cwd, globs);
}

/** Detect packages from Yarn workspaces (package.json#workspaces). */
export async function detectYarn(cwd: string): Promise<DetectedService[]> {
  const pkg = await readJsonIfExists<PackageLike>(path.join(cwd, 'package.json'));
  if (!pkg || !pkg.workspaces) throw new Error('No workspaces found in package.json');

  return detectFromPackageWorkspaces(cwd);
}

/** Detect packages from a PNPM workspace (pnpm-workspace.yaml). */
export async function detectPnpm(cwd: string): Promise<DetectedService[]> {
  const pnpmPath = path.join(cwd, 'pnpm-workspace.yaml');
  if (!(await fs.pathExists(pnpmPath))) throw new Error('pnpm-workspace.yaml not found');

  const parsed = yaml.load(await fs.readFile(pnpmPath, 'utf8')) as { packages?: string[] } | undefined;
  const globs = parsed?.packages || ['packages/*'];
  return detectFromGlobs(cwd, globs);
}

/** Common: detect from package.json workspaces array. */
async function detectFromPackageWorkspaces(cwd: string): Promise<DetectedService[]> {
  const pkg = (await readJsonIfExists<PackageLike>(path.join(cwd, 'package.json'))) || {};
  let globs: string[] = [];

  if (Array.isArray(pkg.workspaces)) {
    globs = pkg.workspaces;
  } else if (pkg.workspaces?.packages) {
    globs = pkg.workspaces.packages;
  }

  // Fall back to pnpm-workspace.yaml
  if (globs.length === 0) {
    const pnpmPath = path.join(cwd, 'pnpm-workspace.yaml');
    if (await fs.pathExists(pnpmPath)) {
      const parsed = yaml.load(await fs.readFile(pnpmPath, 'utf8')) as { packages?: string[] } | undefined;
      if (parsed?.packages) globs = parsed.packages;
    }
  }

  return detectFromGlobs(cwd, globs);
}

/** Common: resolve globs and build services. */
async function detectFromGlobs(cwd: string, globs: string[]): Promise<DetectedService[]> {
  const dirs = resolveWorkspaceDirs(cwd, globs);
  const services: DetectedService[] = [];
  for (const dir of dirs) {
    const pkg = (await readJsonIfExists<PackageLike>(path.join(cwd, dir, 'package.json'))) || {};
    const name = pkg.name || path.basename(dir);
    services.push(buildService(name, dir, pkg));
  }
  return services.sort((a, b) => a.name.localeCompare(b.name));
}

// --- YAML rendering ---

/**
 * Render the detected services to a v2 workspace document.
 * Includes dependencies, scripts, ports, and routes.
 */
export function renderWorkspaceYaml(
  workspaceName: string,
  source: ImportSource,
  services: DetectedService[],
  options: { includeDev?: boolean } = {}
): string {
  const servicesObj: Record<string, unknown> = {};
  const usedKeys = new Set<string>();

  for (const svc of services) {
    let key = svc.name;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${svc.name}-${suffix++}`;
    }
    usedKeys.add(key);

    const entry: Record<string, unknown> = {
      name: key,
      type: svc.type,
      language: svc.language,
      framework: svc.framework,
      path: svc.path,
    };

    if (svc.port) entry.port = svc.port;
    if (svc.route) entry.route = svc.route;

    if (svc.scripts && Object.keys(svc.scripts).length > 0) {
      entry.scripts = svc.scripts;
    }

    if (svc.dependencies && Object.keys(svc.dependencies).length > 0) {
      entry.dependencies = { production: svc.dependencies };
    }

    servicesObj[key] = entry;
  }

  const doc = {
    name: workspaceName,
    version: '2.0.0',
    description: `Workspace imported from ${source}`,
    services: servicesObj,
  };

  return yaml.dump(doc, { lineWidth: 120, noRefs: true, sortKeys: false });
}

// --- Main entry point ---

/**
 * Core import entry point. Pure with respect to the filesystem — reads from
 * `options.cwd` (or `process.cwd()`) and returns a structured result + YAML.
 */
export async function importMonorepo(
  options: MonorepoImportOptions = {}
): Promise<ImportResult> {
  const cwd = options.cwd || process.cwd();
  const requestedSource = options.source || 'auto';

  // Resolve source
  let source: ImportSource;
  if (requestedSource === 'auto') {
    const detected = detectSource(cwd);
    if (!detected) {
      throw new Error(
        'No supported monorepo configuration found. ' +
          'Looked for: nx.json, turbo.json, lerna.json, pnpm-workspace.yaml, or package.json#workspaces'
      );
    }
    source = detected;
  } else {
    source = requestedSource;
  }

  // Detect services
  let services: DetectedService[];
  switch (source) {
    case 'nx': services = await detectNx(cwd); break;
    case 'turbo': services = await detectTurbo(cwd); break;
    case 'lerna': services = await detectLerna(cwd); break;
    case 'yarn': services = await detectYarn(cwd); break;
    case 'pnpm': services = await detectPnpm(cwd); break;
    default: throw new Error(`Unsupported source: ${source}`);
  }

  // Derive workspace name
  const rootPkg = (await readJsonIfExists<PackageLike>(path.join(cwd, 'package.json'))) || {};
  const workspaceName = sanitizeServiceName(rootPkg.name || path.basename(cwd) || 'workspace');

  const renderedYaml = renderWorkspaceYaml(workspaceName, source, services, {
    includeDev: options.includeDev,
  });

  return {
    source,
    workspaceName,
    detected: services,
    yaml: renderedYaml,
  };
}
