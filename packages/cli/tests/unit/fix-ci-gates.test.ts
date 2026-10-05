import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fixCiGateKindSchema, fixCiGateResultSchema } from '@re-shell/contracts';
import { GATE_KINDS, detectGates, detectPackageManager, resolveFixCiConfig } from '../../src/fix-ci/config';
import { evaluateGates, failureCount, isRegression, runGate } from '../../src/fix-ci/gates';
import {
  parseEslint,
  parseGateFailures,
  parseJest,
  parseTsc,
  parseVitest,
} from '../../src/fix-ci/parsers';
import { FixCiError, type GateDefinition } from '../../src/fix-ci/types';
import { createFixture, type Fixture } from '../utils/fix-ci-fixture';

const ctx = (kind: 'typecheck' | 'test' | 'lint' | 'build' | 'custom', root = '/ws') => ({
  gate: kind,
  kind,
  root,
});

describe('output parsers', () => {
  it('parses plain tsc diagnostics with continuation lines', () => {
    const out = [
      "src/index.ts(3,36): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.",
      '  Type mismatch detail',
      "src/a.ts(10,5): error TS2322: Type 'x' is not assignable to type 'y'.",
      "error TS6053: File 'nope.ts' not found.",
    ].join('\n');
    const entries = parseTsc(out, ctx('typecheck'));
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ file: 'src/index.ts', line: 3, column: 36, code: 'TS2345' });
    expect(entries[0].message).toContain('Type mismatch detail');
    expect(entries[2]).toMatchObject({ code: 'TS6053' });
    expect(entries[2].file).toBeUndefined();
  });

  it('parses pretty tsc diagnostics and absolutises paths inside the root', () => {
    const out = "\u001b[96m/ws/src/a.ts\u001b[0m:4:7 - \u001b[91merror\u001b[0m\u001b[90m TS2304: \u001b[0mCannot find name 'foo'.";
    const [e] = parseTsc(out, ctx('typecheck'));
    expect(e).toMatchObject({ file: 'src/a.ts', line: 4, column: 7, code: 'TS2304' });
  });

  it('parses vitest failure summaries with locations', () => {
    const out = [
      ' FAIL  tests/add.test.ts > add > adds',
      'AssertionError: expected 4 to be 3 // Object.is equality',
      '',
      '- Expected',
      '+ Received',
      '',
      ' ❯ tests/add.test.ts:6:21',
      '      4|   it(\'adds\', () => {',
      '',
      ' FAIL  tests/add.test.ts > add > adds',
      'AssertionError: expected 4 to be 3 // Object.is equality',
    ].join('\n');
    const entries = parseVitest(out, ctx('test'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ file: 'tests/add.test.ts', line: 6, column: 21 });
    expect(entries[0].message).toContain('add > adds');
    expect(entries[0].message).toContain('expected 4 to be 3');
  });

  it('parses jest failure summaries', () => {
    const out = [
      'FAIL tests/sum.test.js',
      '  ● sum › adds numbers',
      '',
      '    expect(received).toBe(expected) // Object.is equality',
      '',
      '    Expected: 3',
      '    Received: 4',
      '',
      '      at Object.<anonymous> (tests/sum.test.js:5:20)',
    ].join('\n');
    const [e] = parseJest(out, ctx('test'));
    expect(e).toMatchObject({ file: 'tests/sum.test.js', line: 5, column: 20 });
    expect(e.message).toContain('sum › adds numbers');
  });

  it('parses eslint JSON (errors only) and stylish output', () => {
    const json = JSON.stringify([
      {
        filePath: '/ws/src/a.ts',
        messages: [
          { ruleId: 'no-unused-vars', severity: 2, message: "'x' is unused", line: 3, column: 7 },
          { ruleId: 'semi', severity: 1, message: 'warn only', line: 4, column: 1 },
        ],
      },
    ]);
    const entries = parseEslint(`some banner\n${json}`, ctx('lint'));
    expect(entries).toEqual([
      { gate: 'lint', file: 'src/a.ts', line: 3, column: 7, code: 'no-unused-vars', message: "'x' is unused" },
    ]);
    const stylish = '/ws/src/b.ts\n  2:5  error  Missing semicolon  semi\n  9:1  warning  nope  quotes\n\n✖ 2 problems';
    const rows = parseEslint(stylish, ctx('lint'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ file: 'src/b.ts', line: 2, column: 5, code: 'semi' });
  });

  it('never returns an empty list for a failed gate', () => {
    const entries = parseGateFailures('something exploded\nbadly', ctx('custom'));
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toContain('something exploded');
  });
});

