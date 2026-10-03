import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  classifyWorkspaceChange,
  watchWorkspaceChanges,
  type WorkspaceChangeKind,
} from '../../src/utils/graph-explorer-watch';

describe('classifyWorkspaceChange', () => {
  it('maps manifests to graph and service PID records to status, ignoring everything else', () => {
    expect(classifyWorkspaceChange('/r/apps/web/package.json')).toBe('graph');
    expect(classifyWorkspaceChange('/r/pnpm-workspace.yaml')).toBe('graph');
    expect(classifyWorkspaceChange('/r/packages/x/tsconfig.json')).toBe('graph');
    expect(classifyWorkspaceChange('/r/svc/go.mod')).toBe('graph');
    expect(classifyWorkspaceChange('/r/.re-shell/pids/web-dev.pid')).toBe('status');
    expect(classifyWorkspaceChange('/r/apps/web/src/index.ts')).toBeNull();
    expect(classifyWorkspaceChange('/r/.re-shell/logs/web-dev.log')).toBeNull();
  });
});

describe('watchWorkspaceChanges (real chokidar)', () => {
  const dirs: string[] = [];
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (closers.length) await closers.pop()!();
    while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  async function start(onChange: (k: ReadonlySet<WorkspaceChangeKind>) => void): Promise<string> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-watch-'));
    dirs.push(root);
    fs.mkdirSync(path.join(root, 'apps/web'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules/dep'), { recursive: true });
    fs.mkdirSync(path.join(root, '.re-shell/pids'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"r"}');
    fs.writeFileSync(path.join(root, 'apps/web/package.json'), '{"name":"web"}');
    closers.push(await watchWorkspaceChanges(root, onChange, { debounceMs: 80, usePolling: true }));
    return root;
  }

  async function waitFor(pred: () => boolean, ms = 8000): Promise<void> {
    const start = Date.now();
    while (!pred()) {
      if (Date.now() - start > ms) throw new Error('timed out waiting for watcher callback');
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  it('reports a manifest edit and a new workspace as `graph`, debounced into one callback', async () => {
    const calls: Array<Set<WorkspaceChangeKind>> = [];
    const root = await start((k) => calls.push(new Set(k)));
    fs.writeFileSync(path.join(root, 'apps/web/package.json'), '{"name":"web","dependencies":{"x":"1"}}');
    fs.mkdirSync(path.join(root, 'apps/new'));
    fs.writeFileSync(path.join(root, 'apps/new/package.json'), '{"name":"new"}');
    await waitFor(() => calls.length > 0);
    expect([...calls[0]]).toContain('graph');
    expect(calls.length).toBeLessThanOrEqual(2); // both writes land in the debounce window (or at most two windows)
  });

  it('reports PID record changes as `status` and ignores node_modules and source files', async () => {
    const calls: Array<Set<WorkspaceChangeKind>> = [];
    const root = await start((k) => calls.push(new Set(k)));
    fs.writeFileSync(path.join(root, 'node_modules/dep/package.json'), '{"name":"dep"}');
    fs.writeFileSync(path.join(root, 'apps/web/index.ts'), 'export {}');
    await new Promise((r) => setTimeout(r, 700));
    expect(calls).toHaveLength(0);
    fs.writeFileSync(path.join(root, '.re-shell/pids/web-dev.pid'), '{}');
    await waitFor(() => calls.length > 0);
    expect([...calls[0]]).toEqual(['status']);
  });

  it('stops delivering after close()', async () => {
    const calls: unknown[] = [];
    const root = await start((k) => calls.push(k));
    await closers.pop()!();
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"r2"}');
    await new Promise((r) => setTimeout(r, 600));
    expect(calls).toHaveLength(0);
  });
});
