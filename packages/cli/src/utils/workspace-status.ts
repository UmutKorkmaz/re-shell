/**
 * Live workspace status: running / stopped / unhealthy / unknown, each with the
 * reason it was decided.
 *
 * Inputs (all real, nothing simulated):
 *  - PID records written by `re-shell service run` under `<dir>/.re-shell/pids`
 *    (JSON with pid, pgid, start-time token, port, health URL). A record only
 *    counts as alive when the process identity check passes, so a recycled PID
 *    is reported as stopped, never as running.
 *  - The `re-shell.services` block and `--port` flags of a workspace's
 *    dev/start/serve scripts: the configured port and health URL.
 *  - A TCP probe of the configured port and an HTTP GET of the health URL.
 *
 * Verdicts:
 *  - running:   process alive and its probes pass, or (unsupervised) the
 *               configured port / health URL answers
 *  - unhealthy: process alive but a configured probe fails, or the port is open
 *               while the health URL fails
 *  - stopped:   a record exists but the process is gone, or a configured
 *               port / health URL does not answer
 *  - unknown:   nothing configured to check (library, no service script, ...)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import {
  rollupStatus,
  type WorkspaceLiveStatus,
  type WorkspaceStatusCheck,
  type WorkspaceStatusEntry,
  type WorkspaceStatusReport,
} from '@re-shell/contracts';
import { getWorkspaces, type WorkspaceInfo } from './monorepo';
import {
  checkRecordIdentity,
  probePort,
  probeUrl,
  readServiceRecords,
  type ServiceProcessRecord,
} from './service-process';

/** Script names treated as long-running services (mirrors `service run`). */
const SERVICE_SCRIPT_NAME = /^(dev|develop|start|serve)([:._-].*)?$/;

export interface WorkspaceStatusOptions {
  /** Probe timeouts. */
  portTimeoutMs?: number;
  urlTimeoutMs?: number;
  /** Probe health URLs whose host is not loopback. Off by default (SSRF guard). */
  allowRemoteProbes?: boolean;
  /** Max workspaces evaluated concurrently. */
  concurrency?: number;
  /** Clock override for tests. */
  now?: () => Date;
}

interface ServiceDescriptor {
  name: string;
  port?: number;
  healthUrl?: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

function isLoopbackUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return LOOPBACK_HOSTS.has(host) || host.endsWith('.localhost') || /^127\./.test(host);
  } catch {
    return false;
  }
}

/** Read the configured services (script name, port, health URL) of one workspace. */
export async function readServiceDescriptors(workspaceDir: string): Promise<ServiceDescriptor[]> {
  let pkg: {
    scripts?: Record<string, unknown>;
    ['re-shell']?: { services?: Record<string, { port?: unknown; healthUrl?: unknown }> };
  };
  try {
    pkg = JSON.parse(await fs.readFile(path.join(workspaceDir, 'package.json'), 'utf8'));
  } catch {
    return [];
  }
  const meta = pkg['re-shell']?.services ?? {};
  const out: ServiceDescriptor[] = [];
  for (const [scriptName, script] of Object.entries(pkg.scripts ?? {})) {
    if (!SERVICE_SCRIPT_NAME.test(scriptName)) continue;
    const text = String(script);
    const match = text.match(/(?:^|\s)-p[=\s]+(\d+)|--port[=\s]+(\d+)|PORT=(\d+)/);
    const scriptPort = match ? parseInt(match[1] || match[2] || match[3], 10) : undefined;
    const declared = meta[scriptName] ?? {};
    out.push({
      name: scriptName.replace(/:/g, '-'),
      port: typeof declared.port === 'number' ? declared.port : scriptPort,
      healthUrl: typeof declared.healthUrl === 'string' ? declared.healthUrl : undefined,
    });
  }
  return out;
}

interface Probes {
  port: (port: number) => Promise<boolean>;
  url: (url: string) => Promise<boolean>;
  allowRemote: boolean;
}

