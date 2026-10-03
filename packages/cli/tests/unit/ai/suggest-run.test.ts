import * as fs from 'fs';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { indexCatalog, vetArgv } from '../../../src/ai/argv-guard';
import { confirmAndRun, resolveSelfCommand, type RunDeps } from '../../../src/ai/run';
import { suggest } from '../../../src/ai/suggest';
import { LOW_CONFIDENCE_THRESHOLD } from '../../../src/ai/types';
import { buildWorkspaceContext, emptyWorkspaceContext, type WorkspaceContext } from '../../../src/ai/workspace-context';
import type { IntentCandidate } from '../../../src/utils/ai-intent';
import { createFixtureWorkspace, fixtureCatalog, tmpDir } from './helpers';

describe('suggest (confidence-scored autocomplete)', () => {
  let ws: ReturnType<typeof createFixtureWorkspace>;
  let ctx: WorkspaceContext;
  const catalog = fixtureCatalog();
  beforeAll(async () => {
    ws = createFixtureWorkspace();
    ctx = await buildWorkspaceContext(ws.root);
  });
  afterAll(() => ws.cleanup());

  const history = [
    { prompt: 'build the payments service', argv: ['run', 'build', '--filter', '@acme/payments-service'] },
    { prompt: 'check workspace health', argv: ['workspace', 'health'] },
  ];

  it('completes workspace-node actions from the real graph', () => {
    const s = suggest('build pay', { catalog, workspace: ctx });
    expect(s.map(x => x.text).sort()).toEqual(['build payments-db', 'build payments-service']);
    const svc = s.find(x => x.text === 'build payments-service')!;
    expect(svc.kind).toBe('node');
    expect(svc.argv).toEqual(['run', 'build', '--filter', '@acme/payments-service']);
    expect(svc.confidence).toBeGreaterThanOrEqual(LOW_CONFIDENCE_THRESHOLD);
    expect(svc.lowConfidence).toBe(false);
  });

  it('only offers actions that apply to the node (services get logs, packages get run)', () => {
    const s = suggest('logs ord', { catalog, workspace: ctx });
    expect(s[0]).toMatchObject({ text: 'logs orders', argv: ['service', 'run', 'logs', 'orders'] });
    expect(suggest('logs api', { catalog, workspace: ctx }).some(x => x.text === 'logs api')).toBe(false);
  });

  it('completes commands from the live catalogue', () => {
    const s = suggest('workspace he', { catalog, workspace: ctx });
    expect(s[0]).toMatchObject({ text: 'workspace health', kind: 'command', argv: ['workspace', 'health'] });
    expect(s[0].lowConfidence).toBe(false);
    expect(s[0].description).toContain('Run workspace health checks');
  });

  it('prefers the user\'s own history', () => {
    const s = suggest('build the pay', { catalog, workspace: ctx, history });
    expect(s[0]).toMatchObject({ kind: 'history', text: 'build the payments service' });
  });

  it('flags short, vague fragments as low confidence instead of hiding them', () => {
    const s = suggest('wo', { catalog, workspace: ctx });
    expect(s.length).toBeGreaterThan(0);
    expect(s.every(x => x.lowConfidence)).toBe(true);
    expect(s.every(x => x.confidence < LOW_CONFIDENCE_THRESHOLD)).toBe(true);
  });

  it('confidence rises as more of the completion is typed', () => {
    const conf = (p: string) => suggest(p, { catalog, workspace: ctx }).find(x => x.text === 'workspace health')?.confidence ?? 0;
    expect(conf('wo')).toBeLessThan(conf('workspace h'));
    expect(conf('workspace h')).toBeLessThanOrEqual(conf('workspace health'));
  });

  it('tolerates a typo in the last word', () => {
    const s = suggest('workspace helth', { catalog, workspace: ctx });
    expect(s[0].text).toBe('workspace health');
    expect(s[0].confidence).toBeLessThan(suggest('workspace health', { catalog, workspace: ctx })[0].confidence);
  });

  it('sorts by confidence, de-duplicates by command, and honours the limit', () => {
    const s = suggest('workspace', { catalog, workspace: ctx, limit: 3 });
    expect(s).toHaveLength(3);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].confidence).toBeGreaterThanOrEqual(s[i].confidence);
    const all = suggest('build', { catalog, workspace: ctx, history, limit: 50 });
    const keys = all.map(x => x.argv.join(' '));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never suggests the ai command family', () => {
    const all = suggest('ai', { catalog, workspace: ctx, limit: 50 });
    expect(all.some(x => x.argv[0] === 'ai')).toBe(false);
  });

  it('offers recent history, flagged low confidence, for an empty partial', () => {
    const s = suggest('', { catalog, workspace: ctx, history });
    expect(s.map(x => x.text)).toEqual(['build the payments service', 'check workspace health']);
    expect(s.every(x => x.lowConfidence)).toBe(true);
    expect(suggest('   ', { catalog, workspace: emptyWorkspaceContext('/x') })).toEqual([]);
  });

  it('returns nothing for a partial that matches nothing', () => {
    expect(suggest('zzzzqqqq', { catalog, workspace: ctx })).toEqual([]);
  });

  it('every suggested argv is a vetted, real command', () => {
    const index = indexCatalog(catalog);
    for (const p of ['build', 'logs', 'workspace', 'run', 'test', 'service']) {
      for (const s of suggest(p, { catalog, workspace: ctx, limit: 50 })) {
        if (s.kind !== 'history') expect(vetArgv(s.argv, index).ok, s.text).toBe(true);
      }
    }
  });
});

