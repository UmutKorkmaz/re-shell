// `re-shell debug config`: generate VS Code launch configurations (and a
// docker-compose debug override) for every service in the workspace.

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'jsonc-parser';

import { loadWorkspace, WorkspaceLoadError } from '../platform/workspace';
import { buildServiceConfigs, NAME_PREFIX, type LaunchConfig } from './configs';
import { buildOverrideBlock, loadComposeServices, renderOverride, type OverrideEntry } from './compose';
import { mergeLaunchJson, LaunchJsonError } from './launch';
import { allocateDebugPorts, LANGUAGE_KIND, PortAllocationError, type DebugKind } from './ports';

export type DebugErrorCode = 'WORKSPACE_NOT_FOUND' | 'SCHEMA_VALIDATION_ERROR' | 'DEBUG_CONFIG_ERROR';

export class DebugConfigError extends Error {
  constructor(
    public readonly code: DebugErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DebugConfigError';
  }
}

export interface DebugConfigOptions {
  cwd?: string;
  configPath?: string;
  /** Restrict to these services (default: every supported service). */
  services?: string[];
  /** launch.json path (default `<workspace root>/.vscode/launch.json`). */
  out?: string;
  dryRun?: boolean;
  /** Skip the docker-compose override. */
  noCompose?: boolean;
  /** Compose override path (default `<workspace root>/docker-compose.debug.yml`). */
  composeOut?: string;
}

export interface DebugServiceReport {
  name: string;
  language: string;
  debugKind: DebugKind;
  debugPort: number | null;
  portSource: 'explicit' | 'allocated' | 'none';
  configurations: string[];
  inCompose: boolean;
  composeService: string | null;
  remoteRoot: string | null;
}

