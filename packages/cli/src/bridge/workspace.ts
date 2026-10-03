// Workspace v2 access for the bridge commands: load + validate the config, resolve
// service directories, and edit re-shell.workspaces.yaml in place (comments and
// formatting preserved) when a link is recorded.

import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import * as YAML from 'yaml';

import workspaceSchemaJson from '../schemas/workspace-v2.schema.json';
import { WorkspaceParser, type ServiceConfig, type WorkspaceConfig } from '../parsers/workspace-parser';
import { resolveWorkspaceConfigPath } from '../utils/k8s-generate';
import type { BridgeProtocol } from './spec/ir';

/** A recorded service-to-service link (`services.<consumer>.links[]`). */
export interface ServiceLink {
  /** The provider service this consumer calls. */
  service: string;
  protocol: BridgeProtocol;
  /** Provider spec the client was generated from (relative to the workspace root, posix). */
  spec: string;
  /** Directory of the generated client (relative to the workspace root, posix). */
  client: string;
  /** Client languages generated. */
  languages: string[];
  /** sha256 of the provider spec at link time. */
  contractSha256: string;
}

/** A loaded + schema-validated workspace. */
export interface LoadedWorkspace {
  configPath: string;
  /** Directory containing the config; service paths and links are relative to it. */
  root: string;
  config: WorkspaceConfig;
  /** Rule violations the parser reported (it keeps `valid` true for these). */
  ruleErrors: { path: string; message: string }[];
  warnings: { path: string; message: string }[];
}

/** Error for workspace-level problems (maps to BRIDGE_LINK_ERROR / BRIDGE_VALIDATE_ERROR). */
export class BridgeWorkspaceError extends Error {
  readonly code = 'BRIDGE_WORKSPACE_ERROR';
}

/**
 * Locate, parse and schema-validate the workspace config.
 *
 * @throws BridgeWorkspaceError when no config is found or it fails schema validation.
 */
export function loadWorkspace(cwd: string, explicitConfig?: string): LoadedWorkspace {
  const configPath = resolveWorkspaceConfigPath(cwd, explicitConfig ? path.resolve(cwd, explicitConfig) : undefined);
  if (!configPath) {
    throw new BridgeWorkspaceError(`No workspace v2 config found in ${cwd} (expected re-shell.workspaces.yaml)`);
  }
  const parsed = new WorkspaceParser().parse(configPath);
  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new BridgeWorkspaceError(`Invalid workspace config: ${detail || 'unknown error'}`);
  }
  return {
    configPath,
    root: path.dirname(path.resolve(configPath)),
    config: parsed.config,
    ruleErrors: parsed.errors.map(e => ({ path: e.path, message: e.message })),
    warnings: parsed.warnings.map(w => ({ path: w.path, message: w.message })),
  };
}

/** Absolute directory of a service (`path`, else `services/<name>`, else `<name>`). */
export function serviceDir(ws: LoadedWorkspace, name: string): string {
  const svc = ws.config.services[name];
  if (svc?.path) return path.resolve(ws.root, svc.path);
  const conventional = path.join(ws.root, 'services', name);
  if (fs.existsSync(conventional)) return conventional;
  return path.join(ws.root, name);
}

/** Path relative to the workspace root, with posix separators. */
export function relFromRoot(ws: LoadedWorkspace, target: string): string {
  return path.relative(ws.root, path.resolve(target)).split(path.sep).join('/');
}

/** Links recorded on a service (empty when none). */
export function linksOf(svc: ServiceConfig | undefined): ServiceLink[] {
  const raw = (svc as unknown as { links?: ServiceLink[] } | undefined)?.links;
  return Array.isArray(raw) ? raw : [];
}

/** Outgoing dependency edges of a service: `dependsOn` plus recorded links. */
export function dependenciesOf(svc: ServiceConfig | undefined): string[] {
  const out = new Set<string>(svc?.dependsOn ?? []);
  for (const l of linksOf(svc)) out.add(l.service);
  return [...out];
}

/** Dependency graph (service -> providers it calls). */
export function dependencyGraph(config: WorkspaceConfig): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const [name, svc] of Object.entries(config.services ?? {})) graph.set(name, dependenciesOf(svc));
  return graph;
}

/** Find dependency cycles (each returned as `a -> b -> ... -> a`). */
export function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const seenKeys = new Set<string>();
  const visit = (node: string): void => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      if (state.get(next) === 'visiting') {
        const cycle = [...stack.slice(stack.indexOf(next)), next];
        const key = [...cycle.slice(0, -1)].sort().join('>');
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          cycles.push(cycle);
        }
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of graph.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

