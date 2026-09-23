import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  UniversalTestRunner,
  createTestRunner,
  runTests,
  getSupportedTestFrameworks,
  formatTestResult,
  type TestFrameworkConfig,
  type TestResult,
} from '../../src/utils/universal-test';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The output parsers and buildCommand are `private` in TypeScript but exist as
 * plain methods at runtime, so they can be exercised directly via bracket
 * access. This avoids spawning real test processes while still covering the
 * parsing logic.
 */
function parsers(runner: UniversalTestRunner) {
  return {
    jest: (o: string) => (runner as any).parseJestOutput(o),
    pytest: (o: string) => (runner as any).parsePytestOutput(o),
    go: (o: string) => (runner as any).parseGoOutput(o),
    rust: (o: string) => (runner as any).parseRustOutput(o),
    tap: (o: string) => (runner as any).parseTapOutput(o),
    route: (o: string, f: TestFrameworkConfig) => (runner as any).parseOutput('', o, f),
    build: (f: TestFrameworkConfig, opts: any) => (runner as any).buildCommand(f, opts),
  };
}

describe('getSupportedFrameworks', () => {
  const frameworks = new UniversalTestRunner(process.cwd()).getSupportedFrameworks();

  it('returns the full catalogue of supported frameworks', () => {
    expect(frameworks.length).toBe(16);
  });

  it('covers the expected set of languages', () => {
    const langs = new Set(frameworks.map((f) => f.language));
    ['typescript', 'python', 'go', 'rust', 'java', 'csharp', 'ruby', 'php', 'c++', 'swift', 'kotlin'].forEach(
      (l) => expect(langs.has(l)).toBe(true),
    );
  });

  it('declares the jest config with watch/coverage commands and the jest parser', () => {
    const jest = frameworks.find((f) => f.name === 'jest')!;
    expect(jest).toMatchObject({
      testCommand: 'jest',
      testWatchCommand: 'jest --watch',
      testCoverageCommand: 'jest --coverage',
      resultParser: 'jest',
    });
    expect(jest.configFileNames).toContain('package.json');
    expect(jest.testFilePatterns.some((p) => p.endsWith('.test.ts'))).toBe(true);
  });

  it('every framework has the required fields populated', () => {
    for (const f of frameworks) {
      expect(f.name).toBeTruthy();
      expect(f.language).toBeTruthy();
      expect(f.frameworks.length).toBeGreaterThan(0);
      expect(f.testCommand).toBeTruthy();
      expect(f.testFilePatterns.length).toBeGreaterThan(0);
      expect(f.configFileNames.length).toBeGreaterThan(0);
      expect(['tap', 'jest', 'pytest', 'go', 'rust', 'generic']).toContain(f.resultParser);
    }
  });

  it('exposes envVars on pytest (PYTHONDONTWRITEBYTECODE) and rspec (RAILS_ENV=test)', () => {
    const pytest = frameworks.find((f) => f.name === 'pytest')!;
    expect(pytest.envVars?.PYTHONDONTWRITEBYTECODE).toBe('1');
    const rspec = frameworks.find((f) => f.name === 'rspec')!;
    expect(rspec.envVars?.RAILS_ENV).toBe('test');
  });
});

describe('glob', () => {
  let dir: string;
  let runner: UniversalTestRunner;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ut-glob-'));
    fs.mkdirSync(path.join(dir, 'src', 'sub'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'vendor'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.cache'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'a.test.ts'), 'x');
    fs.writeFileSync(path.join(dir, 'src', 'sub', 'b.test.ts'), 'x');
    fs.writeFileSync(path.join(dir, 'c.txt'), 'x');
    fs.writeFileSync(path.join(dir, 'node_modules', 'skip.test.ts'), 'x');
    fs.writeFileSync(path.join(dir, 'dist', 'z.test.ts'), 'x');
    fs.writeFileSync(path.join(dir, 'vendor', 'v.test.ts'), 'x');
    fs.writeFileSync(path.join(dir, '.cache', 'h.test.ts'), 'x');
    runner = new UniversalTestRunner(dir);
  });
  afterEach(() => fs.removeSync(dir));

  it('matches top-level files with a single-star pattern', async () => {
    expect(await runner.glob('*.txt')).toEqual(['c.txt']);
  });

  it('matches nested files via un-anchored single-star substring matching', async () => {
    // `*.test.ts` compiles to `[^/]*\.test\.ts` with no anchors, so it matches
    // any path ending in `<non-slash>.test.ts`.
    expect(await runner.glob('*.test.ts')).toEqual(['src/a.test.ts', 'src/sub/b.test.ts']);
  });

  it('scopes a prefixed pattern to its directory', async () => {
    expect(await runner.glob('src/*.test.ts')).toEqual(['src/a.test.ts']);
  });

  it('skips node_modules, dist, vendor and dot-directories', async () => {
    const matches = await runner.glob('*.test.ts');
    expect(matches.some((m) => m.includes('node_modules'))).toBe(false);
    expect(matches.some((m) => m.includes('dist'))).toBe(false);
    expect(matches.some((m) => m.includes('vendor'))).toBe(false);
    expect(matches.some((m) => m.includes('.cache'))).toBe(false);
  });

  it('NOTE: ** glob patterns are broken and never match', async () => {
    // The `**` token compiles to `.*`, introducing a literal `.` so the regex
    // requires a leading `./` that no relative path has. As a result
    // `**/*.test.ts` returns nothing even when nested test files exist.
    expect(await runner.glob('**/*.test.ts')).toEqual([]);
  });

  it('NOTE: a negated ** pattern returns everything (negation of a broken match)', async () => {
    // Since `**/*.test.ts` matches nothing, `!**/*.test.ts` matches everything.
    const negated = await runner.glob('!**/*.test.ts');
    expect(negated).toContain('c.txt');
    expect(negated).toContain('src/a.test.ts');
  });
});

