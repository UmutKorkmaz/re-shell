import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runFederationCheck } from '../../src/commands/federation';
import { federationResponseSchema } from '@re-shell/contracts';

/**
 * Integration coverage for `re-shell federation check` (issue #15): manifest
 * discovery, shared-dep skew detection, baseline breaking-change diff, the
 * non-zero exit gate, and the FEDERATION_ERROR path. Filesystem access is
 * confined to temp dirs torn down after each test.
 */

/** A two-remote fixture where both share `react` at DIFFERENT versions. */
const SKEW_FIXTURE = {
  'apps/mf-a/federation-manifest.json': JSON.stringify({
    name: 'mf-a',
    exposes: { './Widget': './src/Widget' },
    shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0', singleton: true } },
  }),
  'apps/mf-b/federation-manifest.json': JSON.stringify({
    name: 'mf-b',
    exposes: { './Cart': './src/Cart' },
    shared: { react: { version: '18.2.0', requiredVersion: '^18.2.0', singleton: true } },
  }),
};

/** Create a temp dir, write files into it (relative paths), return the dir. */
function makeTempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-fed-cmd-'));
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  return dir;
}

const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmp(files: Record<string, string>): string {
  const d = makeTempDir(files);
  TEMP_DIRS.push(d);
  return d;
}

describe('runFederationCheck', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];

  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });

  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  describe('shared-dep skew detection', () => {
    it('reports react skew across two remotes and exits non-zero', async () => {
      const dir = tmp(SKEW_FIXTURE);
      await runFederationCheck({ json: true, cwd: dir });

      const env = lastJson();
      expect(env['ok']).toBe(true);
      const data = env['data'] as { pass: boolean; skewCount: number; breakingCount: number; findings: Array<{ kind: string; severity: string }> };
      expect(data.skewCount).toBe(1);
      expect(data.breakingCount).toBe(0);
      expect(data.pass).toBe(false);
      expect(data.findings.some(f => f.kind === 'shared-skew')).toBe(true);
      expect(process.exitCode).toBe(1);
    });

    it('passes when all remotes share the same resolved version', async () => {
      const dir = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          shared: { react: { version: '18.0.0' } },
        }),
        'apps/mf-b/federation-manifest.json': JSON.stringify({
          name: 'mf-b',
          shared: { react: { version: '18.0.0' } },
        }),
      });
      await runFederationCheck({ json: true, cwd: dir });

      const data = lastJson().data as { pass: boolean; skewCount: number };
      expect(data.skewCount).toBe(0);
      expect(data.pass).toBe(true);
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('baseline breaking-change diff', () => {
    it('flags a removed expose as breaking and exits non-zero', async () => {
      const current = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          exposes: { './A': { import: './src/A', types: './dist/A.d.ts' } },
          shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0' } },
        }),
      });
      const baselineDir = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          exposes: {
            './A': { import: './src/A', types: './dist/A.d.ts' },
            './B': { import: './src/B', types: './dist/B.d.ts' },
          },
          shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0' } },
        }),
      });

      await runFederationCheck({ json: true, cwd: current, baseline: baselineDir });

      const data = lastJson().data as { pass: boolean; breakingCount: number; findings: Array<{ kind: string }> };
      expect(data.hasBaseline).toBe(true);
      expect(data.breakingCount).toBeGreaterThanOrEqual(1);
      expect(data.findings.some(f => f.kind === 'expose-removed')).toBe(true);
      expect(data.pass).toBe(false);
      expect(process.exitCode).toBe(1);
    });

    it('flags a type change as a breaking type-narrowing', async () => {
      const current = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          exposes: { './A': { import: './src/A', types: './dist/A-v2.d.ts' } },
          shared: { react: { version: '18.0.0' } },
        }),
      });
      const baselineDir = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          exposes: { './A': { import: './src/A', types: './dist/A.d.ts' } },
          shared: { react: { version: '18.0.0' } },
        }),
      });

      await runFederationCheck({ json: true, cwd: current, baseline: baselineDir });

      const data = lastJson().data as { breakingCount: number; findings: Array<{ kind: string }> };
      expect(data.findings.some(f => f.kind === 'type-narrowed')).toBe(true);
      expect(data.breakingCount).toBeGreaterThanOrEqual(1);
    });

    it('passes when a new expose is added (non-breaking)', async () => {
      const current = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          exposes: {
            './A': { import: './src/A', types: './dist/A.d.ts' },
            './B': { import: './src/B', types: './dist/B.d.ts' },
          },
          shared: { react: { version: '18.0.0' } },
        }),
      });
      const baselineDir = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          exposes: { './A': { import: './src/A', types: './dist/A.d.ts' } },
          shared: { react: { version: '18.0.0' } },
        }),
      });

      await runFederationCheck({ json: true, cwd: current, baseline: baselineDir });

      const data = lastJson().data as { pass: boolean; breakingCount: number };
      expect(data.breakingCount).toBe(0);
      expect(data.pass).toBe(true);
    });
  });

  describe('schema + error conformance', () => {
    it('emits output that validates against federationResponseSchema', async () => {
      const dir = tmp(SKEW_FIXTURE);
      await runFederationCheck({ json: true, cwd: dir });
      expect(federationResponseSchema.safeParse(lastJson().data).success).toBe(true);
    });

    it('surfaces FEDERATION_ERROR when no manifests are found', async () => {
      const dir = tmp({ 'README.md': 'no manifests\n' });
      await runFederationCheck({ json: true, cwd: dir });

      const env = lastJson();
      expect(env['ok']).toBe(false);
      const error = env['error'] as { code: string; message: string };
      expect(error.code).toBe('FEDERATION_ERROR');
      expect(error.message).toMatch(/No federation manifests found/);
    });

    it('honours explicit --manifest paths', async () => {
      const dir = tmp({
        'apps/mf-a/federation-manifest.json': JSON.stringify({
          name: 'mf-a',
          shared: { react: { version: '18.0.0' } },
        }),
        'apps/mf-b/federation-manifest.json': JSON.stringify({
          name: 'mf-b',
          shared: { react: { version: '18.2.0' } },
        }),
      });
      // Pass only mf-a explicitly → no skew (only one remote).
      await runFederationCheck({
        json: true,
        cwd: dir,
        manifests: ['apps/mf-a/federation-manifest.json'],
      });
      const data = lastJson().data as { pass: boolean; remotes: unknown[] };
      expect(data.remotes).toHaveLength(1);
      expect(data.pass).toBe(true);
    });

    it('pairs each surviving remote with its CORRECT manifest path after a skipped manifest', async () => {
      const dir = tmp({
        // mf-a's manifest is malformed JSON → skipped; mf-b is valid.
        'apps/mf-a/federation-manifest.json': '{ this is not valid json',
        'apps/mf-b/federation-manifest.json': JSON.stringify({
          name: 'mf-b',
          shared: { react: { version: '18.0.0' } },
        }),
      });
      await runFederationCheck({ json: true, cwd: dir });
      const data = lastJson().data as { remotes: Array<{ name: string; manifest: string }> };
      // mf-b must be paired with mf-b's manifest, NOT mf-a's (the skipped one).
      const mfB = data.remotes.find(r => r.name === 'mf-b');
      expect(mfB).toBeDefined();
      expect(mfB!.manifest).toBe('apps/mf-b/federation-manifest.json');
    });
  });
});