describe('confirmAndRun (the --run safety gate)', () => {
  const index = indexCatalog(fixtureCatalog());
  const candidate = (argv: string[], destructive = false): IntentCandidate => ({
    path: argv[0],
    description: 'd',
    argv,
    confidence: 0.9,
    destructive,
    supportsJson: false,
    supportsDryRun: false,
  });

  function harness(answer: boolean) {
    const lines: string[] = [];
    const prompts: string[] = [];
    const spawned: Array<{ command: string; args: string[]; options: any }> = [];
    const deps: RunDeps = {
      vet: argv => vetArgv(argv, index, { excludePathPrefixes: ['ai'] }),
      confirm: async m => {
        prompts.push(m);
        return answer;
      },
      print: l => lines.push(l),
      self: { command: '/usr/bin/node', prefixArgs: ['/opt/re-shell/dist/index.js'] },
      spawn: ((command: string, args: string[], options: any) => {
        spawned.push({ command, args, options });
        const handlers: Record<string, (v: any) => void> = {};
        setImmediate(() => handlers.close?.(0));
        return { on: (ev: string, fn: (v: any) => void) => (handlers[ev] = fn) } as any;
      }) as any,
    };
    return { deps, lines, prompts, spawned };
  }

  it('previews, asks, then spawns with shell:false and element-wise argv', async () => {
    const h = harness(true);
    const out = await confirmAndRun(
      candidate(['run', 'build', '--filter', '@acme/api']),
      { source: 'llm', provider: 'anthropic', model: 'claude-opus-5-5' },
      h.deps
    );
    expect(out).toEqual({ executed: true, exitCode: 0 });
    expect(h.prompts).toEqual(['Run `re-shell run build --filter @acme/api`?']);
    expect(h.lines.join('\n')).toContain('About to run: re-shell run build --filter @acme/api');
    expect(h.lines.join('\n')).toContain('anthropic (claude-opus-5-5)');
    expect(h.spawned).toEqual([
      {
        command: '/usr/bin/node',
        args: ['/opt/re-shell/dist/index.js', 'run', 'build', '--filter', '@acme/api'],
        options: { stdio: 'inherit', shell: false },
      },
    ]);
  });

  it('never runs without an explicit yes', async () => {
    const h = harness(false);
    const out = await confirmAndRun(candidate(['run', 'build']), { source: 'offline', provider: 'offline' }, h.deps);
    expect(out).toEqual({ executed: false, reason: 'declined' });
    expect(h.spawned).toEqual([]);
    expect(h.lines.join('\n')).toContain('Nothing was executed');
  });

  it('re-vets the argv and refuses anything that is not a real, safe command', async () => {
    for (const argv of [['frobnicate'], ['run', 'build', '--filter', 'a;rm -rf /'], ['ai', 'create', 'x'], ['run', '$(id)']]) {
      const h = harness(true);
      const out = await confirmAndRun(candidate(argv), { source: 'cache', provider: 'anthropic' }, h.deps);
      expect(out).toMatchObject({ executed: false, reason: 'rejected' });
      expect(h.spawned).toEqual([]);
      expect(h.prompts).toEqual([]); // not even asked
    }
  });

  it('warns about destructive commands before asking', async () => {
    const h = harness(true);
    await confirmAndRun(candidate(['service', 'run', 'down'], true), { source: 'offline', provider: 'offline' }, h.deps);
    expect(h.lines.some(l => l.startsWith('WARNING'))).toBe(true);
    expect(h.lines.findIndex(l => l.startsWith('WARNING'))).toBeLessThan(h.lines.length);
  });

  it('reports a spawn failure', async () => {
    const h = harness(true);
    h.deps.spawn = (() => {
      const handlers: Record<string, (v: any) => void> = {};
      setImmediate(() => handlers.error?.(new Error('ENOENT')));
      return { on: (ev: string, fn: (v: any) => void) => (handlers[ev] = fn) } as any;
    }) as any;
    const out = await confirmAndRun(candidate(['run', 'build']), { source: 'offline', provider: 'offline' }, h.deps);
    expect(out).toEqual({ executed: false, reason: 'spawn-failed', message: 'ENOENT' });
  });

  it('surfaces a non-zero exit code', async () => {
    const h = harness(true);
    h.deps.spawn = (() => {
      const handlers: Record<string, (v: any) => void> = {};
      setImmediate(() => handlers.close?.(3));
      return { on: (ev: string, fn: (v: any) => void) => (handlers[ev] = fn) } as any;
    }) as any;
    expect(await confirmAndRun(candidate(['run', 'build']), { source: 'offline', provider: 'offline' }, h.deps)).toEqual({
      executed: true,
      exitCode: 3,
    });
  });
});

