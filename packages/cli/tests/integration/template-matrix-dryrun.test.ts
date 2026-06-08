import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

const cliPath = path.join(process.cwd(), 'dist/index.js');

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd: string): RunResult {
  const res = spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '' },
    timeout: 30000,
  });
  return {
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

interface MatrixEnvelope {
  ok: boolean;
  data?: {
    matrix: Array<{
      id: string;
      language: string;
      framework: string;
      databases: string[];
      caches: string[];
      deploymentTargets: string[];
      features: string[];
    }>;
    facets: {
      languages: string[];
      frameworks: string[];
      databases: string[];
      caches: string[];
      deploymentTargets: string[];
      features: string[];
    };
  };
  warnings: string[];
}

interface DryRunEnvelope {
  ok: boolean;
  data?: {
    project?: string;
    templateId: string;
    dryRun: boolean;
    files: Array<{ path: string; bytes: number; action: string }>;
    totalBytes: number;
  };
  error?: { code: string; message: string };
  warnings: string[];
}

describe('templates matrix + create dry-run (built CLI)', () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Built CLI not found at ${cliPath}. Run the package build first.`);
    }
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'matrix-cli-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('templates matrix --json returns the full grid with non-empty facets', () => {
    const { status, stdout } = runCli(['templates', 'matrix', '--json'], tmpDir);
    expect(status).toBe(0);

    const env = JSON.parse(stdout.trim()) as MatrixEnvelope;
    expect(env.ok).toBe(true);
    // Matrix length tracks the registry size (~205 backend frameworks).
    expect(env.data?.matrix.length ?? 0).toBeGreaterThan(150);

    const facets = env.data?.facets;
    expect(facets?.languages.length ?? 0).toBeGreaterThan(0);
    expect(facets?.frameworks.length ?? 0).toBeGreaterThan(0);
    expect(facets?.databases.length ?? 0).toBeGreaterThan(0);
    expect(facets?.caches.length ?? 0).toBeGreaterThan(0);
    expect(facets?.deploymentTargets.length ?? 0).toBeGreaterThan(0);
    expect(facets?.features.length ?? 0).toBeGreaterThan(0);

    const express = env.data?.matrix.find(r => r.id === 'express');
    expect(express?.framework).toBe('express');
  });

  it('create <name> --template express --dry-run --json lists files and writes NOTHING', () => {
    const { status, stdout } = runCli(
      ['create', 'my-svc', '--template', 'express', '--dry-run', '--json'],
      tmpDir
    );
    expect(status).toBe(0);

    const env = JSON.parse(stdout.trim()) as DryRunEnvelope;
    expect(env.ok).toBe(true);
    expect(env.data?.dryRun).toBe(true);
    expect(env.data?.templateId).toBe('express');
    expect((env.data?.files.length ?? 0)).toBeGreaterThan(0);
    expect(env.data?.files.every(f => f.action === 'create')).toBe(true);

    // Nothing was written: the target dir must not exist, and the cwd is clean.
    expect(fs.existsSync(path.join(tmpDir, 'my-svc'))).toBe(false);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it('templates apply <id> --dry-run --json previews the same file set', () => {
    const { status, stdout } = runCli(
      ['templates', 'apply', 'express', '--dry-run', '--json', '--name', 'my-svc'],
      tmpDir
    );
    expect(status).toBe(0);

    const env = JSON.parse(stdout.trim()) as DryRunEnvelope;
    expect(env.ok).toBe(true);
    expect(env.data?.dryRun).toBe(true);
    expect((env.data?.files.length ?? 0)).toBeGreaterThan(0);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it('templates apply <unknown> --json fails with a non-zero exit', () => {
    const { status, stdout } = runCli(
      ['templates', 'apply', 'nope-xyz', '--json'],
      tmpDir
    );
    expect(status).toBe(1);
    const env = JSON.parse(stdout.trim()) as DryRunEnvelope;
    expect(env.ok).toBe(false);
    expect(env.error?.code).toBe('TEMPLATE_NOT_FOUND');
  });
});