export interface DebugConfigResult {
  out: string;
  dryRun: boolean;
  written: boolean;
  services: DebugServiceReport[];
  skipped: Array<{ name: string; language: string; reason: string }>;
  compound: { name: string; configurations: string[] } | null;
  launch: {
    created: boolean;
    added: string[];
    updated: string[];
    unchanged: string[];
    preserved: number;
    content: string;
  };
  compose: { path: string; written: boolean; services: string[]; content: string } | null;
  notes: string[];
  warnings: string[];
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Generate (and unless dry-run, write) launch.json + compose override. */
export function generateDebugConfig(options: DebugConfigOptions): DebugConfigResult {
  const cwd = options.cwd ?? process.cwd();
  let ws;
  try {
    ws = loadWorkspace(cwd, options.configPath);
  } catch (err) {
    if (err instanceof WorkspaceLoadError) {
      throw new DebugConfigError(err.kind === 'not-found' ? 'WORKSPACE_NOT_FOUND' : 'SCHEMA_VALIDATION_ERROR', err.message);
    }
    throw err;
  }

  const wanted = options.services?.filter(Boolean);
  if (wanted && wanted.length > 0) {
    const unknown = wanted.filter(n => !ws.services.some(s => s.name === n));
    if (unknown.length > 0) {
      throw new DebugConfigError(
        'DEBUG_CONFIG_ERROR',
        `Unknown service(s): ${unknown.join(', ')}. Available: ${ws.services.map(s => s.name).join(', ')}`,
        { unknown, available: ws.services.map(s => s.name) }
      );
    }
  }

  const outPath = options.out
    ? path.resolve(cwd, options.out)
    : path.join(ws.root, '.vscode', 'launch.json');
  const outDir = path.dirname(outPath);
  const workspaceFolder = path.basename(outDir) === '.vscode' ? path.dirname(outDir) : outDir;

  // Ports are allocated over ALL supported services so they stay stable when a subset is selected.
  const supported = ws.services.filter(s => LANGUAGE_KIND[s.language]);
  const skipped = ws.services
    .filter(s => !LANGUAGE_KIND[s.language])
    .filter(s => !wanted || wanted.length === 0 || wanted.includes(s.name))
    .map(s => ({ name: s.name, language: s.language, reason: `no debug adapter mapping for language "${s.language}"` }));

  const requests = supported.map(s => {
    const raw = s.config.metadata?.debugPort;
    let explicit: number | undefined;
    if (raw !== undefined) {
      explicit = Number(raw);
      if (!Number.isInteger(explicit) || explicit < 1024 || explicit > 65535) {
        throw new DebugConfigError('DEBUG_CONFIG_ERROR', `Service "${s.name}" has an invalid metadata.debugPort "${raw}" (expected 1024-65535)`);
      }
    }
    return { name: s.name, kind: LANGUAGE_KIND[s.language], explicit };
  });
  let assignments;
  try {
    assignments = allocateDebugPorts(
      requests,
      ws.services.map(s => s.port).filter((p): p is number => typeof p === 'number')
    );
  } catch (err) {
    if (err instanceof PortAllocationError) throw new DebugConfigError('DEBUG_CONFIG_ERROR', err.message);
    throw err;
  }

  const selected = supported.filter(s => !wanted || wanted.length === 0 || wanted.includes(s.name));
  if (selected.length === 0) {
    throw new DebugConfigError('DEBUG_CONFIG_ERROR', 'No services with a supported debug language were selected');
  }

  const compose = options.noCompose ? new Map() : loadComposeServices(ws.root, ws.services.map(s => ({ name: s.name, dir: s.dir })));

  const notes: string[] = [];
  const warnings: string[] = [];
  const configurations: LaunchConfig[] = [];
  const attachNames: string[] = [];
  const reports: DebugServiceReport[] = [];
  const overrides: OverrideEntry[] = [];

  for (const svc of selected) {
    const kind = LANGUAGE_KIND[svc.language];
    const assignment = assignments.find(a => a.name === svc.name)!;
    const cinfo = compose.get(svc.name);
    const relDir = toPosix(path.relative(workspaceFolder, svc.dir)) || '.';
    const cfg = buildServiceConfigs({
      name: svc.name,
      kind,
      framework: svc.framework,
      appPort: svc.port,
      env: svc.env,
      dir: svc.dir,
      relDir,
      debugPort: assignment.port,
      remoteRoot: cinfo?.remoteRoot ?? null,
      composeService: cinfo ? cinfo.name : null,
    });
    const names: string[] = [];
    if (cfg.attach) {
      configurations.push(cfg.attach);
      names.push(String(cfg.attach.name));
      attachNames.push(String(cfg.attach.name));
    }
    if (cfg.launch) {
      configurations.push(cfg.launch);
      names.push(String(cfg.launch.name));
      if (!cfg.attach) attachNames.push(String(cfg.launch.name));
    }
    notes.push(...cfg.notes);
    reports.push({
      name: svc.name,
      language: svc.language,
      debugKind: kind,
      debugPort: assignment.port,
      portSource: assignment.source,
      configurations: names,
      inCompose: Boolean(cinfo),
      composeService: cinfo?.name ?? null,
      remoteRoot: cinfo?.remoteRoot ?? null,
    });
    if (cinfo) {
      const entry = buildOverrideBlock(cinfo, kind, assignment.port, svc.name);
      overrides.push(entry);
      notes.push(...entry.notes);
    }
  }

  // Compound: debug several services together.
  const compounds: LaunchConfig[] = [];
  let compound: DebugConfigResult['compound'] = null;
  if (attachNames.length > 1) {
    const all = !wanted || wanted.length === 0 || selected.length === supported.length;
    const name = all ? `${NAME_PREFIX}all services` : `${NAME_PREFIX}${selected.map(s => s.name).join(' + ')}`;
    compounds.push({ name, configurations: attachNames, stopAll: true });
    compound = { name, configurations: attachNames };
  }

  // launch.json
  const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
  let merge;
  try {
    merge = mergeLaunchJson(existing, configurations, compounds);
  } catch (err) {
    if (err instanceof LaunchJsonError) throw new DebugConfigError('DEBUG_CONFIG_ERROR', err.message, { file: outPath });
    throw err;
  }

  // stale generated entries from a previous run
  if (existing !== null) {
    try {
      const generated = new Set([...configurations, ...compounds].map(e => String(e.name)));
      const doc = parse(existing, [], { allowTrailingComma: true }) as { configurations?: LaunchConfig[]; compounds?: LaunchConfig[] };
      const stale = [...(doc.configurations ?? []), ...(doc.compounds ?? [])]
        .map(e => String(e?.name ?? ''))
        .filter(n => n.startsWith(NAME_PREFIX) && !generated.has(n));
      if (stale.length > 0) warnings.push(`launch.json contains re-shell entries that were not regenerated (kept): ${stale.join(', ')}`);
    } catch {
      /* informational only */
    }
  }

  // compose override
  let composeResult: DebugConfigResult['compose'] = null;
  if (!options.noCompose && overrides.length > 0) {
    const composePath = options.composeOut ? path.resolve(cwd, options.composeOut) : path.join(ws.root, 'docker-compose.debug.yml');
    composeResult = {
      path: composePath,
      written: false,
      services: overrides.map(o => o.service),
      content: renderOverride(overrides),
    };
  }

  const written = !options.dryRun;
  if (written) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, merge.text);
    if (composeResult) {
      fs.mkdirSync(path.dirname(composeResult.path), { recursive: true });
      fs.writeFileSync(composeResult.path, composeResult.content);
      composeResult.written = true;
    }
  }

  return {
    out: outPath,
    dryRun: Boolean(options.dryRun),
    written,
    services: reports,
    skipped,
    compound,
    launch: {
      created: merge.created,
      added: merge.added,
      updated: merge.updated,
      unchanged: merge.unchanged,
      preserved: merge.preserved,
      content: merge.text,
    },
    compose: composeResult,
    notes,
    warnings,
  };
}
