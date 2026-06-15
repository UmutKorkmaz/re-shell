// `re-shell catalog` + `re-shell catalog sync` — software-catalog command.
//
// Discovers every service / microfrontend / API / package from the real
// workspace graph, builds the typed catalog model (catalog-engine.ts), and
// either EMITS it (the default, dry-run) or WRITES Backstage catalog-info.yaml
// files to disk (`catalog sync --no-dry-run`). Sync is idempotent: re-running
// after a graph change updates entities with no manual edits.

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { WorkspaceParser } from '../parsers/workspace-parser';
import type { ServiceConfig } from '../parsers/workspace-parser';
import {
  buildCatalogModel,
  slugifyEntityName,
  type CatalogServiceInput,
  type CatalogMicrofrontendInput,
  type CatalogEntityLite,
} from '../utils/catalog-engine';
import {
  serializeEntity,
  validateBackstageEntity,
} from '../utils/catalog-backstage';
import { discoverWorkspace } from '../utils/task-runner';
import type { CatalogEntity, CatalogResponse } from '@re-shell/contracts';

/** Candidate filenames for the workspace v2 config, in discovery order. */
const CONFIG_CANDIDATES = ['re-shell.workspaces.yaml', 're-shell.workspaces.yml'];

/** Directory under the workspace root where sync writes catalog-info.yaml files. */
const CATALOG_DIR = 'catalog';

/** Options accepted by the `catalog` command. */
export interface CatalogCommandOptions {
  json?: boolean;
  /** When false (sync only), write catalog-info.yaml to disk. */
  noDryRun?: boolean;
  /** Sync subcommand flag. */
  sync?: boolean;
  /** Output directory override (tests). */
  outDir?: string;
  /** Working directory override (tests). */
  cwd?: string;
}