describe('resolveSelfCommand', () => {
  it('re-invokes the running CLI only when the entry belongs to @re-shell/cli', () => {
    const t = tmpDir();
    try {
      const pkgDir = path.join(t.dir, 'cli');
      fs.mkdirSync(path.join(pkgDir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: '@re-shell/cli' }));
      fs.writeFileSync(path.join(pkgDir, 'dist/index.js'), '');
      const real = fs.realpathSync(path.join(pkgDir, 'dist/index.js'));
      expect(resolveSelfCommand(path.join(pkgDir, 'dist/index.js'))).toEqual({
        command: process.execPath,
        prefixArgs: [real],
      });

      const other = path.join(t.dir, 'other');
      fs.mkdirSync(path.join(other, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(other, 'package.json'), JSON.stringify({ name: 'something-else' }));
      fs.writeFileSync(path.join(other, 'dist/index.js'), '');
      expect(resolveSelfCommand(path.join(other, 'dist/index.js'))).toEqual({ command: 're-shell', prefixArgs: [] });
      expect(resolveSelfCommand(undefined)).toEqual({ command: 're-shell', prefixArgs: [] });
      expect(resolveSelfCommand(path.join(t.dir, 'missing.js'))).toEqual({ command: 're-shell', prefixArgs: [] });
    } finally {
      t.cleanup();
    }
  });
});
