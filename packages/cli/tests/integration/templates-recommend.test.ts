import { beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  jsonResponseSchema,
  recommendResponseSchema,
} from '@re-shell/contracts';

const cliPath = path.join(process.cwd(), 'dist/index.js');

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run the built CLI with a deterministic, offline environment: colour disabled
 * and no embeddings/LLM provider configured, so the recommend default path is
 * exercised exactly as it ships.
 */
function runCli(args: string[], cwd: string): RunResult {
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '' };
  delete env.RE_SHELL_EMBEDDINGS;
  const res = spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env,
    timeout: 30000,
  });
  return {
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

describe('templates recommend --json (built CLI conformance)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Built CLI not found at ${cliPath}. Run the package build first.`);
    }
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recommend-cli-'));
  });

  it('emits an envelope that conforms to jsonResponseSchema(recommendResponseSchema)', () => {
    const { status, stdout } = runCli(
      ['templates', 'recommend', 'high-throughput async API with websockets', '--json', '--limit', '5'],
      tmpDir
    );
    expect(status).toBe(0);

    const parsed = jsonResponseSchema(recommendResponseSchema).safeParse(
      JSON.parse(stdout.trim())
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const env = parsed.data;
    expect(env.ok).toBe(true);
    expect(env.data?.query).toBe('high-throughput async API with websockets');
    expect(env.data?.limit).toBe(5);
    expect((env.data?.results.length ?? 0)).toBeGreaterThan(0);
    expect(env.data?.results.every(r => r.rationale.length > 0)).toBe(true);
  });

  it('surfaces real grpc templates with rationale for "grpc service"', () => {
    const { status, stdout } = runCli(
      ['templates', 'recommend', 'grpc service', '--json', '--limit', '6'],
      tmpDir
    );
    expect(status).toBe(0);

    const env = JSON.parse(stdout.trim()) as {
      ok: boolean;
      data?: { results: Array<{ id: string; rationale: string }> };
    };
    expect(env.ok).toBe(true);
    const ids = env.data?.results.map(r => r.id) ?? [];
    expect(ids).toContain('grpc-service');
    expect(env.data?.results.every(r => r.rationale.length > 0)).toBe(true);
  });

  it('honours --limit', () => {
    const { status, stdout } = runCli(
      ['templates', 'recommend', 'api', '--json', '--limit', '2'],
      tmpDir
    );
    expect(status).toBe(0);
    const env = JSON.parse(stdout.trim()) as {
      data?: { limit: number; results: unknown[] };
    };
    expect(env.data?.limit).toBe(2);
    expect((env.data?.results.length ?? 0)).toBeLessThanOrEqual(2);
  });

  it('returns ok with an empty result set (exit 0) for a stop-word-only query', () => {
    const { status, stdout } = runCli(
      ['templates', 'recommend', 'the a of', '--json'],
      tmpDir
    );
    expect(status).toBe(0);
    const env = JSON.parse(stdout.trim()) as {
      ok: boolean;
      data?: { results: unknown[] };
    };
    expect(env.ok).toBe(true);
    expect(env.data?.results).toEqual([]);
  });
});
