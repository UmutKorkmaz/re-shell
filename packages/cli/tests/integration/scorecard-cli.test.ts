import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  scorecardResponseSchema,
} from '@re-shell/contracts';

/**
 * Integration conformance for `re-shell scorecard`, driving the BUILT CLI
 * (dist/index.js) inside a throwaway workspace. Everything here is OFFLINE and
 * deterministic — NO network, NO cluster is touched.
 *
 *   - `scorecard --json` emits the single-line envelope carrying per-service
 *     grades + the monorepo rollup and validates against the contract.
 *   - a high `--threshold` still emits ok:true (advisory grades) AND exits
 *     non-zero so CI can gate on readiness.
 *   - `--service <name>` filters the report to one service.
 *   - a missing workspace config is a hard SCORECARD_ERROR.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 16 * 1024 * 1024;

interface RunResult {
  stdout: string;
  status: number;
}

/** Spawn the built CLI in `cwd`, capturing stdout via a temp file (no pipe). */
function runCli(args: string[], cwd: string): RunResult {
  const outFile = path.join(
    os.tmpdir(),
    `rs-sc-${process.pid}-${Math.random().toString(36).slice(2)}.out`
  );
  const fd = fs.openSync(outFile, 'w');
  let status = 0;
  try {
    execFileSync('node', [CLI_PATH, ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', fd, 'ignore'],
    });
  } catch (error: unknown) {
    const e = error as { status?: number };
    status = typeof e.status === 'number' ? e.status : 1;
  } finally {
    fs.closeSync(fd);
  }
  const stdout = fs.readFileSync(outFile, 'utf8');
  fs.rmSync(outFile, { force: true });
  return { stdout, status };
}

/** Assert stdout is exactly one JSON line and return the parsed envelope. */
function parseSingleLine(stdout: string): Record<string, unknown> {
  const lines = stdout.split('\n').filter(line => line.length > 0);
  expect(
    lines.length,
    `expected exactly one stdout line, got ${lines.length}: ${stdout}`
  ).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

/**
 * Build a throwaway workspace v2 config with two services:
 *   - `api`  has build + test scripts and a health endpoint  → high grade
 *   - `web`  has neither build nor test scripts               → lower grade
 */
function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-sc-ws-'));
  fs.writeFileSync(
    path.join(root, 're-shell.workspaces.yaml'),
    [
      'name: fixture',
      'version: 2.0.0',
      'services:',
      '  api:',
      '    name: api',
      '    language: typescript',
      '    framework: express',
      '    path: services/api',
      '    port: 3000',
      '    scripts:',
      '      build: tsc',
      '      test: vitest run',
      '  web:',
      '    name: web',
      '    language: typescript',
      '    framework: react',
      '    path: services/web',
      '    port: 5173',
      '',
    ].join('\n')
  );
  return root;
}

describe('scorecard (built CLI): grades + rollup, gate exit, --service, errors', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  it('--json (satisfied threshold) emits a contract-valid envelope and exits 0', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['scorecard', '--json', '--threshold', '1'],
        root
      );
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);

      const parsed = jsonResponseSchema(scorecardResponseSchema).safeParse(env);
      expect(
        parsed.success,
        JSON.stringify(
          (parsed as { error?: { issues?: unknown[] } }).error?.issues?.[0]
        )
      ).toBe(true);

      const data = (env as { data: z.infer<typeof scorecardResponseSchema> }).data;
      expect(data.services.map(s => s.service).sort()).toEqual(['api', 'web']);
      expect(data.pass).toBe(true);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(data.grade);
      // api (build+test+endpoint) should out-grade web (no build/test).
      const api = data.services.find(s => s.service === 'api');
      const web = data.services.find(s => s.service === 'web');
      expect((api?.totalScore ?? 0) > (web?.totalScore ?? 0)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--threshold 99 exits non-zero BUT still emits an ok:true payload (advisory gate)', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['scorecard', '--json', '--threshold', '99'],
        root
      );
      // Gate failure → exit code 1.
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      // …but the full grades are still emitted as a success envelope.
      expect(env.ok).toBe(true);

      const parsed = jsonResponseSchema(scorecardResponseSchema).safeParse(env);
      expect(parsed.success).toBe(true);

      const data = (env as { data: z.infer<typeof scorecardResponseSchema> }).data;
      expect(data.pass).toBe(false);
      expect(data.threshold).toBe(99);
      expect(data.warnings.some(w => /below the threshold/.test(w))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--service scopes the report to a single named service', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['scorecard', '--json', '--threshold', '1', '--service', 'api'],
        root
      );
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);
      const data = (env as { data: z.infer<typeof scorecardResponseSchema> }).data;
      expect(data.services.map(s => s.service)).toEqual(['api']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a missing workspace config exits non-zero with SCORECARD_ERROR', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-sc-empty-'));
    try {
      const { stdout, status } = runCli(['scorecard', '--json'], root);
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'SCORECARD_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('human-mode below threshold still exits 1 (CI gate without --json)', () => {
    const root = makeWorkspace();
    try {
      const { status } = runCli(['scorecard', '--threshold', '99'], root);
      expect(status).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('an out-of-range --threshold is a SCORECARD_ERROR', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['scorecard', '--json', '--threshold', '150'],
        root
      );
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'SCORECARD_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a non-numeric --threshold is a SCORECARD_ERROR', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['scorecard', '--json', '--threshold', 'abc'],
        root
      );
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'SCORECARD_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('an unknown --service is a SCORECARD_ERROR', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['scorecard', '--json', '--threshold', '1', '--service', 'nope'],
        root
      );
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'SCORECARD_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
