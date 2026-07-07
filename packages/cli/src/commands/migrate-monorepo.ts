// Migrate an Nx or Turborepo workspace into a re-shell.workspaces.yaml (v2).
//
// Builds on the detection ideas in import-monorepo.ts but is purpose-built to
// emit a schema-valid v2 document (see src/schemas/workspace-v2.schema.json):
//   - reads nx.json + each project's project.json/package.json (Nx), or
//   - reads turbo.json + the workspace globs in package.json (Turbo),
//   - maps every project/package to a v2 `service` with a sanitized name,
//     path, type, language, and framework (always present — the schema makes
//     `framework` required), and
//   - returns both a structured `detected` summary and the rendered YAML.
//
// The command never mutates tracked files unless an explicit output path is
// given and --dry-run is absent.

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { globSync } from 'glob';

/**
 * Identifies which kind of source monorepo is being migrated.
 *
 * - `'nx'`     — an Nx workspace (uses nx.json + per-project project.json).
 * - `'turbo'`  — a Turborepo workspace (uses turbo.json + workspace globs).
 */
export type MigrateSource = 'nx' | 'turbo';

/**
 * A single detected app/service distilled from the source monorepo.
 */
export interface DetectedService {
  /** Original project/package name as found in the source monorepo. */
  originalName: string;
  /** Schema-safe service key (lowercased, scope-stripped, kebab-cased). */
  name: string;
  /** Relative path to the project root. */
  path: string;
  /** v2 service type. */
  type: 'frontend' | 'backend' | 'worker' | 'function';
  /** Detected language (defaults to javascript). */
  language: string;
  /** Detected framework (always set; falls back to a safe default). */
  framework: string;
}

/**
 * Structured result of a migration: what was detected plus the rendered YAML.
 */
export interface MigrationResult {
  /** The source monorepo flavor that was scanned. */
  source: MigrateSource;
  /** Schema-safe workspace name derived from the root package or directory. */
  workspaceName: string;
  /** List of services distilled from the source monorepo. */
  detected: DetectedService[];
  /** The rendered v2 workspace document serialized as YAML. */
  yaml: string;
}

/**
 * Options accepted by {@link migrateMonorepo}.
 */
export interface MigrateMonorepoOptions {
  /** Which kind of source monorepo to migrate. */
  source: MigrateSource;
  /** Directory containing the source monorepo (defaults to process.cwd()). */
  cwd?: string;
  /** When set (and not a dry run) the YAML is written here. */
  output?: string;
  /** When true, skip writing any files even if `output` is provided. */
  dryRun?: boolean;
  /** Emit a JSON envelope instead of human-readable text. */
  json?: boolean;
  /** Optional spinner handle stopped before non-JSON output is printed. */
  spinner?: { stop: () => void } | undefined;
}

const VALID_LANGUAGES = new Set([
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'kotlin',
  'scala',
  'csharp',
  'fsharp',
  'php',
  'ruby',
  'elixir',
  'clojure',
  'haskell',
  'swift',
  'dart',
  'crystal',
  'zig',
  'nim',
  'v',
  'deno',
  'bun',
]);

/**
 * Convert an arbitrary package name into a schema-valid service key.
 * The v2 schema requires `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`, so we strip
 * any npm scope, lowercase, replace invalid runs with a hyphen, and trim.
 *
 * @param raw - The original package/project name (may include an npm scope).
 * @returns A non-empty, lowercased, kebab-cased key no longer than 63 chars.
 */
export function sanitizeServiceName(raw: string): string {
  const withoutScope = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw;
  let name = withoutScope
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (name.length === 0) {
    name = 'service';
  }
  if (name.length > 63) {
    name = name.slice(0, 63).replace(/-+$/, '');
  }
  return name;
}

/**
 * Infer the v2 service type from a package.json shape and the project name.
 */
function inferType(pkg: PackageLike, name: string): DetectedService['type'] {
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

  // Libraries/shared packages have no v2 type of their own; model them as
  // workers so they still round-trip as valid services.
  return 'worker';
}

/**
 * Infer a framework string. The v2 schema makes `framework` required, so this
 * always returns a non-empty value ('vanilla' as the safe fallback).
 */
function inferFramework(pkg: PackageLike): string {
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

/**
 * Infer language; only returns values the v2 schema accepts.
 */
function inferLanguage(pkg: PackageLike): string {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const candidate = deps.typescript ? 'typescript' : 'javascript';
  return VALID_LANGUAGES.has(candidate) ? candidate : 'javascript';
}

interface PackageLike {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  packageManager?: string;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!(await fs.pathExists(filePath))) return null;
  return (await fs.readJson(filePath)) as T;
}

/**
 * Resolve workspace globs into project directories that contain a package.json.
 */
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

/**
 * Detect projects from an Nx workspace. Supports both the modern layout
 * (project.json per project, discovered via workspaceLayout globs / common
 * dirs) and the legacy `nx.json#projects` map.
 */
