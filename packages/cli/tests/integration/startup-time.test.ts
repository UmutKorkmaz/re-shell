import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Startup regression guard for lazy command-group loading.
 *
 * The deterministic assertions (which modules get loaded) are the real guard;
 * the timing assertions use deliberately generous thresholds so they only trip
 * on a regression back to "import every group at startup" (which costs seconds),
 * not on CI noise.
 */
const cliPath = path.join(process.cwd(), 'dist/index.js');

let tmp: string;
let probe: string;

function run(args: string[], extraEnv: Record<string, string> = {}) {
  const loadedFile = path.join(tmp, `loaded-${Math.random().toString(36).slice(2)}.json`);
  const started = process.hrtime.bigint();
  const res = spawnSync(process.execPath, ['-r', probe, cliPath, ...args], {
    encoding: 'utf8',
    cwd: tmp,
    env: { ...process.env, NO_COLOR: '1', RE_SHELL_PROBE_OUT: loadedFile, ...extraEnv },
  });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  let loaded: string[] = [];
  try {
    loaded = JSON.parse(fs.readFileSync(loadedFile, 'utf8'));
  } catch {
    /* probe output missing means the process died early; assertions will show it */
  }
  return { ...res, ms, loaded };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

describe('CLI startup (lazy command groups)', () => {
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-startup-'));
    probe = path.join(tmp, 'probe.js');
    // Records every module that gets loaded from the CLI's own dist/groups dir.
    fs.writeFileSync(
      probe,
      `const Module = require('module');
const seen = new Set();
const orig = Module._load;
Module._load = function (request, parent) {
  const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return request; } })();
  seen.add(resolved);
  return orig.apply(this, arguments);
};
process.on('exit', () => {
  require('fs').writeFileSync(process.env.RE_SHELL_PROBE_OUT, JSON.stringify([...seen]));
});
`
    );
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const groupModules = (loaded: string[]) =>
    loaded.filter(f => f.includes(`${path.sep}dist${path.sep}groups${path.sep}`)).map(f => path.basename(f));

  it('--version and --help import no command group', () => {
    for (const args of [['--version'], ['--help']]) {
      const r = run(args);
      expect(r.status).toBe(0);
      expect(groupModules(r.loaded)).toEqual([]);
    }
    const help = run(['--help']);
    // The stubs still render every group in the top-level help.
    for (const name of ['workspace', 'security', 'run', 'templates', 'plugin', 'service']) {
      expect(help.stdout).toMatch(new RegExp(`^\\s+${name}\\b`, 'm'));
    }
  });

  it('a group invocation loads only that group', () => {
    const r = run(['workspace', '--help']);
    expect(r.status).toBe(0);
    expect(groupModules(r.loaded)).toEqual(['workspace.group.js']);
    expect(r.stdout).toContain('Usage: re-shell workspace');
  });

  it('`help <group>` selects the group too', () => {
    const r = run(['help', 'run']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Usage: re-shell run [options] <task>');
    expect(groupModules(r.loaded)).toEqual(['run.group.js']);
  });

  it('`commands list --json` still describes the whole tree', () => {
    const r = run(['commands', 'list', '--json']);
    expect(r.status).toBe(0);
    const envelope = JSON.parse(r.stdout);
    const paths: string[] = envelope.data.map((e: { path: string }) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['workspace health', 'run', 'security audit verify']));
    expect(groupModules(r.loaded).length).toBeGreaterThan(20);
  });

  it('RE_SHELL_EAGER_COMMANDS=1 loads everything (escape hatch)', () => {
    const r = run(['--help'], { RE_SHELL_EAGER_COMMANDS: '1' });
    expect(r.status).toBe(0);
    expect(groupModules(r.loaded).length).toBeGreaterThan(20);
  });

  it('an unknown command still fails non-zero', () => {
    const r = run(['definitely-not-a-command']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/unknown command/i);
  });

  it('stays fast (generous thresholds)', () => {
    const versionMs: number[] = [];
    const helpMs: number[] = [];
    for (let i = 0; i < 5; i++) {
      versionMs.push(run(['--version']).ms);
      helpMs.push(run(['--help']).ms);
    }
    // Before lazy loading: --help took >1s on a quiet machine. These bounds are
    // several times looser than the measured values and only catch a regression.
    expect(median(versionMs)).toBeLessThan(1500);
    expect(median(helpMs)).toBeLessThan(2500);
  });
});
