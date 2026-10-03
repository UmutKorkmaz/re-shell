import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// @ts-expect-error plain .mjs module without type declarations
import { evaluateBudgets, globToRegExp, gzipBytes } from '../../../scripts/perf-budget.mjs';

const script = resolve(__dirname, '../../../scripts/perf-budget.mjs');

describe('globToRegExp', () => {
  it('supports *, **, ? and {a,b}', () => {
    expect(globToRegExp('assets/index-*.js').test('assets/index-abc123.js')).toBe(true);
    expect(globToRegExp('assets/index-*.js').test('assets/sub/index-abc.js')).toBe(false);
    expect(globToRegExp('**/*.js').test('a/b/c.js')).toBe(true);
    expect(globToRegExp('a?.js').test('ab.js')).toBe(true);
    const braces = globToRegExp('assets/{index,vendor-react}-*.js');
    expect(braces.test('assets/index-x.js')).toBe(true);
    expect(braces.test('assets/vendor-react-x.js')).toBe(true);
    expect(braces.test('assets/vendor-query-x.js')).toBe(false);
    // regex metacharacters in a glob are literal
    expect(globToRegExp('a.b').test('aXb')).toBe(false);
  });
});

describe('evaluateBudgets', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'perf-budget-'));
    mkdirSync(join(dir, 'assets'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  // Random bytes do not compress, so the gzip size is predictable (~ the input size).
  const blob = (bytes: number): Buffer => randomBytes(bytes);

  it('passes when every budget is met and measures GZIP, not raw size', () => {
    writeFileSync(join(dir, 'assets/index-a.js'), 'x'.repeat(100_000)); // compresses to a few hundred bytes
    const { rows, failures } = evaluateBudgets({ budgets: [{ name: 'entry', match: 'assets/index-*.js', maxGzipBytes: 2000 }] }, dir);
    expect(failures).toEqual([]);
    expect(rows[0]).toMatchObject({ name: 'entry', status: 'ok' });
    expect(rows[0].size).toBe(gzipBytes(Buffer.from('x'.repeat(100_000))));
    expect(rows[0].size).toBeLessThan(1000);
  });

  it('fails a SUM budget that is exceeded and says by how much', () => {
    writeFileSync(join(dir, 'assets/a.js'), blob(3000));
    writeFileSync(join(dir, 'assets/b.js'), blob(3000));
    const { failures } = evaluateBudgets({ budgets: [{ name: 'all JS', match: 'assets/*.js', maxGzipBytes: 4000 }] }, dir);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/all JS: 2 file\(s\) total .* gzip, budget 3\.9 kB \(\+/);
  });

  it('"each" checks every file separately and names the offender', () => {
    writeFileSync(join(dir, 'assets/small.js'), blob(500));
    writeFileSync(join(dir, 'assets/huge.js'), blob(6000));
    const { failures } = evaluateBudgets({ budgets: [{ name: 'chunk', match: 'assets/*.js', each: true, maxGzipBytes: 2000 }] }, dir);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('assets/huge.js');
  });

  it('"exclude" leaves matching files out so they can carry their own explicit budget', () => {
    writeFileSync(join(dir, 'assets/small.js'), blob(500));
    writeFileSync(join(dir, 'assets/feature-big.js'), blob(6000));
    const { failures } = evaluateBudgets(
      {
        budgets: [
          { name: 'chunk', match: 'assets/*.js', exclude: 'assets/feature-*.js', each: true, maxGzipBytes: 2000 },
          { name: 'feature', match: 'assets/feature-*.js', each: true, maxGzipBytes: 8000 },
        ],
      },
      dir
    );
    expect(failures).toEqual([]);
    const tight = evaluateBudgets({ budgets: [{ name: 'feature', match: 'assets/feature-*.js', each: true, maxGzipBytes: 2000 }] }, dir);
    expect(tight.failures).toHaveLength(1);
  });

  it('a glob that matches nothing is a failure (a renamed chunk cannot drop out of enforcement)', () => {
    const { failures, rows } = evaluateBudgets({ budgets: [{ name: 'entry', match: 'assets/index-*.js', maxGzipBytes: 1 }] }, dir);
    expect(failures[0]).toMatch(/matched no files/);
    expect(rows[0].status).toBe('MISSING');
    // ... unless it is explicitly optional
    expect(evaluateBudgets({ budgets: [{ name: 'entry', match: 'assets/index-*.js', maxGzipBytes: 1, optional: true }] }, dir).failures).toEqual([]);
  });
});

describe('perf-budget CLI exit codes (what CI sees)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'perf-budget-cli-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist/app.js'), randomBytes(4000));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function run(maxGzipBytes: number) {
    writeFileSync(join(dir, 'budgets.json'), JSON.stringify({ root: 'dist', budgets: [{ name: 'app', match: '*.js', maxGzipBytes }] }));
    return spawnSync(process.execPath, [script, '--config', join(dir, 'budgets.json')], { encoding: 'utf8' });
  }

  it('exits 0 within budget and 1 over budget', () => {
    const ok = run(10_000);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('all budgets met');
    const over = run(1_000);
    expect(over.status).toBe(1);
    expect(over.stderr).toMatch(/1 budget\(s\) FAILED[\s\S]*app: 1 file\(s\) total/);
  });

  it('exits 1 when the build output is missing and 2 without --config', () => {
    rmSync(join(dir, 'dist'), { recursive: true });
    expect(run(1_000_000).status).toBe(1);
    expect(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status).toBe(2);
  });
});