/** Decide one service's status from its (optional) record and configured probes. */
export async function evaluateService(
  desc: ServiceDescriptor,
  record: ServiceProcessRecord | undefined,
  probes: Probes
): Promise<WorkspaceStatusCheck> {
  const port = record?.port ?? desc.port;
  const healthUrl = record?.healthUrl ?? desc.healthUrl;
  const base: Pick<WorkspaceStatusCheck, 'name' | 'port' | 'healthUrl'> = {
    name: record?.name ?? desc.name,
    ...(port !== undefined ? { port } : {}),
    ...(healthUrl !== undefined ? { healthUrl } : {}),
  };

  const urlAllowed = healthUrl !== undefined && (probes.allowRemote || isLoopbackUrl(healthUrl));
  const urlSkipped = healthUrl !== undefined && !urlAllowed;

  let alive: { pid: number; startedAt: string } | null = null;
  if (record) {
    const identity = checkRecordIdentity(record);
    if (identity.state === 'alive' || identity.state === 'group-orphans') {
      alive = { pid: record.pid, startedAt: record.startedAt };
    } else {
      const why =
        identity.state === 'reused'
          ? `pid ${record.pid} now belongs to a different process`
          : identity.state === 'unverifiable'
            ? `pid ${record.pid} exists but its start time was not recorded, so it cannot be verified`
            : `process ${record.pid} started ${record.startedAt} is no longer running`;
      return {
        ...base,
        status: 'stopped',
        source: 'process',
        pid: record.pid,
        startedAt: record.startedAt,
        reason: why,
      };
    }
  }

  const urlOk = urlAllowed ? await probes.url(healthUrl!) : undefined;
  const portOk = port !== undefined ? await probes.port(port) : undefined;

  if (alive) {
    const common = { ...base, source: 'process' as const, pid: alive.pid, startedAt: alive.startedAt };
    if (urlOk === false) {
      return { ...common, status: 'unhealthy', reason: `process ${alive.pid} is alive but health URL ${healthUrl} did not answer 2xx/3xx` };
    }
    if (portOk === false) {
      return { ...common, status: 'unhealthy', reason: `process ${alive.pid} is alive but nothing accepts connections on port ${port}` };
    }
    const probed = [urlOk ? `health URL ${healthUrl} ok` : undefined, portOk ? `port ${port} open` : undefined].filter(Boolean);
    return {
      ...common,
      status: 'running',
      reason:
        `process ${alive.pid} is alive` +
        (probed.length ? `, ${probed.join(', ')}` : urlSkipped ? `; health URL ${healthUrl} not probed (non-loopback host)` : '; no port or health URL configured to probe'),
    };
  }

  // Not supervised by re-shell: judge by what the configuration lets us probe.
  if (urlOk !== undefined) {
    if (urlOk) {
      return { ...base, status: 'running', source: 'health-url', reason: `health URL ${healthUrl} answered (not started by re-shell)` };
    }
    if (portOk) {
      return { ...base, status: 'unhealthy', source: 'health-url', reason: `port ${port} is open but health URL ${healthUrl} did not answer 2xx/3xx` };
    }
    return { ...base, status: 'stopped', source: 'health-url', reason: `health URL ${healthUrl} did not answer` };
  }
  if (portOk !== undefined) {
    return portOk
      ? { ...base, status: 'running', source: 'port', reason: `port ${port} accepts connections (not started by re-shell)` }
      : { ...base, status: 'stopped', source: 'port', reason: `nothing accepts connections on port ${port}` };
  }
  return {
    ...base,
    status: 'unknown',
    source: 'none',
    reason: urlSkipped
      ? `health URL ${healthUrl} has a non-loopback host; pass --allow-remote-probes to probe it`
      : 'no port or health URL configured, and no supervised process record',
  };
}

