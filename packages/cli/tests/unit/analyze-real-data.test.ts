import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runProjectAnalysis } from '../../src/commands/analyze';
import { findMonorepoRoot } from '../../src/utils/monorepo';
import { jsonSuccess } from '../../src/utils/json-output';

// The legacy per-workspace sections of `analyze` used to contain fabricated
// data (an estimated gzip size, a hard-coded license list, an empty secret
// scan, always-on recommendations, zeroed web-vitals). These tests pin the
// REAL replacements against files on disk.

vi.mock('../../src/utils/monorepo', () => ({ findMonorepoRoot: vi.fn() }));
vi.mock('child_process', () => ({ execSync: vi.fn(() => ''), spawnSync: vi.fn(() => ({ status: 128 })) }));
vi.mock('../../src/utils/json-output', () => ({
  jsonSuccess: vi.fn(),
  jsonError: vi.fn(),
  enableJsonMode: vi.fn(() => () => {}),
}));

let root: string;
const ws = () => path.join(root, 'apps', 'shell');

function write(rel: string, content: string | object): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
}

async function analyze(type: 'bundle' | 'dependencies' | 'performance' | 'security') {
  vi.mocked(jsonSuccess).mockClear();
  await runProjectAnalysis({ workspace: 'apps/shell', type, json: true });
  const payload = vi.mocked(jsonSuccess).mock.calls[0][0] as { analysis: Record<string, Record<string, any>> };
  return payload.analysis['apps/shell'];
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-real-'));
  vi.mocked(findMonorepoRoot).mockResolvedValue(root);
  write('package.json', { name: 'mono', private: true, workspaces: ['apps/*'] });
  write('apps/shell/package.json', {
    name: 'shell',
    version: '1.0.0',
    dependencies: { react: '^18.0.0', 'left-pad': '^1.3.0', missing: '^1.0.0' },
    devDependencies: { react: '^17.0.0' },
    scripts: { build: 'vite build' },
  });
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('analyze: replaced fake data is now real', () => {
  it('measures the real gzip size of build output instead of estimating 30%', async () => {
    write('apps/shell/dist/app.js', 'const a = 1;\n'.repeat(50_000)); // very compressible
    write('apps/shell/dist/noise.bin', crypto_random(20_000)); // incompressible
    const bundle = (await analyze('bundle')).bundle;
    const raw = bundle.size.assets.reduce((n: number, a: { rawBytes: number }) => n + a.rawBytes, 0);
    expect(raw).toBeGreaterThan(600_000);
    // the old estimate was floor(total * 0.3)
    expect(bundle.size.gzipped).not.toBe(formatLike(Math.floor(raw * 0.3)));
    expect(bundle.size.gzipped).toMatch(/KB|Bytes/);
    const gzippedKb = parseFloat(bundle.size.gzipped);
    expect(gzippedKb).toBeLessThan(60); // ~20KB of noise + a tiny compressed repeat, not 30% of 650KB
  });

  it('reads the license each installed dependency actually ships with', async () => {
    write('node_modules/react/package.json', { name: 'react', version: '18.2.0', license: 'MIT' });
    write('apps/shell/node_modules/left-pad/package.json', { name: 'left-pad', version: '1.3.0', licenses: [{ type: 'WTFPL' }] });
    const deps = (await analyze('dependencies')).dependencies;
    const lic = Object.fromEntries(deps.licenses.map((l: { license: string; packages: string[] }) => [l.license, l.packages]));
    expect(lic.MIT).toEqual(['react']);
    expect(lic.WTFPL).toEqual(['left-pad']);
    expect(lic['UNKNOWN (not installed)']).toEqual(['missing']);
    // the old implementation always returned MIT/Apache-2.0/BSD/ISC/GPL with empty package lists
    expect(Object.keys(lic)).not.toContain('Apache-2.0');
  });

  it('detects the same dependency declared at conflicting ranges in one package.json', async () => {
    const deps = (await analyze('dependencies')).dependencies;
    expect(deps.duplicates).toEqual([{ name: 'react', versions: ['^18.0.0', '^17.0.0'], locations: ['dependencies', 'devDependencies'] }]);
  });

  it('scans source files for credential-shaped values (masked), instead of returning an empty list', async () => {
    write('apps/shell/src/config.ts', 'export const key = "AKIAABCDEFGHIJKLMNOP";\n');
    write('apps/shell/src/clean.ts', 'export const x = 1;\n');
    const sec = (await analyze('security')).security;
    expect(sec.secretPatterns).toEqual(['src/config.ts:1 (AKIA********)']);
    expect(sec.recommendations).toContain('Use environment variables for sensitive data');
    expect(JSON.stringify(sec)).not.toContain('ABCDEFGHIJKLMNOP');
  });

  it('only recommends dependabot / audit-in-CI when they are not already configured', async () => {
    const before = (await analyze('security')).security.recommendations as string[];
    expect(before).toContain('Enable dependabot for automatic security updates');
    expect(before).toContain('Use npm audit in CI/CD pipeline');

    write('.github/dependabot.yml', 'version: 2\nupdates: []\n');
    write('.github/workflows/ci.yml', 'jobs:\n  audit:\n    steps:\n      - run: pnpm audit --prod\n');
    const after = (await analyze('security')).security.recommendations as string[];
    expect(after).not.toContain('Enable dependabot for automatic security updates');
    expect(after).not.toContain('Use npm audit in CI/CD pipeline');
  });

  it('suggests code splitting from the real byte count (the old check parsed "1.5 MB" with parseInt)', async () => {
    write('apps/shell/dist/big.js', 'x'.repeat(1_500_000));
    const perf = (await analyze('performance')).performance;
    expect(perf.bundleSize).toMatch(/1\.43 MB/);
    expect(perf.suggestions).toContain('Bundle size is large, consider code splitting');
  });

  it('no longer reports fabricated zero web-vitals', async () => {
    write('apps/shell/dist/index.js', 'x');
    const perf = (await analyze('performance')).performance;
    expect(perf).not.toHaveProperty('loadTime');
  });

  it('expands workspace globs instead of treating "apps/*" as a literal path', async () => {
    write('apps/second/package.json', { name: 'second', version: '1.0.0' });
    vi.mocked(jsonSuccess).mockClear();
    await runProjectAnalysis({ type: 'dependencies', json: true });
    const payload = vi.mocked(jsonSuccess).mock.calls[0][0] as { workspaces: number; analysis: Record<string, unknown> };
    expect(Object.keys(payload.analysis).sort()).toEqual(['apps/second', 'apps/shell']);
    expect(payload.workspaces).toBe(2);
  });

  it('rejects an unknown --type with an error instead of silently doing nothing', async () => {
    const { jsonError } = await import('../../src/utils/json-output');
    await runProjectAnalysis({ type: 'banana' as never, json: true });
    expect(jsonError).toHaveBeenCalledWith('ANALYZE_ERROR', expect.stringContaining('Unknown analysis type "banana"'));
    await expect(runProjectAnalysis({ type: 'banana' as never })).rejects.toThrow(/Unknown analysis type/);
  });
});

// --- helpers ---------------------------------------------------------------

function crypto_random(n: number): string {
  // deterministic pseudo-random printable noise (incompressible enough for the assertion)
  let x = 123456789;
  let out = '';
  for (let i = 0; i < n; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out += String.fromCharCode(33 + (x >>> 24) % 90);
  }
  return out;
}

function formatLike(bytes: number): string {
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
