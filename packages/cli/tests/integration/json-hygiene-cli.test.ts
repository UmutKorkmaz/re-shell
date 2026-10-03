import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * End-to-end contract for `--json` hygiene, driving the BUILT CLI
 * (dist/index.js): every command run with --json prints exactly ONE parseable
 * single-line envelope on stdout and exits non-zero when `ok:false`; spinners,
 * banners and human text never reach stdout.
 */

const CLI = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 128 * 1024 * 1024;

interface Run {
  stdout: string;
  stderr: string;
  status: number | null;
}

let fixture: string;
let home: string;

function run(args: string[], cwd: string = fixture): Run {
  const res = spawnSync('node', [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    timeout: 90000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOME: home, CI: '1', NO_COLOR: '1' },
  });
  return { stdout: res.stdout, stderr: res.stderr, status: res.status };
}

function write(rel: string, content: unknown): void {
  const file = path.join(fixture, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

/** stdout must be exactly one non-empty line holding a JSON envelope. */
function envelope(result: Run): { ok: boolean; data?: unknown; error?: { code: string; message: string }; warnings: string[] } {
  const lines = result.stdout.split('\n').filter(l => l.length > 0);
  expect(lines.length, `expected one stdout line, got ${lines.length}: ${result.stdout.slice(0, 400)}`).toBe(1);
  const env = JSON.parse(lines[0]);
  expect(typeof env.ok).toBe('boolean');
  expect(Array.isArray(env.warnings)).toBe(true);
  if (env.ok === false) {
    expect(env.error.code).toEqual(expect.any(String));
    expect(env.error.message).toEqual(expect.any(String));
    expect(result.status, 'ok:false must exit non-zero').not.toBe(0);
  }
  return env;
}

beforeAll(() => {
  if (!fs.existsSync(CLI)) throw new Error(`Built CLI not found at ${CLI}`);
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-json-hygiene-'));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-json-home-'));
  write('package.json', { name: 'fx-root', version: '1.0.0', private: true, workspaces: ['packages/*', 'apps/*'] });
  write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n  - 'apps/*'\n");
  write('packages/a/package.json', { name: '@fx/a', version: '1.0.0' });
  write('packages/b/package.json', { name: '@fx/b', version: '1.0.0', dependencies: { '@fx/a': 'workspace:*' } });
  write('apps/web/package.json', { name: '@fx/web', version: '1.0.0', dependencies: { '@fx/b': 'workspace:*' } });
});