/** Records that belong to a workspace: same cwd, same name, or `<path>-<script>` naming. */
function recordsForWorkspace(
  ws: WorkspaceInfo,
  wsDir: string,
  byCwd: Map<string, ServiceProcessRecord[]>,
  byName: Map<string, ServiceProcessRecord>,
  rootRecords: ServiceProcessRecord[]
): ServiceProcessRecord[] {
  const found = new Map<string, ServiceProcessRecord>();
  for (const r of byCwd.get(wsDir) ?? []) found.set(r.name, r);
  const named = byName.get(ws.name);
  if (named) found.set(named.name, named);
  const prefix = `${ws.path}-`;
  for (const r of rootRecords) {
    if (r.name.startsWith(prefix)) found.set(r.name, r);
  }
  return [...found.values()];
}

async function pool<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

/** Collect the live status of every workspace of the monorepo at `root`. */
export async function collectWorkspaceStatus(
  root: string,
  options: WorkspaceStatusOptions = {}
): Promise<WorkspaceStatusReport> {
  const workspaces = await getWorkspaces(root);
  const probes: Probes = {
    port: (port) => probePort(port, ['127.0.0.1', '::1'], options.portTimeoutMs ?? 400),
    url: (url) => probeUrl(url, options.urlTimeoutMs ?? 1500),
    allowRemote: options.allowRemoteProbes ?? false,
  };

  const rootRecords = (await readServiceRecords(root)).records;
  const byCwd = new Map<string, ServiceProcessRecord[]>();
  const byName = new Map<string, ServiceProcessRecord>();
  const realRoot = await fs.realpath(root);
  for (const r of rootRecords) {
    byName.set(r.name, r);
    let cwd = r.cwd;
    try {
      cwd = await fs.realpath(r.cwd);
    } catch {
      /* record points at a removed directory: keep the raw path */
    }
    byCwd.set(cwd, [...(byCwd.get(cwd) ?? []), r]);
  }

  const entries = await pool(workspaces, options.concurrency ?? 16, async (ws): Promise<WorkspaceStatusEntry> => {
    const wsDir = path.join(realRoot, ws.path);
    const own = (await readServiceRecords(wsDir)).records; // `service run` started from inside the workspace
    const records = new Map<string, ServiceProcessRecord>();
    for (const r of recordsForWorkspace(ws, wsDir, byCwd, byName, rootRecords)) records.set(r.name, r);
    for (const r of own) records.set(r.name, r);

    const descriptors = await readServiceDescriptors(path.join(root, ws.path));
    const checks: WorkspaceStatusCheck[] = [];
    const usedRecords = new Set<string>();

    for (const desc of descriptors) {
      // A record belongs to a descriptor when its name ends with the script name.
      const match = [...records.values()].find(
        (r) => r.name === desc.name || r.name.endsWith(`-${desc.name}`) || r.name === `${ws.name}-${desc.name}`
      );
      if (match) usedRecords.add(match.name);
      checks.push(await evaluateService(desc, match, probes));
    }
    for (const r of records.values()) {
      if (!usedRecords.has(r.name)) checks.push(await evaluateService({ name: r.name }, r, probes));
    }

    if (checks.length === 0) {
      return {
        name: ws.name,
        path: ws.path,
        status: 'unknown',
        reason: 'no dev/start/serve script, port, health URL or supervised process to check',
        checks: [],
      };
    }
    const status = rollupStatus(checks.map((c) => c.status));
    const worst = checks.find((c) => c.status === status) ?? checks[0];
    const reason = checks.length === 1 ? worst.reason : `${worst.name}: ${worst.reason} (${checks.length} services checked)`;
    return { name: ws.name, path: ws.path, status, reason, checks };
  });

  const summary: Record<WorkspaceLiveStatus, number> = { running: 0, stopped: 0, unhealthy: 0, unknown: 0 };
  for (const e of entries) summary[e.status]++;

  return {
    root,
    checkedAt: (options.now?.() ?? new Date()).toISOString(),
    nodes: entries,
    summary,
  };
}