/** Would adding `consumer -> provider` close a cycle? Returns the cycle path or undefined. */
export function wouldCreateCycle(config: WorkspaceConfig, consumer: string, provider: string): string[] | undefined {
  const graph = dependencyGraph(config);
  const edges = new Set(graph.get(consumer) ?? []);
  edges.add(provider);
  graph.set(consumer, [...edges]);
  const hit = findCycles(graph).find(c => c.includes(consumer) && c.includes(provider));
  if (!hit) return undefined;
  // Rotate so the reported cycle starts (and ends) at the consumer being linked.
  const body = hit.slice(0, -1);
  const i = body.indexOf(consumer);
  return [...body.slice(i), ...body.slice(0, i), consumer];
}

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });

/** Validate a plain config object against the v2 schema; returns error strings. */
export function schemaErrors(config: unknown): string[] {
  const validate = ajv.compile(workspaceSchemaJson);
  if (validate(config)) return [];
  return (validate.errors ?? []).map(e => `${e.instancePath || 'root'}: ${e.message ?? 'invalid'}`);
}

/** Edit session over the workspace YAML that preserves comments and ordering. */
export class WorkspaceEditor {
  private readonly doc: YAML.Document.Parsed;

  constructor(private readonly configPath: string) {
    this.doc = YAML.parseDocument(fs.readFileSync(configPath, 'utf8'));
    if (this.doc.errors.length > 0) {
      throw new BridgeWorkspaceError(`${configPath}: ${this.doc.errors[0].message}`);
    }
  }

  /** Record `consumer -> provider` (idempotent): `dependsOn` entry plus one `links` entry per (provider, protocol). */
  addLink(consumer: string, link: ServiceLink): void {
    const svcPath = ['services', consumer];
    if (!this.doc.hasIn(svcPath)) throw new BridgeWorkspaceError(`service "${consumer}" not found in ${this.configPath}`);

    const deps = (this.doc.getIn([...svcPath, 'dependsOn']) as YAML.YAMLSeq | undefined)?.toJS(this.doc) as string[] | undefined;
    if (!deps?.includes(link.service)) {
      if (this.doc.hasIn([...svcPath, 'dependsOn'])) this.doc.addIn([...svcPath, 'dependsOn'], link.service);
      else this.doc.setIn([...svcPath, 'dependsOn'], [link.service]);
    }

    const existing = (this.doc.getIn([...svcPath, 'links']) as YAML.YAMLSeq | undefined)?.toJS(this.doc) as ServiceLink[] | undefined;
    const entry = this.doc.createNode(link);
    if (!existing) {
      this.doc.setIn([...svcPath, 'links'], [link]);
      return;
    }
    const idx = existing.findIndex(l => l.service === link.service && l.protocol === link.protocol);
    if (idx >= 0) this.doc.setIn([...svcPath, 'links', idx], entry);
    else this.doc.addIn([...svcPath, 'links'], entry);
  }

  /** Remove the link(s) from consumer to provider; optionally drop the dependsOn entry too. */
  removeLink(consumer: string, provider: string, options: { keepDependency?: boolean; protocol?: BridgeProtocol } = {}): ServiceLink[] {
    const svcPath = ['services', consumer];
    const removed: ServiceLink[] = [];
    const existing = (this.doc.getIn([...svcPath, 'links']) as YAML.YAMLSeq | undefined)?.toJS(this.doc) as ServiceLink[] | undefined;
    if (existing) {
      const keep = existing.filter(l => {
        const match = l.service === provider && (!options.protocol || l.protocol === options.protocol);
        if (match) removed.push(l);
        return !match;
      });
      if (keep.length === 0) this.doc.deleteIn([...svcPath, 'links']);
      else this.doc.setIn([...svcPath, 'links'], keep);
    }
    if (!options.keepDependency) {
      const stillLinked = ((this.doc.getIn([...svcPath, 'links']) as YAML.YAMLSeq | undefined)?.toJS(this.doc) as ServiceLink[] | undefined ?? []).some(
        l => l.service === provider
      );
      const deps = (this.doc.getIn([...svcPath, 'dependsOn']) as YAML.YAMLSeq | undefined)?.toJS(this.doc) as string[] | undefined;
      if (!stillLinked && deps?.includes(provider)) {
        const rest = deps.filter(d => d !== provider);
        if (rest.length === 0) this.doc.deleteIn([...svcPath, 'dependsOn']);
        else this.doc.setIn([...svcPath, 'dependsOn'], rest);
      }
    }
    return removed;
  }

  /** The edited document as plain data (for schema validation before writing). */
  toObject(): unknown {
    return this.doc.toJS();
  }

  /** The edited document as YAML text. */
  toString(): string {
    return String(this.doc);
  }

  /** Write the edited document back. */
  save(): void {
    fs.writeFileSync(this.configPath, String(this.doc));
  }
}