async function detectNx(cwd: string): Promise<DetectedService[]> {
  const nxJson = await readJsonIfExists<{
    projects?: Record<string, string | { root: string }>;
    workspaceLayout?: { appsDir?: string; libsDir?: string };
  }>(path.join(cwd, 'nx.json'));

  if (!nxJson) {
    throw new Error('nx.json not found — not an Nx workspace');
  }

  const projectRoots = new Map<string, string>(); // name -> root

  // Legacy explicit project map.
  if (nxJson.projects) {
    for (const [name, conf] of Object.entries(nxJson.projects)) {
      const root = typeof conf === 'string' ? conf : conf.root;
      projectRoots.set(name, root);
    }
  }

  // Modern layout: discover project.json files under the configured (or
  // conventional) app/lib directories.
  const layout = nxJson.workspaceLayout || {};
  const searchRoots = [
    ...new Set(
      [layout.appsDir, layout.libsDir, 'apps', 'libs', 'packages'].filter(
        (v): v is string => Boolean(v)
      )
    ),
  ];
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
    const pkg =
      (await readJsonIfExists<PackageLike>(path.join(cwd, root, 'package.json'))) || {};
    services.push(buildService(name, root, pkg));
  }
  return services.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Detect packages from a Turborepo workspace. Turbo relies on the package
 * manager's workspace globs (package.json#workspaces or pnpm-workspace.yaml).
 */
async function detectTurbo(cwd: string): Promise<DetectedService[]> {
  const turboJson = await readJsonIfExists<Record<string, unknown>>(
    path.join(cwd, 'turbo.json')
  );
  if (!turboJson) {
    throw new Error('turbo.json not found — not a Turborepo workspace');
  }

  const pkg = (await readJsonIfExists<PackageLike>(path.join(cwd, 'package.json'))) || {};

  let globs: string[] = [];
  if (Array.isArray(pkg.workspaces)) {
    globs = pkg.workspaces;
  } else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
    globs = pkg.workspaces.packages;
  }

  // Fall back to pnpm-workspace.yaml when package.json carries no workspaces.
  if (globs.length === 0) {
    const pnpmPath = path.join(cwd, 'pnpm-workspace.yaml');
    if (await fs.pathExists(pnpmPath)) {
      const parsed = yaml.load(await fs.readFile(pnpmPath, 'utf8')) as
        | { packages?: string[] }
        | undefined;
      if (parsed?.packages) globs = parsed.packages;
    }
  }

  const dirs = resolveWorkspaceDirs(cwd, globs);
  const services: DetectedService[] = [];
  for (const dir of dirs) {
    const projPkg =
      (await readJsonIfExists<PackageLike>(path.join(cwd, dir, 'package.json'))) || {};
    const name = projPkg.name || path.basename(dir);
    services.push(buildService(name, dir, projPkg));
  }
  return services.sort((a, b) => a.name.localeCompare(b.name));
}

function buildService(originalName: string, projectPath: string, pkg: PackageLike): DetectedService {
  return {
    originalName,
    name: sanitizeServiceName(originalName),
    path: projectPath,
    type: inferType(pkg, originalName),
    language: inferLanguage(pkg),
    framework: inferFramework(pkg),
  };
}

/**
 * Render the detected services to a v2 workspace document. Built as a plain
 * object and serialized with js-yaml so the output is well-formed.
 *
 * @param workspaceName - Schema-safe name to emit as the document `name`.
 * @param source - The source monorepo flavor, surfaced in the description.
 * @param services - Detected services to emit under the `services` key.
 * @returns The v2 workspace document serialized as a YAML string.
 */
export function renderWorkspaceYaml(
  workspaceName: string,
  source: MigrateSource,
  services: DetectedService[]
): string {
  const servicesObj: Record<string, unknown> = {};
  // De-duplicate sanitized names so two projects never collide on one key.
  const usedKeys = new Set<string>();
  for (const svc of services) {
    let key = svc.name;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${svc.name}-${suffix++}`;
    }
    usedKeys.add(key);

    servicesObj[key] = {
      name: key,
      type: svc.type,
      language: svc.language,
      framework: svc.framework,
      path: svc.path,
    };
  }

  const doc = {
    name: workspaceName,
    version: '2.0.0',
    description: `Workspace migrated from ${source}`,
    services: servicesObj,
  };

  return yaml.dump(doc, { lineWidth: 120, noRefs: true, sortKeys: false });
}

/**
 * Core migration entry point. Pure with respect to the filesystem unless an
 * output path is supplied without --dry-run.
 *
 * @param options - Configuration for the migration (source, cwd, output, etc.).
 * @returns A {@link MigrationResult} with the detected services and rendered YAML.
 */
export async function migrateMonorepo(
  options: MigrateMonorepoOptions
): Promise<MigrationResult> {
  const cwd = options.cwd || process.cwd();

  const services =
    options.source === 'nx' ? await detectNx(cwd) : await detectTurbo(cwd);

  // Derive a schema-valid workspace name from the root package or directory.
  const rootPkg = (await readJsonIfExists<PackageLike>(path.join(cwd, 'package.json'))) || {};
  const workspaceName = sanitizeServiceName(rootPkg.name || path.basename(cwd) || 'workspace');

  const renderedYaml = renderWorkspaceYaml(workspaceName, options.source, services);

  return {
    source: options.source,
    workspaceName,
    detected: services,
    yaml: renderedYaml,
  };
}