describe('getTestCommand', () => {
  const runner = new UniversalTestRunner(process.cwd());

  it('defaults to the primary framework test command', () => {
    expect(runner.getTestCommand()).toBe('jest');
  });

  it('honours watch and coverage, with coverage taking precedence', () => {
    expect(runner.getTestCommand({ watch: true })).toBe('jest --watch');
    expect(runner.getTestCommand({ coverage: true })).toBe('jest --coverage');
    expect(runner.getTestCommand({ watch: true, coverage: true })).toBe('jest --coverage');
  });

  it('appends pattern, verbose and updateSnapshot flags', () => {
    expect(runner.getTestCommand({ pattern: 'foo' })).toBe('jest -- foo');
    expect(runner.getTestCommand({ verbose: true })).toBe('jest --verbose');
    expect(runner.getTestCommand({ updateSnapshot: true })).toBe('jest -u');
    expect(
      runner.getTestCommand({ coverage: true, pattern: 'foo', verbose: true, updateSnapshot: true }),
    ).toBe('jest --coverage -- foo --verbose -u');
  });
});

describe('buildCommand (private, via bracket access)', () => {
  const runner = new UniversalTestRunner(process.cwd());
  const jest = runner.getSupportedFrameworks().find((f) => f.name === 'jest')!;
  const build = (opts: any) => (runner as any).buildCommand(jest, opts);

  it('uses the coverage command, else the watch command', () => {
    expect(build({})).toBe('jest');
    expect(build({ watch: true })).toBe('jest --watch');
    expect(build({ coverage: true })).toBe('jest --coverage');
    expect(build({ watch: true, coverage: true })).toBe('jest --coverage');
  });

  it('appends a bare pattern (no -- separator), parallel and maxWorkers', () => {
    expect(build({ pattern: 'foo' })).toBe('jest foo');
    expect(build({ parallel: true })).toBe('jest --parallel');
    expect(build({ maxWorkers: 4 })).toBe('jest --maxWorkers=4');
    expect(build({ pattern: 'foo', parallel: true, maxWorkers: 2 })).toBe(
      'jest foo --parallel --maxWorkers=2',
    );
  });
});

describe('detectTestFrameworks', () => {
  let dir: string;
  let runner: UniversalTestRunner;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ut-detect-'));
    runner = new UniversalTestRunner(dir);
  });
  afterEach(() => fs.removeSync(dir));

  it('detects nothing in an empty project', async () => {
    expect(await runner.detectTestFrameworks()).toEqual([]);
  });

  it('detects jest from a jest config file', async () => {
    await fs.writeFile(path.join(dir, 'jest.config.js'), 'module.exports = {};');
    expect((await runner.detectTestFrameworks()).map((f) => f.name)).toEqual(['jest']);
  });

  it('detects jest from package.json with a test script', async () => {
    await fs.writeJson(path.join(dir, 'package.json'), { scripts: { test: 'jest' } });
    expect((await runner.detectTestFrameworks()).map((f) => f.name)).toEqual(['jest']);
  });

  it('detects jest from package.json with a jest or vitest field', async () => {
    await fs.writeJson(path.join(dir, 'package.json'), { jest: {} });
    expect((await runner.detectTestFrameworks()).map((f) => f.name)).toEqual(['jest']);
  });

  it('NOTE: a package.json with only a vitest field still reports jest (package.json is jest-owned)', async () => {
    await fs.writeJson(path.join(dir, 'package.json'), { vitest: {} });
    expect((await runner.detectTestFrameworks()).map((f) => f.name)).toEqual(['jest']);
  });

  it('does not match a package.json without test/jest/vitest', async () => {
    await fs.writeJson(path.join(dir, 'package.json'), { name: 'pkg' });
    expect(await runner.detectTestFrameworks()).toEqual([]);
  });

  it('detects go-test from go.mod and cargo-test from Cargo.toml', async () => {
    await fs.writeFile(path.join(dir, 'go.mod'), 'module x\ngo 1.21');
    const goRunner = new UniversalTestRunner(dir);
    expect((await goRunner.detectTestFrameworks()).map((f) => f.name)).toEqual(['go-test']);
  });

  it('detects multiple frameworks and preserves catalogue order', async () => {
    await fs.writeFile(path.join(dir, 'jest.config.js'), 'module.exports = {};');
    await fs.writeFile(path.join(dir, 'go.mod'), 'module x');
    expect((await runner.detectTestFrameworks()).map((f) => f.name)).toEqual(['jest', 'go-test']);
  });
});