describe('gate detection and configuration', () => {
  it('keeps the local gate-kind list in sync with the contracts schema', () => {
    expect([...GATE_KINDS].sort()).toEqual([...fixCiGateKindSchema.options].sort());
  });

  let fx: Fixture | undefined;
  afterEach(() => fx?.cleanup());

  it('detects the package manager and gates from package.json scripts', () => {
    fx = createFixture({
      'package.json': JSON.stringify({
        name: 'x',
        packageManager: 'pnpm@9.0.0',
        scripts: { typecheck: 'tsc --noEmit', test: 'vitest run', lint: 'eslint src', build: 'tsc', dev: 'x' },
      }),
    });
    expect(detectPackageManager(fx.dir, { packageManager: 'pnpm@9.0.0' })).toBe('pnpm');
    const gates = detectGates(fx.dir);
    expect(gates.map(g => g.name)).toEqual(['typecheck', 'test', 'lint', 'build']);
    expect(gates[0]).toMatchObject({ command: ['pnpm', 'run', 'typecheck'], locked: true, parser: 'tsc' });
    expect(gates[1]).toMatchObject({ locked: true, parser: 'vitest' });
    expect(gates[2]).toMatchObject({ locked: false, parser: 'eslint' });
  });

  it('falls back to lockfiles and npm, and ignores the npm placeholder test script', () => {
    fx = createFixture({
      'package.json': JSON.stringify({
        name: 'x',
        scripts: { test: 'echo "Error: no test specified" && exit 1', lint: 'eslint .' },
      }),
      'yarn.lock': '',
    });
    expect(detectPackageManager(fx.dir)).toBe('yarn');
    expect(detectGates(fx.dir).map(g => g.name)).toEqual(['lint']);
    // ...which leaves the workspace without a test gate: refused explicitly.
    expect(() => resolveFixCiConfig(fx!.dir)).toThrowError(/No test gate/);
  });

  it('loads gate overrides from .re-shell/fix-ci.yaml', () => {
    fx = createFixture({
      '.re-shell/fix-ci.yaml': [
        'gates:',
        '  - name: typecheck',
        '    command: [node, node_modules/typescript/bin/tsc, --noEmit]',
        '    timeoutMs: 1234',
        '  - name: docs',
        '    command: [node, -e, "process.exit(0)"]',
        '    locked: true',
        'protectedPaths: ["src/generated/**"]',
        'limits: { maxFiles: 3 }',
      ].join('\n'),
    });
    const cfg = resolveFixCiConfig(fx.dir);
    expect(cfg.source).toBe('.re-shell/fix-ci.yaml');
    const tc = cfg.gates.find(g => g.name === 'typecheck')!;
    expect(tc.command[0]).toBe('node');
    expect(tc.timeoutMs).toBe(1234);
    expect(tc.parser).toBe('tsc');
    expect(cfg.gates.find(g => g.name === 'docs')).toMatchObject({ kind: 'custom', locked: true });
    expect(cfg.protectedPaths).toEqual(['src/generated/**']);
    expect(cfg.limits.maxFiles).toBe(3);
  });

  it('reads the fixCi section of re-shell.workspaces.yaml', () => {
    fx = createFixture({
      're-shell.workspaces.yaml': 'name: ws\nversion: 2.0.0\nfixCi:\n  skip: [lint]\n  gates:\n    - name: lint\n      command: [node, -e, "0"]\n',
    });
    const cfg = resolveFixCiConfig(fx.dir);
    expect(cfg.source).toBe('re-shell.workspaces.yaml#fixCi');
    expect(cfg.gates.map(g => g.name)).toEqual(['typecheck', 'test']);
  });

  it('forces tests locked, and refuses to skip locked gates', () => {
    fx = createFixture({
      '.re-shell/fix-ci.yaml': 'gates:\n  - name: test\n    command: [node, -e, "0"]\n    locked: false\n',
    });
    const cfg = resolveFixCiConfig(fx.dir);
    expect(cfg.gates.find(g => g.name === 'test')!.locked).toBe(true);
    expect(cfg.warnings.join('\n')).toMatch(/always locked/);
    for (const skip of ['test', 'typecheck']) {
      try {
        resolveFixCiConfig(fx.dir, { skipGates: [skip] });
        throw new Error('expected a throw');
      } catch (err) {
        expect(err).toBeInstanceOf(FixCiError);
        expect((err as FixCiError).code).toBe('FIX_CI_CONFIG_INVALID');
        expect((err as Error).message).toMatch(/locked and cannot be skipped/);
      }
    }
  });

  it('rejects shell-string commands and malformed config', () => {
    fx = createFixture({ '.re-shell/fix-ci.yaml': 'gates:\n  - name: x\n    command: "npm test"\n' });
    expect(() => resolveFixCiConfig(fx!.dir)).toThrowError(/argv array/);
    fs.writeFileSync(path.join(fx.dir, '.re-shell/fix-ci.yaml'), 'gates: [');
    expect(() => resolveFixCiConfig(fx!.dir)).toThrowError(/invalid YAML/);
  });
});