afterAll(() => {
  fs.rmSync(fixture, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

describe('--json prints exactly one single-line envelope', () => {
  // Representative set covering every previously-leaking family: spinner leaks
  // (tools devenv, workspace migration, config *, api, generate), raw
  // multi-line JSON (tools, plugin, workspace state/changes), and failure paths.
  const COMMANDS: string[][] = [
    ['tools', 'devenv', 'detect'],
    ['tools', 'detect'],
    ['tools', 'di-analyze'],
    ['tools', 'dry-run'],
    ['tools', 'hotreload', 'list'],
    ['tools', 'hotreload', 'detect'],
    ['workspace', 'migration', 'plan', '--target-version', '2.0'],
    ['workspace', 'migration', 'plan'],
    ['workspace', 'migration', 'upgrade'],
    ['workspace', 'migration', 'check'],
    ['workspace', 'migration', 'history'],
    ['workspace', 'graph-analysis', 'analyze'],
    ['workspace', 'graph-analysis', 'cycles'],
    ['workspace', 'diagnostics', 'check'],
    ['workspace', 'diagnostics', 'quick'],
    ['workspace', 'state', 'status'],
    ['workspace', 'changes', 'status'],
    ['config', 'show'],
    ['config', 'get', 'nope'],
    ['config', 'validate', 'all'],
    ['config', 'diff', 'status'],
    ['config', 'diff', 'merge'],
    ['config', 'diff', 'apply'],
    ['config', 'unified', 'sync'],
    ['config', 'unified', 'validate'],
    ['config', 'profile', 'list'],
    ['api', 'openapi', 'discover'],
    ['plugin', 'list'],
    ['plugin', 'stats'],
    ['plugin', 'hook-types'],
    ['quality', 'test', 'frameworks'],
    ['service', 'polyglot', 'list'],
    ['ui'],
    ['doctor'],
    ['commands', 'list'],
    ['templates', 'list'],
  ];

  for (const args of COMMANDS) {
    it(`${args.join(' ')} --json`, () => {
      const result = run([...args, '--json']);
      const env = envelope(result);
      // Spinner/progress text goes to stderr, never stdout.
      expect(result.stdout).not.toContain('⏳');
      expect(env.ok === true || env.ok === false).toBe(true);
    });
  }

  it('commander usage errors become a USAGE_ERROR envelope', () => {
    const result = run(['workspace', 'migrate-monorepo', '--json']);
    const env = envelope(result);
    expect(env.ok).toBe(false);
    expect(env.error?.code).toBe('USAGE_ERROR');
    expect(result.status).toBe(1);
  });

  it('an unknown command with --json is a USAGE_ERROR envelope', () => {
    const env = envelope(run(['definitely-not-a-command', '--json']));
    expect(env.ok).toBe(false);
    expect(env.error?.code).toBe('USAGE_ERROR');
  });
});

describe('derived workspace definition (plain monorepo, no re-shell.workspaces.yaml)', () => {
  it('graph-analysis analyze works and says the definition was derived', () => {
    const result = run(['workspace', 'graph-analysis', 'analyze', '--json']);
    const env = envelope(result);
    expect(env.ok).toBe(true);
    expect(result.status).toBe(0);
    const data = env.data as { nodeCount: number; edgeCount: number };
    expect(data.nodeCount).toBe(3);
    expect(data.edgeCount).toBe(2);
    expect(env.warnings.join('\n')).toMatch(/derived the workspace definition/);
  });

  it('diagnostics check works on a plain monorepo', () => {
    const env = envelope(run(['workspace', 'diagnostics', 'check', '--json']));
    expect(env.ok).toBe(true);
    expect((env.data as { categories: unknown[] }).categories.length).toBeGreaterThan(0);
  });

  it('exits non-zero (NOT_IN_MONOREPO) when there is no monorepo to derive from', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-no-monorepo-'));
    try {
      const result = run(['workspace', 'graph-analysis', 'analyze', '--json'], empty);
      const env = envelope(result);
      expect(env.ok).toBe(false);
      expect(env.error?.code).toBe('NOT_IN_MONOREPO');
      const human = run(['workspace', 'graph-analysis', 'analyze'], empty);
      expect(human.status).not.toBe(0);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('an explicitly named missing file is an error, not a silent derive', () => {
    const result = run(['workspace', 'graph-analysis', 'analyze', '--file', 'nope.yaml', '--json']);
    const env = envelope(result);
    expect(env.error?.code).toBe('WORKSPACE_NOT_FOUND');
  });
});

describe('doctor fails honestly', () => {
  it('outside a monorepo: data keeps the checks, exit code is 1', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-doctor-empty-'));
    try {
      const result = run(['doctor', '--json'], empty);
      const env = envelope(result);
      expect(env.ok).toBe(true); // documented: findings are the payload, exit code is the gate
      const data = env.data as { checks: Array<{ status: string }>; healthy: boolean; summary: { errors: number } };
      expect(data.checks.some(c => c.status === 'error')).toBe(true);
      expect(data.healthy).toBe(false);
      expect(data.summary.errors).toBeGreaterThan(0);
      expect(result.status).toBe(1);
      expect(run(['doctor'], empty).status).toBe(1);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('--version', () => {
  it('prints only the version line (no banner) on stdout', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    const result = run(['--version']);
    expect(result.stdout).toBe(`${pkg.version}\n`);
    expect(result.status).toBe(0);
    expect(run(['-V']).stdout).toBe(`${pkg.version}\n`);
  });

  it('prints no banner on non-TTY stdout for bare --help', () => {
    const result = run(['--help']);
    expect(result.stdout).not.toContain('██');
    expect(result.stdout).toContain('Usage:');
  });
});

describe('EPIPE', () => {
  it('exits quietly when the reader closes the pipe early', async () => {
    const child = spawn('node', [CLI, 'templates', 'list', '--json'], {
      cwd: fixture,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: home, CI: '1', NO_COLOR: '1' },
    });
    let stderr = '';
    child.stderr.on('data', d => (stderr += d));
    let got = 0;
    child.stdout.on('data', d => {
      got += d.length;
      if (got >= 100) {
        child.stdout.destroy(); // like `| head -c 100`
      }
    });
    const status = await new Promise<number | null>(resolve => child.on('close', code => resolve(code)));
    expect(stderr).not.toMatch(/EPIPE|Uncaught Exception|\bat .*\(.*:\d+:\d+\)/);
    expect(status).toBe(0);
  });
});

describe('api verify is reachable', () => {
  it('registers verify on the existing api group', () => {
    const result = run(['api', 'verify', '--json']);
    const env = envelope(result);
    // No spec in the fixture, but the command ran (a USAGE_ERROR here would mean
    // commander did not know `verify`).
    expect(env.error?.code).toBe('API_VERIFY_ERROR');
  });
});

describe('command tree', () => {
  let catalog: Array<{ path: string; aliases: string[]; supportsJson: boolean }>;
  beforeAll(() => {
    catalog = (envelope(run(['commands', 'list', '--json'])).data as typeof catalog) ?? [];
  });

  it('lists every path exactly once (no shadowed duplicates)', () => {
    const paths = catalog.map(e => e.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter(p => p === 'dev')).toHaveLength(1);
    expect(paths.filter(p => p === 'migrate')).toHaveLength(1);
    expect(paths).toContain('api verify');
  });

  it('does not advertise deprecated alias stubs', () => {
    const paths = new Set(catalog.map(e => e.path));
    for (const stub of ['workspace-health', 'config-diff', 'file-watcher', 'uconfig']) {
      expect(paths.has(stub)).toBe(false);
    }
  });

  it('matches the committed command-path snapshot', () => {
    const lines = catalog.map(e => e.path).sort();
    expect(lines.join('\n') + '\n').toMatchSnapshot();
  });
});

describe('shell completion is generated from the live tree', () => {
  it('--print bash offers every live top-level command, including the 16 once missing', () => {
    const result = run(['completion', '--print', '--shell', 'bash']);
    expect(result.status).toBe(0);
    for (const cmd of [
      'templates', 'commands', 'ai', 'find', 'agents', 'run', 'cache', 'dev',
      'scorecard', 'release', 'migrate', 'catalog', 'federation', 'fix', 'boundaries', 'env',
    ]) {
      expect(result.stdout, cmd).toMatch(new RegExp(`'[^']*\\b${cmd}\\b[^']*'`));
    }
  });

  it('--print zsh is a #compdef script', () => {
    const result = run(['completion', '--print', '--shell', 'zsh']);
    expect(result.status).toBe(0);
    expect(result.stdout.startsWith('#compdef re-shell')).toBe(true);
  });

  it('ships generated scripts in dist/completions (not hand-written command lists)', () => {
    const bash = fs.readFileSync(path.resolve(process.cwd(), 'dist/completions/bash'), 'utf8');
    expect(bash).toContain('Generated from the live command tree');
    expect(bash).toContain('scorecard');
    expect(fs.existsSync(path.resolve(process.cwd(), 'src/completions/bash'))).toBe(false);
  });

  it('bash completion actually completes nested subcommands', () => {
    const script = path.resolve(process.cwd(), 'dist/completions/bash');
    const out = spawnSync(
      'bash',
      [
        '-c',
        `source ${script}; COMP_WORDS=(re-shell workspace graph-analysis cy); COMP_CWORD=3; _re_shell_completions; printf '%s\\n' "\${COMPREPLY[@]}"`,
      ],
      { encoding: 'utf8' }
    );
    expect(out.stdout.trim()).toBe('cycles');
  });
});