/** Resolve the workspace v2 config path under `cwd`, or undefined if absent. */
function resolveConfigPath(cwd: string): string | undefined {
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.join(cwd, candidate);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

/** A named service paired with its parsed config. */
interface NamedService {
  readonly name: string;
  readonly config: ServiceConfig;
}

/** Load + validate the workspace, returning its named services. */
function loadServices(configPath: string): { name: string; services: NamedService[] } {
  const parser = new WorkspaceParser();
  const parsed = parser.parse(configPath);
  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid workspace config: ${detail || 'unknown error'}`);
  }
  const services = parsed.config.services ?? {};
  return {
    name: parsed.config.name,
    services: Object.keys(services).map(name => ({ name, config: services[name] })),
  };
}

/** Scan the `apps/` directory for microfrontends (mirrors commands/list.ts). */
function discoverMicrofrontends(rootDir: string): CatalogMicrofrontendInput[] {
  const appsDir = path.join(rootDir, 'apps');
  // Guard with a directory check (not just existence): a stray `apps` FILE makes
  // existsSync return true but readdirSync throw ENOTDIR, which would abort the
  // whole command. Degrade to an empty MF list on any read failure.
  let entries: fs.Dirent[];
  try {
    const st = fs.statSync(appsDir);
    if (!st.isDirectory()) return [];
    entries = fs.readdirSync(appsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const mfs: CatalogMicrofrontendInput[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'shell') continue;
    const appPath = path.join(appsDir, entry.name);
    const pkgPath = path.join(appPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        mfs.push({
          name: entry.name,
          path: `apps/${entry.name}`,
          version: pkg.version,
          team: typeof pkg.author === 'string' ? pkg.author : undefined,
          route: pkg.reshell?.route || `/${entry.name}`,
        });
      } catch {
        mfs.push({ name: entry.name, path: `apps/${entry.name}` });
      }
    } else {
      mfs.push({ name: entry.name, path: `apps/${entry.name}` });
    }
  }
  return mfs;
}

/**
 * The kind → on-disk subdirectory mapping the sync owns. Used both to create
 * subdirs and to prune orphaned files only within these managed directories.
 */
function kindSubdir(kind: string): string {
  return kind === 'Group' ? 'owners' : `${kind.toLowerCase()}s`;
}

/** Project a parsed service config onto the pure engine's minimal input. */
function toServiceInput(named: NamedService): CatalogServiceInput {
  const { name, config } = named;
  const input: CatalogServiceInput = {
    name,
    ...(config.description ? { description: config.description } : {}),
    ...(config.type ? { type: config.type } : {}),
    language: config.language,
    framework: config.framework,
    ...(config.path ? { path: config.path } : {}),
    ...(config.port != null ? { port: config.port } : {}),
    ...(config.dependsOn ? { dependsOn: config.dependsOn } : {}),
    ...(config.tags ? { tags: config.tags } : {}),
    ...(config.metadata ? { metadata: config.metadata } : {}),
    ...(config.healthCheck != null ? { healthCheck: config.healthCheck } : {}),
  };
  return input;
}

/** Project a pure CatalogEntityLite onto the wire contract CatalogEntity shape. */
function toWireEntity(lite: CatalogEntityLite): CatalogEntity {
  const md = lite.metadata;
  return {
    apiVersion: lite.apiVersion,
    kind: lite.kind,
    metadata: {
      name: md.name,
      ...(md.title !== undefined ? { title: md.title } : {}),
      ...(md.description !== undefined ? { description: md.description } : {}),
      ...(md.tags !== undefined ? { tags: [...md.tags] } : {}),
      ...(md.labels !== undefined ? { labels: { ...md.labels } } : {}),
      ...(md.annotations !== undefined ? { annotations: { ...md.annotations } } : {}),
    },
    spec: { ...lite.spec },
  };
}

/**
 * `re-shell catalog` / `re-shell catalog sync`.
 *
 * Builds the catalog model from real graph state and either emits it (default,
 * dry-run) or writes Backstage catalog-info.yaml files (sync with --no-dry-run).
 * The model is generated entirely from discovery — no hand-written YAML.
 */
export async function runCatalog(options: CatalogCommandOptions): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const rootDir = path.resolve(cwd);
  const isSync = Boolean(options.sync);
  const dryRun = !options.noDryRun;

  const spinner = json
    ? null
    : createSpinner('Building catalog…', undefined, { json });
  spinner?.start();

  try {
    const configPath = resolveConfigPath(rootDir);
    if (!configPath) {
      emitError(
        json,
        `No workspace config found (looked for ${CONFIG_CANDIDATES.join(', ')} in ${cwd}). ` +
          'Run `re-shell init` or create a re-shell.workspaces.yaml first.'
      );
      return;
    }

    let workspace: { name: string; services: NamedService[] };
    try {
      workspace = loadServices(configPath);
    } catch (error) {
      emitError(json, messageOf(error));
      return;
    }

    // ── Discover the full input surface ───────────────────────────────────────
    const services = workspace.services.map(toServiceInput);
    const microfrontends = discoverMicrofrontends(rootDir);

    let packages: string[] = [];
    try {
      const discovery = await discoverWorkspace(rootDir);
      packages = [...discovery.packages.keys()];
    } catch {
      // Discovery is best-effort; the model degrades to services + MFs only.
    }

    // ── Build the catalog model ───────────────────────────────────────────────
    const model = buildCatalogModel({
      systemName: workspace.name,
      services,
      microfrontends,
      packages,
    });

    // ── Validate every entity (Backstage shape) before emitting/writing ───────
    const warnings = [...model.warnings];
    for (const entity of model.entities) {
      const violations = validateBackstageEntity(entity);
      for (const v of violations) {
        warnings.push(`${entity.kind}/${entity.metadata.name}: ${v}`);
      }
    }

    // ── Sync: write catalog-info.yaml files ───────────────────────────────────
    const files: CatalogResponse['files'] = [];
    if (isSync) {
      const outBase = options.outDir ?? path.join(rootDir, CATALOG_DIR);
      // repo-relative path (for reporting) vs absolute write path (honors outDir).
      const reportPath = (entity: { kind: string; metadata: { name: string } }): string =>
        `${CATALOG_DIR}/${kindSubdir(entity.kind)}/${entity.metadata.name}.yaml`;

      for (const entity of model.entities) {
        const relUnderBase = `${kindSubdir(entity.kind)}/${entity.metadata.name}.yaml`;
        const absPath = path.join(outBase, relUnderBase);
        if (!dryRun) {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, serializeEntity(entity), 'utf8');
        }
        files.push({
          path: reportPath(entity),
          kind: entity.kind,
          name: entity.metadata.name,
          written: !dryRun,
        });
      }

      // Prune orphaned files from a prior run whose entity no longer exists, so
      // sync is a true reconcile (idempotent across graph changes). Scan the FULL
      // set of managed kind-subdirs (not just kinds still present), and only
      // *.yaml/*.yml files — hand-authored content outside the contract is never
      // touched.
      const MANAGED_SUBDIRS = ['components', 'apis', 'resources', 'owners', 'systems', 'domains'];
      if (!dryRun) {
        const intended = new Set(
          files.map(f => path.join(outBase, `${kindSubdir(f.kind)}/${f.name}.yaml`))
        );
        for (const sub of MANAGED_SUBDIRS) {
          const subAbs = path.join(outBase, sub);
          let stale: string[];
          try {
            stale = fs.readdirSync(subAbs);
          } catch {
            continue;
          }
          for (const fname of stale) {
            if (!fname.endsWith('.yaml') && !fname.endsWith('.yml')) continue;
            const abs = path.join(subAbs, fname);
            if (!intended.has(abs)) {
              try {
                fs.unlinkSync(abs);
                warnings.push(`pruned orphaned catalog file ${path.relative(rootDir, abs) || abs}`);
              } catch {
                // Best-effort: a file we cannot remove is surfaced elsewhere.
              }
            }
          }
        }
      }

      if (files.length > 0) {
        warnings.push(
          dryRun
            ? `catalog sync dry-run: would write ${files.length} catalog-info.yaml file(s) under ${CATALOG_DIR}/`
            : `catalog sync: wrote ${files.length} catalog-info.yaml file(s) under ${CATALOG_DIR}/`
        );
      }
    }

    const payload: CatalogResponse = {
      system: slugifyEntityName(workspace.name) || 'workspace',
      dryRun,
      entities: model.entities.map(toWireEntity),
      counts: model.counts,
      files,
      warnings,
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload, isSync);
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit a CATALOG_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('CATALOG_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Extract a human message from an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Colour an entity kind for the terminal. */
function colourKind(kind: string): string {
  switch (kind) {
    case 'Component':
      return chalk.cyan(kind);
    case 'API':
      return chalk.magenta(kind);
    case 'Group':
      return chalk.blue(kind);
    case 'System':
      return chalk.green(kind);
    default:
      return chalk.gray(kind);
  }
}

/** Human-readable render of the catalog payload (non-JSON path). */
function renderHuman(payload: CatalogResponse, isSync: boolean): void {
  const title = isSync ? 'catalog sync' : 'catalog';
  process.stdout.write(chalk.cyan.bold(`\n▶ ${title}\n\n`));

  const c = payload.counts;
  process.stdout.write(
    `  ${chalk.bold('system')}  ${payload.system}  ` +
      chalk.gray(
        `(${c.components} components · ${c.apis} apis · ${c.groups} groups)`
      ) + '\n\n'
  );

  for (const entity of payload.entities) {
    const owner = typeof entity.spec.owner === 'string' ? entity.spec.owner : '?';
    const etype = typeof entity.spec.type === 'string' ? entity.spec.type : '';
    const tail = etype ? chalk.gray(` · ${etype} · owner: ${owner}`) : '';
    process.stdout.write(
      `  ${colourKind(entity.kind.padEnd(10))} ${chalk.bold(entity.metadata.name)}${tail}\n`
    );
  }

  if (payload.files.length > 0) {
    process.stdout.write(chalk.gray(`\n  files:\n`));
    for (const f of payload.files) {
      const mark = f.written ? chalk.green('✓') : chalk.gray('·');
      process.stdout.write(`    ${mark} ${f.path}\n`);
    }
  }

  for (const warning of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
  }
  process.stdout.write('\n');
}
