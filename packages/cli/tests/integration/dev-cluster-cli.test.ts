import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  devClusterResponseSchema,
} from '@re-shell/contracts';

/**
 * Integration conformance for `re-shell dev --cluster`, driving the BUILT CLI
 * (dist/index.js) inside a throwaway workspace. Everything here is OFFLINE and
 * deterministic — NO cluster, NO skaffold, NO network is ever touched:
 *
 *   - `--dry-run --json` emits the single-line envelope carrying the generated
 *     Skaffold config + plan and validates against the contract.
 *   - `--filter` scopes the generated artifacts/port-forwards to the named
 *     service(s); an unknown name is a hard DEV_CLUSTER_ERROR.
 *   - the missing-skaffold real-run path returns DEV_CLUSTER_ERROR with an
 *     actionable message (the test env may or may not have a cluster, so this
 *     case only runs when skaffold is genuinely absent).
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
    `rs-dc-${process.pid}-${Math.random().toString(36).slice(2)}.out`
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

/** Build a throwaway workspace v2 config with two services, web -> api. */
function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-dc-ws-'));
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
      '  web:',
      '    name: web',
      '    language: typescript',
      '    framework: react',
      '    path: services/web',
      '    port: 5173',
      '    dependsOn: [api]',
      '',
    ].join('\n')
  );
  return root;
}

describe('dev --cluster (built CLI): dry-run config + plan, --filter, errors', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  it('--dry-run --json emits a contract-valid config + plan without touching a cluster', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['dev', '--cluster', '--dry-run', '--json'],
        root
      );
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);

      const parsed = jsonResponseSchema(devClusterResponseSchema).safeParse(env);
      expect(
        parsed.success,
        JSON.stringify(
          (parsed as { error?: { issues?: unknown[] } }).error?.issues?.[0]
        )
      ).toBe(true);

      const data = (env as { data: z.infer<typeof devClusterResponseSchema> }).data;
      expect(data.plan.dryRun).toBe(true);
      expect(data.plan.services).toEqual(['api', 'web']);
      expect(data.config.kind).toBe('Config');
      expect(data.config.artifacts.map(a => a.service)).toEqual(['api', 'web']);
      // Each artifact carries inner-loop file-sync rules.
      expect(data.config.artifacts[0].sync.length).toBeGreaterThan(0);
      // Port-forwards are generated for local access.
      expect(data.config.portForwards.map(p => p.service)).toEqual(['api', 'web']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--filter scopes the generated config to the named service(s) AND their transitive dependencies', () => {
    // The fixture workspace has web -> api (web dependsOn api).
    // --filter web must expand to include api so the config is self-consistent:
    // web's Dockerfile may FROM the api image, so api must be in scope.
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['dev', '--cluster', '--dry-run', '--json', '--filter', 'web'],
        root
      );
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);
      const data = (env as { data: z.infer<typeof devClusterResponseSchema> }).data;

      // `affected` records the explicitly requested names (the raw --filter value).
      expect(data.plan.affected).toEqual(['web']);
      // `services` reflects the expanded set: web + its dependency api.
      expect(data.plan.services).toContain('web');
      expect(data.plan.services).toContain('api');
      // The generated config includes artifacts and port-forwards for both.
      expect(data.config.artifacts.map(a => a.service)).toContain('web');
      expect(data.config.artifacts.map(a => a.service)).toContain('api');
      expect(data.config.portForwards.map(p => p.service)).toContain('web');
      expect(data.config.portForwards.map(p => p.service)).toContain('api');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('an unknown --filter name exits non-zero with DEV_CLUSTER_ERROR', () => {
    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(
        ['dev', '--cluster', '--dry-run', '--json', '--filter', 'no-such-service'],
        root
      );
      expect(status).not.toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'DEV_CLUSTER_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a missing workspace config exits non-zero with DEV_CLUSTER_ERROR', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-dc-empty-'));
    try {
      const { stdout, status } = runCli(
        ['dev', '--cluster', '--dry-run', '--json'],
        root
      );
      expect(status).not.toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'DEV_CLUSTER_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('the real-run path errors with DEV_CLUSTER_ERROR when skaffold is absent', () => {
    // Only meaningful when skaffold is genuinely not installed in this env; the
    // test then asserts the actionable, cluster-free failure. When skaffold IS
    // present we skip rather than attempt to reach a (nonexistent) cluster.
    const skaffoldPresent = (() => {
      try {
        execFileSync('skaffold', ['version'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    })();
    if (skaffoldPresent) return;

    const root = makeWorkspace();
    try {
      const { stdout, status } = runCli(['dev', '--cluster', '--json'], root);
      expect(status).not.toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      const error = (env as { error: { code: string; message: string } }).error;
      expect(error.code).toBe('DEV_CLUSTER_ERROR');
      // Actionable: names skaffold and points at --dry-run.
      expect(error.message).toMatch(/skaffold/);
      expect(error.message).toMatch(/--dry-run/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
