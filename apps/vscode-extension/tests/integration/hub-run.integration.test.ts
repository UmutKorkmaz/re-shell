import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fetchCommandCatalogRaw } from '../../src/cli.js';
import {
  buildHubRunSpec,
  parseCommandCatalog,
  parseJobEnvelope,
  type CatalogEntry,
} from '../../src/core/index.js';
import { runHubJob } from '../../src/hub-run.js';
import { createFixtureWorkspace, removeFixtureWorkspace } from '../support/fixture-workspace.js';
import { resolveRepoArtifacts, startRealHub, type RunningHub } from '../support/hub-process.js';

/**
 * Drives the extension's own request/parse code against the REAL hub
 * (apps/web/dist/hub-server.js) and the REAL CLI (packages/cli/dist/index.js):
 * list commands from the CLI, build a spec, run it through the hub, and read the
 * job result back. No VS Code involved.
 */

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = resolveRepoArtifacts(packageRoot);

let workspace: string;
let hub: RunningHub;
let catalog: CatalogEntry[];

beforeAll(async () => {
  workspace = createFixtureWorkspace();
  hub = await startRealHub({ artifacts, workspace });

  // The same call the extension makes on activation. cliEntry is a JS file with
  // no executable bit, so this also covers the "run a JS entry under Node" path.
  const raw = await fetchCommandCatalogRaw(artifacts.cliEntry, workspace);
  expect(raw.code).toBe(0);
  const parsed = parseCommandCatalog(raw.stdout);
  if (!parsed.ok) throw new Error(parsed.error);
  catalog = parsed.entries;
});

afterAll(async () => {
  await hub?.stop();
  if (workspace) removeFixtureWorkspace(workspace);
});

function entryFor(path: string): CatalogEntry {
  const entry = catalog.find((e) => e.path === path);
  if (!entry) throw new Error(`"${path}" is not in the CLI catalog`);
  return entry;
}

describe('catalog from the real CLI', () => {
  it('lists commands including every hub-runnable one', () => {
    expect(catalog.length).toBeGreaterThan(20);
    for (const path of ['workspace summary', 'workspace health', 'workspace graph', 'commands list']) {
      expect(catalog.map((e) => e.path)).toContain(path);
    }
  });
});

describe('run via the real hub', () => {
  it('runs `workspace summary` in the hub workspace and returns the job result', async () => {
    const target = buildHubRunSpec(entryFor('workspace summary'), workspace);
    expect(target.ok).toBe(true);
    if (!target.ok) return;

    const result = await runHubJob(
      { baseUrl: hub.url, token: hub.token },
      target.request.commandId,
      target.request.params,
      { timeoutMs: 60_000 }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exitCode).toBe(0);
    expect(result.protocolProblems).toEqual([]);

    const envelope = parseJobEnvelope(result.stdout);
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    const data = envelope.data as { root: string; workspaces: { name: string; type: string }[] };
    // The job really ran in the fixture workspace, not somewhere else.
    expect(data.root).toBe(workspace);
    expect(data.workspaces.map((w) => w.name).sort()).toEqual(['demo-app', 'demo-lib']);
  });

  it('runs `workspace graph` and sees the app -> package dependency', async () => {
    const target = buildHubRunSpec(entryFor('workspace graph'), workspace);
    if (!target.ok) throw new Error(target.error);
    const result = await runHubJob({ baseUrl: hub.url, token: hub.token }, 'run', target.request.params);
    expect(result.ok && result.exitCode).toBe(0);
    if (!result.ok) return;
    const envelope = parseJobEnvelope(result.stdout);
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    const graph = envelope.data as { apps: { name: string; dependencies: string[] }[] };
    expect(graph.apps).toEqual([
      expect.objectContaining({ name: 'demo-app', dependencies: ['demo-lib'] }),
    ]);
  });

  it('reassembles a multi-chunk response exactly (`commands list` is hundreds of KB)', async () => {
    const target = buildHubRunSpec(entryFor('commands list'), workspace);
    if (!target.ok) throw new Error(target.error);
    const result = await runHubJob({ baseUrl: hub.url, token: hub.token }, 'run', target.request.params);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stdout.length).toBeGreaterThan(100_000);

    // What came through the hub must be byte-for-byte the CLI's own catalog.
    const viaHub = parseCommandCatalog(result.stdout);
    expect(viaHub.ok).toBe(true);
    if (!viaHub.ok) return;
    expect(viaHub.entries).toEqual(catalog);
  });

  it('surfaces a failing command as a settled result with the CLI error envelope', async () => {
    // `workspace validate` needs a re-shell workspace config the fixture lacks.
    const target = buildHubRunSpec(entryFor('workspace validate'), workspace);
    if (!target.ok) throw new Error(target.error);
    const result = await runHubJob({ baseUrl: hub.url, token: hub.token }, 'run', target.request.params);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exitCode).not.toBe(0);
    const envelope = parseJobEnvelope(result.stdout);
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) expect(envelope.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('is refused with 401 for a wrong token', async () => {
    const result = await runHubJob({ baseUrl: hub.url, token: 'not-the-token' }, 'run', {
      subcommand: 'workspace summary',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('unauthorized');
      expect(result.status).toBe(401);
    }
  });

  it('is refused with 400 for a cwd outside the hub workspace', async () => {
    const result = await runHubJob({ baseUrl: hub.url, token: hub.token }, 'run', {
      subcommand: 'workspace summary',
      cwd: '/',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('rejected');
      expect(result.message).toMatch(/outside the workspace root/);
    }
  });

  it('is refused with 400 for a subcommand that is not on the allow-list', async () => {
    const result = await runHubJob({ baseUrl: hub.url, token: hub.token }, 'run', {
      subcommand: 'create',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('rejected');
      expect(result.message).toMatch(/Invalid params/);
    }
  });

  it('reports an unreachable hub once it has stopped', async () => {
    const throwaway = await startRealHub({ artifacts, workspace });
    await throwaway.stop();
    const result = await runHubJob({ baseUrl: throwaway.url, token: throwaway.token }, 'run', {
      subcommand: 'workspace summary',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('unreachable');
  });
});
