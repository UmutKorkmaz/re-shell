import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Integration tests for `re-shell policy list|validate|check`.
 *
 * Drives the BUILT CLI (dist/index.js) inside the fixture workspace at
 * `tests/fixtures/policy-workspace`. Everything is OFFLINE and deterministic.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const FIXTURE_DIR = path.resolve(process.cwd(), 'tests/fixtures/policy-workspace');
const MAX_BUFFER = 16 * 1024 * 1024;

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn the built CLI in `cwd`, capturing stdout via a temp file (avoids pipe
 * buffer limits). The policy check command may exit non-zero when the gate
 * fails, so we swallow the execFileSync error and read the captured output.
 */
function runCli(args: string[], cwd: string): RunResult {
  const outFile = path.join(
    os.tmpdir(),
    `rs-policy-${process.pid}-${Math.random().toString(36).slice(2)}.out`
  );
  const errFile = path.join(
    os.tmpdir(),
    `rs-policy-err-${process.pid}-${Math.random().toString(36).slice(2)}.out`
  );
  const outFd = fs.openSync(outFile, 'w');
  const errFd = fs.openSync(errFile, 'w');
  let exitCode = 0;

  try {
    execFileSync('node', [CLI_PATH, ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', outFd, errFd],
      timeout: 30000,
    });
  } catch (e: any) {
    exitCode = typeof e.status === 'number' ? e.status : 1;
  } finally {
    fs.closeSync(outFd);
    fs.closeSync(errFd);
  }

  const stdout = fs.readFileSync(outFile, 'utf8');
  const stderr = fs.readFileSync(errFile, 'utf8');
  fs.rmSync(outFile, { force: true });
  fs.rmSync(errFile, { force: true });
  return { stdout, stderr, exitCode };
}

/** Parse the single JSON envelope from stdout. */
function parseJson(stdout: string): Record<string, any> {
  const lines = stdout.split('\n').filter(line => line.length > 0);
  expect(
    lines.length,
    `expected exactly one stdout line, got ${lines.length}: ${stdout}`
  ).toBe(1);
  return JSON.parse(lines[0]) as Record<string, any>;
}

describe('policy CLI (integration)', () => {
  it('policy list shows built-in packs', () => {
    const result = runCli(['policy', 'list', '--json'], FIXTURE_DIR);
    const parsed = parseJson(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.builtin.length).toBeGreaterThan(0);
    const names = parsed.data.builtin.map((b: any) => b.name);
    expect(names).toContain('recommended');
    expect(names).toContain('baseline');
  });

  it('policy validate accepts the fixture pack', () => {
    const result = runCli(
      ['policy', 'validate', '.reshell-policy.yaml', '--json'],
      FIXTURE_DIR
    );
    const parsed = parseJson(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.valid).toBe(true);
    expect(parsed.data.ruleCount).toBe(8);
  });

  it('policy check evaluates service-level rules', () => {
    const result = runCli(
      ['policy', 'check', '--pack', '.reshell-policy.yaml', '--json'],
      FIXTURE_DIR
    );
    const parsed = parseJson(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.serviceResults.length).toBeGreaterThan(0);

    // api-gateway should pass most rules
    const apiResults = parsed.data.serviceResults.filter(
      (r: any) => r.serviceName === 'api-gateway'
    );
    expect(apiResults.length).toBeGreaterThan(0);
    const apiPassed = apiResults.filter((r: any) => r.passed);
    expect(apiPassed.length).toBe(apiResults.length);

    // worker should have failures (no healthcheck, no resources) — but waived
    const waivedItems = parsed.data.waived;
    expect(waivedItems.length).toBeGreaterThan(0);
    const workerWaived = waivedItems.filter((w: any) => w.service === 'worker');
    expect(workerWaived.length).toBeGreaterThan(0);
  });

  it('policy check honors --service filter', () => {
    const result = runCli(
      [
        'policy', 'check',
        '--pack', '.reshell-policy.yaml',
        '--service', 'frontend',
        '--json',
      ],
      FIXTURE_DIR
    );
    const parsed = parseJson(result.stdout);
    const services = [
      ...new Set(parsed.data.serviceResults.map((r: any) => r.serviceName)),
    ];
    expect(services).toEqual(['frontend']);
  });
});
