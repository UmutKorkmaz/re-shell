import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runRestartPlan } from '../../src/commands/dev-restart-plan';

/**
 * Integration coverage for `re-shell dev --restart-plan` (issue #14): the
 * graph-aware change→ordered-restart resolver wired to a real CLI surface.
 * Filesystem access is confined to temp dirs torn down after each test.
 */

/** Build a temp monorepo with the given package graph (package.json per node). */
function makeWorkspace(graph: Record<string, string[]>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-dev-fusion-'));
  const pkgDir = path.join(dir, 'packages');
  for (const [name, deps] of Object.entries(graph)) {
    const sub = path.join(pkgDir, name);
    fs.mkdirSync(sub, { recursive: true });
    const dependencies: Record<string, string> = {};
    for (const dep of deps) dependencies[dep] = 'workspace:*';
    fs.writeFileSync(
      path.join(sub, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', dependencies }),
      'utf8'
    );
  }
  return dir;
}

const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe('runRestartPlan', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];

  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });

  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  it('restarts a shared lib + its transitive dependents in dependency order', async () => {
    const dir = makeWorkspace({ shared: [], api: ['shared'], web: ['api'] });
    TEMP_DIRS.push(dir);
    await runRestartPlan({ json: true, cwd: dir, changed: ['shared'] });

    const env = lastJson();
    expect(env['ok']).toBe(true);
    const data = env['data'] as {
      changed: string[];
      ordered: { name: string; reason: string; depth: number }[];
      affected: string[];
    };
    expect(data.changed).toEqual(['shared']);
    const names = data.ordered.map(t => t.name);
    expect(names.indexOf('shared')).toBe(0);
    expect(names.indexOf('api')).toBeLessThan(names.indexOf('web'));
    expect(names.sort()).toEqual(['api', 'shared', 'web']);
    const byName = new Map(data.ordered.map(t => [t.name, t]));
    expect(byName.get('shared')!.reason).toBe('changed');
    expect(byName.get('web')!.reason).toBe('dependent');
  });

  it('does not restart unrelated packages when an isolated package changes', async () => {
    const dir = makeWorkspace({ shared: [], api: ['shared'], web: ['api'], standalone: [] });
    TEMP_DIRS.push(dir);
    await runRestartPlan({ json: true, cwd: dir, changed: ['standalone'] });

    const data = lastJson().data as { ordered: { name: string }[]; affected: string[] };
    expect(data.ordered.map(t => t.name)).toEqual(['standalone']);
    expect(data.affected).toEqual(['standalone']);
  });

  it('emits "no changed packages" when none are detected from git', async () => {
    const dir = makeWorkspace({ shared: [], api: ['shared'] });
    TEMP_DIRS.push(dir);
    await runRestartPlan({
      json: true,
      cwd: dir,
      getChangedFiles: async () => [],
    });
    const data = lastJson().data as { ordered: unknown[]; warnings: string[] };
    expect(data.ordered).toEqual([]);
    expect(data.warnings.join(' ')).toMatch(/No changed packages/);
  });

  it('maps git-changed files to their owning packages', async () => {
    const dir = makeWorkspace({ shared: [], api: ['shared'] });
    TEMP_DIRS.push(dir);
    // Simulate a git change to packages/shared/src/index.ts.
    await runRestartPlan({
      json: true,
      cwd: dir,
      getChangedFiles: async () => ['packages/shared/src/index.ts'],
    });
    const data = lastJson().data as { changed: string[]; affected: string[] };
    expect(data.changed).toEqual(['shared']);
    expect(data.affected).toContain('api');
  });

  it('warns about changed packages not in the graph', async () => {
    const dir = makeWorkspace({ shared: [] });
    TEMP_DIRS.push(dir);
    await runRestartPlan({ json: true, cwd: dir, changed: ['shared', 'ghost'] });
    const data = lastJson().data as { warnings: string[]; ordered: { name: string }[] };
    expect(data.warnings.join(' ')).toMatch(/"ghost".*not in the workspace graph/);
    expect(data.ordered.map(t => t.name)).not.toContain('ghost');
  });
});
