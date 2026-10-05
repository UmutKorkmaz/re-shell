import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  jsonResponseSchema,
  workspaceGraphDiffSchema,
  workspaceStatusReportSchema,
} from '@re-shell/contracts';

/**
 * Integration tests for `workspace graph diff`, `workspace status` and
 * `workspace explore`, driving the BUILT CLI against a real temp git repo.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');

interface Run {
  stdout: string;
  stderr: string;
  status: number;
}

function runCli(args: string[], cwd: string): Run {
  const result = spawnSync('node', [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    input: '',
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 1 };
}

function envelope(stdout: string): { ok: boolean; data?: unknown; error?: { code: string; message: string } } {
  const lines = stdout.split('\n').filter((l) => l.length > 0);
  expect(lines, `stdout must be exactly one JSON line, got: ${stdout}`).toHaveLength(1);
  return JSON.parse(lines[0]);
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  }).trim();
}

function writePkg(root: string, rel: string, pkg: Record<string, unknown>): void {
  const dir = path.join(root, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

let repo: string;
let c1: string;
let c2: string;

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-graph-diff-'));
  git(repo, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'root', private: true, workspaces: ['apps/*', 'packages/*'] }));

  // v1: web -> ui -> core ; web -(dev)-> core ; legacy -> core
  writePkg(repo, 'apps/web', { name: '@t/web', version: '1.0.0', dependencies: { '@t/ui': '*', react: '^18' }, devDependencies: { '@t/core': '*' } });
  writePkg(repo, 'packages/ui', { name: '@t/ui', version: '1.0.0', dependencies: { '@t/core': '*' } });
  writePkg(repo, 'packages/core', { name: '@t/core', version: '1.0.0' });
  writePkg(repo, 'packages/legacy', { name: '@t/legacy', version: '1.0.0', dependencies: { '@t/core': '*' } });
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'v1');
  c1 = git(repo, 'rev-parse', 'HEAD');

  // v2: legacy removed; api added (-> core, ui); web framework changes (adds vue), core dev edge becomes prod; tsconfig on ui
  fs.rmSync(path.join(repo, 'packages/legacy'), { recursive: true });
  writePkg(repo, 'apps/web', {
    name: '@t/web',
    version: '1.1.0',
    dependencies: { '@t/ui': '*', '@t/core': '*', vue: '^3' },
  });
  writePkg(repo, 'packages/api', { name: '@t/api', version: '0.1.0', dependencies: { '@t/core': '*', '@t/ui': '*' } });
  fs.writeFileSync(path.join(repo, 'packages/ui/tsconfig.json'), '{}');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'v2');
  c2 = git(repo, 'rev-parse', 'HEAD');
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe('workspace graph diff (built CLI, temp git repo)', () => {
  it('diffs two commits: added/removed/changed nodes and edges, validated against the contract', () => {
    const run = runCli(['workspace', 'graph', 'diff', '--base', c1, '--head', c2, '--json'], repo);
    expect(run.status).toBe(0);
    const env = envelope(run.stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(workspaceGraphDiffSchema).parse(env);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const d = parsed.data;
    expect(d.base).toMatchObject({ ref: c1, kind: 'git', commit: c1, nodeCount: 4, edgeCount: 4 });
    expect(d.head).toMatchObject({ ref: c2, kind: 'git', commit: c2, nodeCount: 4 });
    expect(d.nodes.added.map((n) => n.id)).toEqual(['@t/api']);
    expect(d.nodes.removed.map((n) => n.id)).toEqual(['@t/legacy']);
    // framework: web gained `vue`? framework detection only knows react/angular/vue/svelte.
    const changed = d.nodes.changed.find((c) => c.id === '@t/web');
    expect(changed?.fields).toEqual(['framework']);
    expect(changed?.after.framework).toBe('vue');
    // ui gained a tsconfig.json: language javascript -> typescript
    expect(d.nodes.changed.find((c) => c.id === '@t/ui')?.fields).toEqual(['language']);
    const edge = (e: { from: string; to: string }) => `${e.from}>${e.to}`;
    expect(d.edges.added.map(edge).sort()).toEqual(['@t/api>@t/core', '@t/api>@t/ui']);
    expect(d.edges.removed.map(edge)).toEqual(['@t/legacy>@t/core']);
    expect(d.edges.changed).toEqual([{ from: '@t/web', to: '@t/core', before: 'devDependency', after: 'dependency' }]);
    expect(d.summary.hasChanges).toBe(true);
    expect(d.cyclesIntroduced).toEqual([]);
  });

  it('resolves refs by name (HEAD~1, branch) and defaults the head to the working tree', () => {
    const viaRef = envelope(runCli(['workspace', 'graph', 'diff', '--base', 'HEAD~1', '--json'], repo).stdout);
    expect(viaRef.ok).toBe(true);
    const data = viaRef.data as { summary: { hasChanges: boolean }; head: { kind: string } };
    expect(data.head.kind).toBe('working-tree');
    // The working tree equals HEAD (v2), so base=HEAD~1 shows exactly the v1->v2 change.
    expect(data.summary.hasChanges).toBe(true);
    const same = envelope(runCli(['workspace', 'graph', 'diff', '--base', 'main', '--json'], repo).stdout);
    expect((same.data as { summary: { hasChanges: boolean } }).summary.hasChanges).toBe(false);
  });

  it('sees uncommitted working-tree edits when head is omitted', () => {
    writePkg(repo, 'packages/extra', { name: '@t/extra', version: '0.0.1', dependencies: { '@t/api': '*' } });
    try {
      const env = envelope(runCli(['workspace', 'graph', 'diff', '--base', 'HEAD', '--json'], repo).stdout);
      const d = env.data as { nodes: { added: Array<{ id: string }> }; edges: { added: Array<{ from: string; to: string }> } };
      expect(d.nodes.added.map((n) => n.id)).toEqual(['@t/extra']);
      expect(d.edges.added).toEqual([{ from: '@t/extra', to: '@t/api', type: 'dependency' }]);
    } finally {
      fs.rmSync(path.join(repo, 'packages/extra'), { recursive: true });
    }
  });

  it('accepts a saved graph file for base and head', () => {
    const baseFile = path.join(repo, '..', `rs-base-${process.pid}.json`);
    const out = runCli(['workspace', 'graph', '--format', 'json', '--output', baseFile], repo);
    expect(out.status).toBe(0);
    try {
      const env = envelope(runCli(['workspace', 'graph', 'diff', '--base', baseFile.replace(/^.*\//, ''), '--json'], path.dirname(baseFile)).stdout);
      // cwd has no monorepo => explicit error, not a silent empty diff
      expect(env.ok).toBe(false);

      // Relative path inside the repo: head = the file, base = a commit.
      fs.copyFileSync(baseFile, path.join(repo, 'saved.json'));
      const diff = envelope(runCli(['workspace', 'graph', 'diff', '--base', c1, '--head', 'saved.json', '--json'], repo).stdout);
      expect(diff.ok).toBe(true);
      const d = diff.data as { head: { kind: string; nodeCount: number }; nodes: { added: Array<{ id: string }>; removed: Array<{ id: string }> } };
      expect(d.head).toMatchObject({ kind: 'file', nodeCount: 4 });
      expect(d.nodes.added.map((n) => n.id)).toEqual(['@t/api']);
      expect(d.nodes.removed.map((n) => n.id)).toEqual(['@t/legacy']);
    } finally {
      fs.rmSync(baseFile, { force: true });
      fs.rmSync(path.join(repo, 'saved.json'), { force: true });
    }
  });

  it('--format mermaid prints a coloured flowchart; --json --format mermaid embeds it', () => {
    const run = runCli(['workspace', 'graph', 'diff', '--base', c1, '--head', c2, '--format', 'mermaid'], repo);
    expect(run.status).toBe(0);
    expect(run.stdout.startsWith('graph TD')).toBe(true);
    expect(run.stdout).toContain('"@t/api"');
    expect(run.stdout).toContain(':::added');
    expect(run.stdout).toContain(':::removed');
    expect(run.stdout).toContain(':::changed');
    expect(run.stdout).toContain('classDef added');

    const both = envelope(runCli(['workspace', 'graph', 'diff', '--base', c1, '--head', c2, '--format', 'mermaid', '--json'], repo).stdout);
    expect(both.ok).toBe(true);
    expect((both.data as { mermaid: string }).mermaid).toContain('graph TD');
  });

  it('prints a readable text report by default', () => {
    const run = runCli(['workspace', 'graph', 'diff', '--base', c1, '--head', c2], repo);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Added nodes');
    expect(run.stdout).toContain('@t/api');
    expect(run.stdout).toContain('Removed nodes');
    expect(run.stdout).toContain('@t/legacy');
    const none = runCli(['workspace', 'graph', 'diff', '--base', c2, '--head', c2], repo);
    expect(none.stdout).toContain('No differences');
  });

  it('writes --output files', () => {
    const out = path.join(os.tmpdir(), `rs-diff-out-${process.pid}.mmd`);
    try {
      const run = runCli(['workspace', 'graph', 'diff', '--base', c1, '--head', c2, '--format', 'mermaid', '--output', out], repo);
      expect(run.status).toBe(0);
      expect(fs.readFileSync(out, 'utf8').startsWith('graph TD')).toBe(true);
    } finally {
      fs.rmSync(out, { force: true });
    }
  });

  it('fails explicitly (non-zero + coded envelope) for bad input', () => {
    const cases: Array<[string[], string]> = [
      [['--base', 'definitely-not-a-ref'], 'GRAPH_DIFF_INVALID_REF'],
      [['--base', '--upload-pack=evil'], 'GRAPH_DIFF_INVALID_REF'],
      [['--base', 'a..b'], 'GRAPH_DIFF_INVALID_REF'],
      [['--base', 'main; rm -rf ~'], 'GRAPH_DIFF_INVALID_REF'],
      [['--base', 'missing.json'], 'GRAPH_DIFF_INVALID_INPUT'],
      [['--base', c1, '--head', 'nope-ref'], 'GRAPH_DIFF_INVALID_REF'],
    ];
    for (const [args, code] of cases) {
      const run = runCli(['workspace', 'graph', 'diff', ...args, '--json'], repo);
      expect(run.status, args.join(' ')).toBe(1);
      const env = envelope(run.stdout);
      expect(env.ok).toBe(false);
      expect(env.error?.code, args.join(' ')).toBe(code);
    }
    const missingBase = runCli(['workspace', 'graph', 'diff', '--json'], repo);
    expect(missingBase.status).not.toBe(0);
    expect(missingBase.stderr).toContain('--base');
  });

  it('rejects a file that is not a graph document', () => {
    const bad = path.join(repo, 'bad.json');
    fs.writeFileSync(bad, JSON.stringify({ hello: 'world' }));
    try {
      const run = runCli(['workspace', 'graph', 'diff', '--base', 'bad.json', '--json'], repo);
      expect(run.status).toBe(1);
      const env = envelope(run.stdout);
      expect(env.error?.code).toBe('GRAPH_DIFF_INVALID_INPUT');
      expect(env.error?.message).toContain('unrecognised graph document');
    } finally {
      fs.rmSync(bad, { force: true });
    }
  });

  it('is an explicit error outside a monorepo', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-graph-empty-'));
    try {
      const run = runCli(['workspace', 'graph', 'diff', '--base', 'HEAD', '--json'], empty);
      expect(run.status).toBe(1);
      expect(envelope(run.stdout).error?.code).toBe('NOT_IN_MONOREPO');
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('works when the monorepo root is a subdirectory of the git repo', () => {
    const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-graph-sub-'));
    try {
      git(outer, 'init', '-q', '-b', 'main');
      const sub = path.join(outer, 'mono');
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(sub, 'package.json'), JSON.stringify({ name: 'r', workspaces: ['pkgs/*'] }));
      writePkg(sub, 'pkgs/a', { name: 'a' });
      git(outer, 'add', '-A');
      git(outer, 'commit', '-q', '-m', 'one');
      writePkg(sub, 'pkgs/b', { name: 'b', dependencies: { a: '*' } });
      git(outer, 'add', '-A');
      git(outer, 'commit', '-q', '-m', 'two');
      const env = envelope(runCli(['workspace', 'graph', 'diff', '--base', 'HEAD~1', '--head', 'HEAD', '--json'], sub).stdout);
      expect(env.ok).toBe(true);
      const d = env.data as { nodes: { added: Array<{ id: string }> }; edges: { added: unknown[] } };
      expect(d.nodes.added.map((n) => n.id)).toEqual(['b']);
      expect(d.edges.added).toHaveLength(1);
    } finally {
      fs.rmSync(outer, { recursive: true, force: true });
    }
  });

  it('reports cycles introduced by the head', () => {
    const cyc = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-graph-cyc-'));
    try {
      git(cyc, 'init', '-q', '-b', 'main');
      fs.writeFileSync(path.join(cyc, 'package.json'), JSON.stringify({ name: 'r', workspaces: ['p/*'] }));
      writePkg(cyc, 'p/a', { name: 'a', dependencies: { b: '*' } });
      writePkg(cyc, 'p/b', { name: 'b' });
      git(cyc, 'add', '-A');
      git(cyc, 'commit', '-q', '-m', 'acyclic');
      writePkg(cyc, 'p/b', { name: 'b', dependencies: { a: '*' } });
      const env = envelope(runCli(['workspace', 'graph', 'diff', '--base', 'HEAD', '--json'], cyc).stdout);
      expect((env.data as { cyclesIntroduced: string[][] }).cyclesIntroduced).toEqual([['a', 'b']]);
    } finally {
      fs.rmSync(cyc, { recursive: true, force: true });
    }
  });
});

describe('workspace graph --json additive fields', () => {
  it('adds type and language to every node while keeping the contract shape', () => {
    const env = envelope(runCli(['workspace', 'graph', '--json'], repo).stdout);
    expect(env.ok).toBe(true);
    const data = env.data as { apps: Array<Record<string, unknown>>; services: Array<Record<string, unknown>> };
    expect(data.apps[0]).toMatchObject({ name: '@t/web', type: 'app', language: 'javascript' });
    const ui = data.services.find((s) => s.name === '@t/ui');
    expect(ui).toMatchObject({ type: 'package', language: 'typescript', dependencies: ['@t/core'] });
  });

  it('--format mermaid/d3 use the shared converters (valid ids, real names as labels)', () => {
    const mermaid = runCli(['workspace', 'graph', '--format', 'mermaid'], repo).stdout;
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('("@t/ui")');
    expect(mermaid).not.toMatch(/^\s+@t\//m);
    const d3 = runCli(['workspace', 'graph', '--format', 'd3'], repo).stdout;
    const jsonStart = d3.indexOf('{');
    const parsed = JSON.parse(d3.slice(jsonStart, d3.lastIndexOf('}') + 1));
    expect(parsed.nodes.map((n: { id: string }) => n.id)).toContain('@t/web');
    expect(parsed.links[0]).toHaveProperty('source');
  });
});

describe('workspace explore (non-TTY)', () => {
  it('exits non-zero with a clear message when stdin/stdout are not terminals', () => {
    for (const args of [['workspace', 'explore'], ['workspace', 'graph', '--interactive']]) {
      const run = runCli(args, repo);
      expect(run.status, args.join(' ')).toBe(1);
      expect(run.stderr).toContain('needs a terminal');
      expect(run.stdout).not.toContain('graph explorer');
    }
  });

  it('rejects a bad --status-interval before doing anything', () => {
    const run = runCli(['workspace', 'explore', '--status-interval', 'abc'], repo);
    expect(run.status).toBe(1);
  });
});

describe('workspace status (built CLI)', () => {
  it('emits a contract-valid report with a reason for every node', () => {
    const run = runCli(['workspace', 'status', '--json'], repo);
    expect(run.status).toBe(0);
    const parsed = jsonResponseSchema(workspaceStatusReportSchema).parse(envelope(run.stdout));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.nodes.map((n) => n.name).sort()).toEqual(['@t/api', '@t/core', '@t/ui', '@t/web']);
    for (const node of parsed.data.nodes) {
      expect(node.reason.length).toBeGreaterThan(0);
      expect(node.status).toBe('unknown'); // nothing configured => honestly unknown
    }
    expect(parsed.data.summary).toEqual({ running: 0, stopped: 0, unhealthy: 0, unknown: 4 });
  });

  it('is an explicit error outside a monorepo', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-status-empty-'));
    try {
      const run = runCli(['workspace', 'status', '--json'], empty);
      expect(run.status).toBe(1);
      expect(envelope(run.stdout).error?.code).toBe('NOT_IN_MONOREPO');
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});
