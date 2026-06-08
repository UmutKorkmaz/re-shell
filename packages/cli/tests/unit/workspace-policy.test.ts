import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import {
  evaluatePolicyPack,
  resolvePolicyPack,
  loadPolicyPack,
  BUILTIN_PACKS,
} from '../../src/utils/policy-engine';
import { detectDependencyDrift } from '../../src/utils/dependency-drift';
import { runPolicyCheck, runDriftCheck } from '../../src/commands/workspace-policy';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

/** Copy a fixture into a throwaway tmp dir so tests never mutate the repo. */
async function inTmp(fixture: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `policy-${fixture}-`));
  await fs.copy(path.join(FIXTURES, fixture), tmpDir);
  return tmpDir;
}

/**
 * Capture exactly the single JSON envelope written to stdout while running an
 * async function that calls `ok()`/`fail()` (which patch stdout internally).
 */
async function captureEnvelope<T = unknown>(fn: () => Promise<void>): Promise<T> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  // enableJsonMode re-patches stdout on top of this spy; the gated emit still
  // routes through whatever process.stdout.write is at emit time, so spying
  // first captures the final bytes.
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stdout.write);
  try {
    await fn();
  } finally {
    spy.mockRestore();
    void original;
  }
  const joined = chunks.join('');
  return JSON.parse(joined.trim()) as T;
}

describe('policy-engine: built-in packs', () => {
  it('exposes recommended and baseline packs', () => {
    expect(Object.keys(BUILTIN_PACKS).sort()).toEqual(['baseline', 'recommended']);
  });

  it('resolvePolicyPack defaults to recommended', async () => {
    const pack = await resolvePolicyPack();
    expect(pack.name).toBe('recommended');
  });

  it('resolvePolicyPack resolves a built-in by name', async () => {
    const pack = await resolvePolicyPack('baseline');
    expect(pack.name).toBe('baseline');
  });
});

describe('policy-engine: evaluatePolicyPack', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('a compliant workspace scores high with no error failures', async () => {
    tmpDir = await inTmp('policy-compliant');
    const result = await evaluatePolicyPack(BUILTIN_PACKS.recommended, tmpDir);
    expect(result.hasErrors).toBe(false);
    expect(result.score).toBe(100);
    expect(result.failed).toEqual([]);
  });

  it('a violating workspace (missing required script) yields a failed error rule and lower score', async () => {
    tmpDir = await inTmp('policy-violating');
    const result = await evaluatePolicyPack(BUILTIN_PACKS.recommended, tmpDir);
    expect(result.hasErrors).toBe(true);
    expect(result.score).toBeLessThan(100);
    const testFailure = result.failed.find(
      f => f.ruleId === 'required-scripts-build-test' && f.target === '@acme/violating-a'
    );
    expect(testFailure).toBeDefined();
    expect(testFailure?.severity).toBe('error');
    expect(testFailure?.message).toContain('test');
  });

  it('loads and evaluates a YAML pack from disk', async () => {
    tmpDir = await inTmp('policy-violating');
    const pack = await loadPolicyPack(path.join(tmpDir, 'strict-pack.yaml'));
    expect(pack.name).toBe('strict-test');
    const result = await evaluatePolicyPack(pack, tmpDir);
    expect(result.pack).toBe('strict-test');
    expect(result.hasErrors).toBe(true);
  });

  it('throws on a missing pack file', async () => {
    await expect(loadPolicyPack('/nonexistent/pack.yaml')).rejects.toThrow(
      /not found/
    );
  });
});

describe('dependency-drift: detectDependencyDrift', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('reports a dependency pinned to different versions across packages', async () => {
    tmpDir = await inTmp('drift-monorepo');
    const result = await detectDependencyDrift(tmpDir);
    const react = result.drift.find(d => d.dependency === 'react');
    expect(react).toBeDefined();
    expect(react?.versions.map(v => v.version).sort()).toEqual(['^17.0.2', '^18.2.0']);
    const v17 = react?.versions.find(v => v.version === '^17.0.2');
    expect(v17?.packages).toEqual(['@acme/drift-b']);
    // lodash is aligned, so it must not appear as drift.
    expect(result.drift.find(d => d.dependency === 'lodash')).toBeUndefined();
  });

  it('returns empty drift for a clean monorepo', async () => {
    tmpDir = await inTmp('clean-monorepo');
    const result = await detectDependencyDrift(tmpDir);
    expect(result.drift).toEqual([]);
  });
});

describe('command layer: envelopes + exit codes', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('policy check --json on compliant emits ok envelope and exit 0', async () => {
    tmpDir = await inTmp('policy-compliant');
    const env = await captureEnvelope<{
      ok: boolean;
      data: { score: number; failed: unknown[] };
    }>(() => runPolicyCheck({ json: true, cwd: tmpDir }));
    expect(env.ok).toBe(true);
    expect(env.data.score).toBe(100);
    expect(env.data.failed).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it('policy check --json on violating emits ok envelope with failures and exit 1', async () => {
    tmpDir = await inTmp('policy-violating');
    const env = await captureEnvelope<{
      ok: boolean;
      data: { score: number; failed: Array<{ severity: string }> };
    }>(() => runPolicyCheck({ json: true, cwd: tmpDir }));
    expect(env.ok).toBe(true);
    expect(env.data.failed.some(f => f.severity === 'error')).toBe(true);
    expect(env.data.score).toBeLessThan(100);
    expect(process.exitCode).toBe(1);
  });

  it('drift --json on drift fixture emits ok envelope with drift entries', async () => {
    tmpDir = await inTmp('drift-monorepo');
    const env = await captureEnvelope<{
      ok: boolean;
      data: { drift: Array<{ dependency: string }> };
    }>(() => runDriftCheck({ json: true, cwd: tmpDir }));
    expect(env.ok).toBe(true);
    expect(env.data.drift.some(d => d.dependency === 'react')).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('drift --json on clean fixture emits ok envelope with empty drift', async () => {
    tmpDir = await inTmp('clean-monorepo');
    const env = await captureEnvelope<{ ok: boolean; data: { drift: unknown[] } }>(
      () => runDriftCheck({ json: true, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(env.data.drift).toEqual([]);
    expect(process.exitCode).toBe(0);
  });
});
