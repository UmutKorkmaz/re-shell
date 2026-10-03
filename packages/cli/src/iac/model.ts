// Provider-neutral service model derived from the workspace v2 config.

import type { LoadedWorkspace, ResolvedService } from '../platform/workspace';
import { label } from './hcl';

export type IacProvider = 'aws' | 'azure' | 'gcp';
export const IAC_PROVIDERS: IacProvider[] = ['aws', 'azure', 'gcp'];

export interface IacService {
  name: string;
  /** Terraform-safe label. */
  label: string;
  type: 'frontend' | 'backend' | 'worker' | 'function' | undefined;
  /** Container port (default 8080). */
  port: number;
  /** Receives public traffic: frontend/backend services. */
  exposed: boolean;
  /** CPU limit in millicores (default 256 / 0.25 vCPU). */
  cpuMillis: number | null;
  /** Memory limit in MiB. */
  memoryMiB: number | null;
  minReplicas: number;
  maxReplicas: number;
  healthPath: string;
  env: Record<string, string>;
  dependsOn: string[];
}

export const DEFAULT_PORT = 8080;

function parseCpu(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d+)m$/.exec(v);
  return m ? Number(m[1]) : null;
}

function parseMem(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d+)(Mi|Gi)$/.exec(v);
  if (!m) return null;
  return m[2] === 'Gi' ? Number(m[1]) * 1024 : Number(m[1]);
}

function toService(s: ResolvedService): IacService {
  const cfg = s.config;
  const resources = (cfg.resources ?? {}) as { cpu?: { limit?: string; request?: string }; memory?: { limit?: string; request?: string } };
  const scaling = (cfg.scaling ?? {}) as { min?: number; max?: number };
  const health = (cfg.healthCheck ?? {}) as { path?: string };
  const deployment = cfg.type;
  const min = scaling.min ?? 1;
  return {
    name: s.name,
    label: label(s.name),
    type: deployment,
    port: s.port ?? DEFAULT_PORT,
    exposed: deployment === 'frontend' || deployment === 'backend' || deployment === undefined,
    cpuMillis: parseCpu(resources.cpu?.limit) ?? parseCpu(resources.cpu?.request),
    memoryMiB: parseMem(resources.memory?.limit) ?? parseMem(resources.memory?.request),
    minReplicas: Math.max(min, 1),
    maxReplicas: Math.max(scaling.max ?? Math.max(min, 1) * 3, min, 1),
    healthPath: health.path ?? '/',
    env: Object.fromEntries(Object.entries(s.env).map(([k, v]) => [k, String(v)])),
    dependsOn: s.dependsOn,
  };
}

export interface IacModel {
  project: string;
  services: IacService[];
  /** Default region/location from workspace config.defaultRegion, when present. */
  defaultRegion: string | undefined;
}

/**
 * Build the neutral model for the selected services.
 *
 * @throws Error for unknown service names or an empty selection.
 */
export function buildIacModel(ws: LoadedWorkspace, selected?: string[]): IacModel {
  const all = ws.services;
  const wanted = selected && selected.length > 0 ? selected : all.map(s => s.name);
  const unknown = wanted.filter(n => !all.some(s => s.name === n));
  if (unknown.length > 0) {
    throw new Error(`Unknown service(s): ${unknown.join(', ')}. Available: ${all.map(s => s.name).join(', ')}`);
  }
  const services = all.filter(s => wanted.includes(s.name)).map(toService);
  if (services.length === 0) throw new Error('Workspace defines no services to deploy');
  const defaultRegion = (ws.config.config as { defaultRegion?: string } | undefined)?.defaultRegion;
  return { project: ws.config.name, services, defaultRegion };
}

// --------------------------------------------------------------------------
// Cross-service URL references in env values
// --------------------------------------------------------------------------

export interface EnvRef {
  /** Referenced service. */
  service: string;
  /** Matched scheme (e.g. `http`). */
  scheme: string;
  /** Path/query suffix after host[:port] (may be empty). */
  suffix: string;
}

const URL_REF = /^([a-z][a-z0-9+.-]*):\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?)(?::\d+)?((?:[/?#].*)?)$/;

/** Detect `scheme://<service>[:port][/path]` values that point at another selected service. */
export function parseEnvRef(value: string, services: IacService[], self: string): EnvRef | null {
  const m = URL_REF.exec(value);
  if (!m) return null;
  const target = m[2];
  if (target === self || !services.some(s => s.name === target)) return null;
  return { service: target, scheme: m[1], suffix: m[4] ?? '' };
}

/**
 * Find env references that can be expressed as Terraform attribute references
 * without creating a dependency cycle. Returns, per service, a map
 * envKey -> EnvRef for the acyclic edges; the rest stay literal.
 */
export function resolveEnvRefs(services: IacService[]): { refs: Map<string, Map<string, EnvRef>>; cyclic: string[] } {
  const all = new Map<string, Map<string, EnvRef>>();
  for (const s of services) {
    const m = new Map<string, EnvRef>();
    for (const [k, v] of Object.entries(s.env)) {
      const ref = parseEnvRef(v, services, s.name);
      if (ref) m.set(k, ref);
    }
    all.set(s.name, m);
  }
  // depth-first search; edges closing a cycle are dropped
  const state = new Map<string, 0 | 1 | 2>();
  const cyclic: string[] = [];
  const kept = new Map<string, Map<string, EnvRef>>(services.map(s => [s.name, new Map<string, EnvRef>()]));
  const visit = (name: string): void => {
    state.set(name, 1);
    for (const [key, ref] of all.get(name) ?? []) {
      const st = state.get(ref.service) ?? 0;
      if (st === 1) {
        cyclic.push(`${name}.${key} -> ${ref.service}`);
        continue;
      }
      kept.get(name)!.set(key, ref);
      if (st === 0) visit(ref.service);
    }
    state.set(name, 2);
  };
  for (const s of services) if ((state.get(s.name) ?? 0) === 0) visit(s.name);
  return { refs: kept, cyclic };
}
