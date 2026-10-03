import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { jsonResponseSchema, runResponseSchema } from '@re-shell/contracts';

/**
 * `re-shell run` resource flags against the built CLI with real child
 * processes: --rate-limit paces real task starts, --max-memory applies memory
 * backpressure without deadlocking, and bad values fail explicitly.
 */
const CLI = path.resolve(process.cwd(), 'dist/index.js');
let ws: string;

function run(args: string[]) {
  const started = Date.now();
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ws,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', RE_SHELL_AUDIT: '0' },
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, ms: Date.now() - started };
}

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'run-res-cli-'));
  fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }));
  for (const name of ['p1', 'p2', 'p3', 'p4']) {
    const dir = path.join(ws, 'packages', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', scripts: { build: `node -e "require('fs').appendFileSync(process.env.RUN_LOG||'/dev/null','${name} '+Date.now()+'\\n')"` } })
    );
  }
});
afterEach(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

describe('re-shell run --rate-limit / --max-memory', () => {
  it('runs everything with no resource flags (baseline)', () => {
    const r = run(['run', 'build', '--no-cache', '--json']);
    expect(r.status).toBe(0);
    const parsed = jsonResponseSchema(runResponseSchema).parse(JSON.parse(r.stdout));
    expect(parsed.ok && parsed.data.results.filter(x => x.status === 'success')).toHaveLength(4);
  });

  it('--rate-limit paces real task starts', () => {
    // 4 tasks at 1 start/second with a burst of 1: the last task cannot start before ~3s.
    const r = run(['run', 'build', '--no-cache', '--concurrency', '8', '--rate-limit', '1', '--json']);
    expect(r.status).toBe(0);
    const parsed = jsonResponseSchema(runResponseSchema).parse(JSON.parse(r.stdout));
    expect(parsed.ok && parsed.data.results.every(x => x.status === 'success')).toBe(true);
    expect(r.ms).toBeGreaterThanOrEqual(2900);
  }, 60000);

  it('--max-memory with a tiny limit applies backpressure but never deadlocks', () => {
    const r = run(['run', 'build', '--no-cache', '--concurrency', '4', '--max-memory', '1', '--json']);
    expect(r.status).toBe(0);
    const parsed = jsonResponseSchema(runResponseSchema).parse(JSON.parse(r.stdout));
    expect(parsed.ok && parsed.data.results.filter(x => x.status === 'success')).toHaveLength(4);
  }, 60000);

  it('--max-memory with a generous limit changes nothing', () => {
    const r = run(['run', 'build', '--no-cache', '--max-memory', '65536', '--json']);
    expect(r.status).toBe(0);
  });

  it('rejects invalid resource flags with RUN_ERROR and a non-zero exit', () => {
    for (const args of [['--max-memory', 'lots'], ['--rate-limit', '0'], ['--rate-limit', '-3']]) {
      const r = run(['run', 'build', ...args, '--json']);
      expect(r.status).not.toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({ ok: false, error: { code: 'RUN_ERROR' } });
    }
  });

  it('human mode reports bad flags on stderr with a non-zero exit', () => {
    const r = run(['run', 'build', '--max-memory', 'lots']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/--max-memory/);
  });
});