describe('real gate evaluator (real tsc + vitest)', () => {
  let fx: Fixture | undefined;
  afterEach(() => fx?.cleanup());

  it('runs npm-run gates for real and parses the tsc failure with file/line', async () => {
    fx = createFixture();
    const gates = resolveFixCiConfig(fx.dir).gates;
    expect(gates.map(g => g.command.join(' '))).toEqual(['npm run typecheck', 'npm run test']);
    const results = await evaluateGates(gates, fx.dir);
    for (const r of results) expect(fixCiGateResultSchema.safeParse(r).success).toBe(true);

    const typecheck = results.find(r => r.name === 'typecheck')!;
    expect(typecheck.passed).toBe(false);
    expect(typecheck.exitCode).not.toBe(0);
    expect(typecheck.failing).toHaveLength(1);
    expect(typecheck.failing[0]).toMatchObject({
      gate: 'typecheck',
      file: 'src/index.ts',
      line: 3,
      code: 'TS2345',
    });
    expect(results.find(r => r.name === 'test')!.passed).toBe(true);
  }, 120_000);

  it('parses a real vitest failure into file/line/message', async () => {
    fx = createFixture({
      'src/add.ts': 'export function add(a: number, b: number): number {\n  return a - b;\n}\n',
      'src/index.ts': 'export const total = 1;\n',
    });
    const gates = resolveFixCiConfig(fx.dir).gates;
    const test = await runGate(gates.find(g => g.name === 'test')!, fx.dir);
    expect(test.passed).toBe(false);
    expect(test.locked).toBe(true);
    const entry = test.failing[0];
    expect(entry.file).toBe('tests/add.test.ts');
    expect(entry.line).toBe(6);
    expect(entry.message).toMatch(/add > adds/);
    expect(entry.message).toMatch(/expected -1 to be 3/);
  }, 120_000);

  it('reports a timeout and a missing binary as failures, never as a skip', async () => {
    fx = createFixture();
    const slow: GateDefinition = {
      name: 'slow',
      kind: 'custom',
      command: [process.execPath, '-e', 'setTimeout(() => {}, 30000)'],
      locked: false,
      timeoutMs: 300,
    };
    const timed = await runGate(slow, fx.dir);
    expect(timed.passed).toBe(false);
    expect(timed.timedOut).toBe(true);
    expect(timed.failing[0].message).toMatch(/timed out/);

    const missing = await runGate(
      { name: 'ghost', kind: 'custom', command: ['definitely-not-a-binary-xyz'], locked: false, timeoutMs: 5000 },
      fx.dir
    );
    expect(missing.passed).toBe(false);
    expect(missing.exitCode).toBeNull();
    expect(missing.failing[0].message).toMatch(/could not run/);
  });

  it('does not interpret shell metacharacters in argv', async () => {
    fx = createFixture();
    const marker = path.join(fx.dir, 'pwned');
    const res = await runGate(
      {
        name: 'inj',
        kind: 'custom',
        command: [process.execPath, '-e', 'process.exit(process.argv[1] === process.argv[process.argv.length - 1] && process.argv[1].startsWith(";") ? 0 : 1)', `; touch ${marker}`],
        locked: false,
        timeoutMs: 10000,
      },
      fx.dir
    );
    expect(res.passed).toBe(true);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('scores regressions: a newly failing gate or more failures is worse', () => {
    const r = (name: string, passed: boolean, n = 1) => ({
      name,
      kind: 'custom' as const,
      locked: false,
      command: [name],
      passed,
      exitCode: passed ? 0 : 1,
      timedOut: false,
      durationMs: 1,
      failing: passed ? [] : Array.from({ length: n }, () => ({ gate: name, message: 'x' })),
    });
    expect(failureCount([r('a', false, 3), r('b', true)])).toBe(3);
    expect(isRegression([r('a', false, 3), r('b', true)], [r('a', false, 2), r('b', true)])).toBe(false);
    expect(isRegression([r('a', false, 1), r('b', true)], [r('a', true), r('b', false, 1)])).toBe(true);
    expect(isRegression([r('a', false, 1)], [r('a', false, 2)])).toBe(true);
  });
});