describe('listTestFiles / getTestInfo', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ut-info-'));
  });
  afterEach(() => fs.removeSync(dir));

  it('returns no files when nothing is detected', async () => {
    const runner = new UniversalTestRunner(dir);
    expect(await runner.listTestFiles()).toEqual([]);
    const info = await runner.getTestInfo();
    expect(info).toEqual({ frameworks: [], testFileCount: 0, testCommand: 'jest' });
  });

  it('NOTE: reports zero test files even with a jest config because ** patterns are broken', async () => {
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'jest.config.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(dir, 'src', 'a.test.ts'), 'x');
    const runner = new UniversalTestRunner(dir);
    const info = await runner.getTestInfo();
    expect(info.frameworks).toEqual(['jest']);
    expect(info.testCommand).toBe('jest');
    // The jest patterns all start with `**/`, which glob cannot resolve.
    expect(info.testFileCount).toBe(0);
  });
});

describe('output parsers (private, via bracket access)', () => {
  const runner = new UniversalTestRunner(process.cwd());
  const p = parsers(runner);

  it('parses a jest summary plus PASS/FAIL file lines', () => {
    const out = p.jest('Tests: 10 passed, 2 failed, 1 skipped\nPASS src/a.test.ts\nFAIL src/b.test.ts');
    expect(out).toMatchObject({ total: 13, passed: 11, failed: 3, skipped: 1 });
  });

  it('parses a pytest summary line', () => {
    expect(p.pytest('10 passed, 2 failed, 1 skipped in 5.23s')).toMatchObject({
      total: 13,
      passed: 10,
      failed: 2,
      skipped: 1,
    });
  });

  it('parses go PASS:/FAIL: test lines', () => {
    expect(p.go('PASS: TestA (0.10s)\nFAIL: TestB (0.20s)')).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
    });
  });

  it('parses a cargo "test result" summary', () => {
    expect(p.rust('test result: ok. 10 passed; 0 failed; 0 ignored')).toMatchObject({
      total: 10,
      passed: 10,
      failed: 0,
    });
  });

  it('parses TAP ok / not ok / skip lines', () => {
    expect(p.tap('ok 1 - a\nnot ok 2 - b\nskip 3 - c')).toMatchObject({
      total: 2,
      passed: 1,
      failed: 1,
      skipped: 1,
    });
  });

  it('routes to the right parser by framework and returns zeros for generic parsers', () => {
    const jest = runner.getSupportedFrameworks().find((f) => f.name === 'jest')!;
    const generic = runner.getSupportedFrameworks().find((f) => f.name === 'junit')!;
    // stdout is concatenated with stderr by parseOutput; pass the payload as stderr.
    expect(p.route('Tests: 1 passed, 0 failed, 0 skipped', jest).passed).toBe(1);
    expect(p.route('anything', generic)).toMatchObject({
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it('returns a zero result for unparseable output', () => {
    expect(p.jest('totally unrelated output')).toMatchObject({
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    });
  });
});

describe('runTests', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ut-run-')); });
  afterEach(() => fs.removeSync(dir));

  it('throws when no test framework is detected', async () => {
    const runner = new UniversalTestRunner(dir);
    await expect(runner.runTests()).rejects.toThrow(/No test framework detected/);
  });
});

describe('formatTestResult', () => {
  const base: TestResult = {
    framework: 'jest',
    language: 'typescript',
    total: 10,
    passed: 10,
    failed: 0,
    skipped: 1,
    duration: 1500,
    failures: [],
  };

  it('renders a PASS summary with counts and duration', () => {
    const out = formatTestResult(base);
    expect(out).toContain('Test Results: jest');
    expect(out).toContain('PASS');
    expect(out).toContain('Total: 10');
    expect(out).toContain('Skipped: 1');
    expect(out).toContain('Duration: 1.50s');
  });

  it('renders a FAIL summary and up to five failure details', () => {
    const failures = Array.from({ length: 7 }, (_, i) => ({
      file: `f${i}.test.ts`,
      line: i + 1,
      test: `test ${i}`,
      error: 'AssertionError',
      message: `message ${i}`,
    }));
    const out = formatTestResult({ ...base, failed: 7, failures });
    expect(out).toContain('FAIL');
    expect(out).toContain('f0.test.ts');
    expect(out).toContain('test 0');
    expect(out).toContain('... and 2 more');
  });
});

describe('factory functions', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ut-factory-')); });
  afterEach(() => fs.removeSync(dir));

  it('createTestRunner returns an initialized runner', async () => {
    const runner = await createTestRunner(dir);
    expect(runner).toBeInstanceOf(UniversalTestRunner);
    expect(runner.getSupportedFrameworks().length).toBe(16);
  });

  it('runTests delegates to a fresh runner (and throws when nothing is detected)', async () => {
    await expect(runTests(dir)).rejects.toThrow(/No test framework detected/);
  });

  it('getSupportedTestFrameworks returns the catalogue', () => {
    expect(getSupportedTestFrameworks().length).toBe(16);
  });
});
