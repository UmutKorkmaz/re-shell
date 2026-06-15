import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runBoundaries } from '../../src/commands/boundaries';
import { boundariesResponseSchema } from '@re-shell/contracts';

/**
 * Integration coverage for `re-shell boundaries` (issue #20). Filesystem access
 * is confined to temp dirs torn down after each test.
 */

function makeWorkspace(graph: Record<string, string[]>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-boundaries-'));
  const pkgDir = path.join(dir, 'packages');
  for (const [name, deps] of Object.entries(graph)) {
    const sub = path.join(pkgDir, name);
    fs.mkdirSync(sub, { recursive: true });
    const dependencies: Record<string, string> = {};
    for (const dep of deps) dependencies[dep] = 'workspace:*';
    fs.writeFileSync(
      path.join(sub, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', dependencies }),
      'utf8'
    );
  }
  return dir;
}

const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(graph: Record<string, string[]>): string {
  const d = makeWorkspace(graph);
  TEMP_DIRS.push(d);
  return d;
}

describe('runBoundaries', () => {
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

  it('passes when all imports respect the default rules', async () => {
    const dir = tmp({ shell: ['ui-kit', 'billing-domain'], 'ui-kit': [], 'billing-domain': [] });
    // Provide edges: shell → ui-kit (allowed), shell → billing-domain (allowed).
    await runBoundaries({
      json: true,
      cwd: dir,
      edges: [
        { from: 'shell', to: 'ui-kit' },
        { from: 'shell', to: 'billing-domain' },
      ],
    });
    const data = lastJson().data as { pass: boolean; violations: unknown[] };
    expect(data.pass).toBe(true);
    expect(data.violations).toHaveLength(0);
  });

  it('flags a domain→ui violation and exits non-zero', async () => {
    const dir = tmp({ 'billing-domain': [], 'ui-kit': [] });
    await runBoundaries({
      json: true,
      cwd: dir,
      edges: [{ from: 'billing-domain', to: 'ui-kit', file: 'src/x.ts' }],
    });
    const data = lastJson().data as { pass: boolean; disallowedCount: number; violations: Array<{ kind: string }> };
    expect(data.disallowedCount).toBe(1);
    expect(data.pass).toBe(false);
    expect(data.violations.some(v => v.kind === 'disallowed-import')).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('emits output that validates against boundariesResponseSchema', async () => {
    const dir = tmp({ shell: ['ui-kit'], 'ui-kit': [] });
    await runBoundaries({ json: true, cwd: dir, edges: [{ from: 'shell', to: 'ui-kit' }] });
    expect(boundariesResponseSchema.safeParse(lastJson().data).success).toBe(true);
  });

  it('honours an explicit --rules ruleset', async () => {
    const dir = tmp({ 'ui-a': [], 'ui-b': [] });
    const rulesPath = path.join(dir, 'rules.json');
    fs.writeFileSync(
      rulesPath,
      JSON.stringify([{ id: 'ui-no-ui', from: { layer: 'ui' }, disallow: { layer: 'ui' }, reason: 'x' }]),
      'utf8'
    );
    await runBoundaries({
      json: true,
      cwd: dir,
      rules: 'rules.json',
      edges: [{ from: 'ui-a', to: 'ui-b' }],
    });
    const data = lastJson().data as { rules: number; disallowedCount: number };
    expect(data.rules).toBe(1); // the custom ruleset, not the default
    expect(data.disallowedCount).toBe(1);
  });
});
