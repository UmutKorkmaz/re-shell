import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { jsonResponseSchema, analysisReportSchema } from '@re-shell/contracts';

/**
 * `re-shell analyze --type architecture|scalability --json` against the built
 * CLI on a fixture workspace with known issues. (security/performance also run
 * the per-workspace npm audit/build probes, so they are covered by unit tests.)
 */
const CLI = path.resolve(process.cwd(), 'dist/index.js');
const roots: string[] = [];

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-cli-'));
  roots.push(root);
  const files: Record<string, unknown> = {
    'package.json': { name: 'mono', private: true, workspaces: ['apps/*', 'packages/*'] },
    'apps/web/package.json': { name: '@acme/web', version: '1.0.0', dependencies: { '@acme/ui': 'workspace:*' } },
    'apps/web/src/index.ts': 'export {};\n',
    'packages/ui/package.json': { name: '@acme/ui', version: '1.0.0', dependencies: { '@acme/web': 'workspace:*' } },
    'packages/ui/src/index.ts': 'export {};\n',
    'docker-compose.yml': 'services:\n  db:\n    image: postgres:16\n  api:\n    image: acme/api:1\n    depends_on: [db]\n  worker:\n    image: acme/worker:1\n    depends_on: [db]\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  }
  return root;
}

function run(root: string, args: string[]) {
  const res = spawnSync(process.execPath, [CLI, 'analyze', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', RE_SHELL_AUDIT: '0' },
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

afterEach(() => {
  for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

describe('re-shell analyze (architecture / scalability)', () => {
  it('--json emits a contract-valid report with findings, evidence and recommendations', () => {
    const root = fixture();
    const r = run(root, ['--type', 'architecture', '--json']);
    expect(r.status).toBe(0);
    const parsed = jsonResponseSchema(analysisReportSchema).parse(JSON.parse(r.stdout));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.types).toEqual(['architecture']);
    expect(parsed.data.graph).toMatchObject({ packages: 2, edges: 2 });
    const rules = parsed.data.findings.map(f => f.ruleId);
    expect(rules).toEqual(expect.arrayContaining(['arch.dependency-cycle', 'arch.layering-package-depends-on-app']));
    for (const f of parsed.data.findings) {
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.recommendation).toBeTruthy();
    }
    expect(parsed.data.summary.total).toBe(parsed.data.findings.length);
  });

  it('--type scalability analyzes the compose services', () => {
    const root = fixture();
    const r = run(root, ['--type', 'scalability', '--json']);
    const parsed = jsonResponseSchema(analysisReportSchema).parse(JSON.parse(r.stdout));
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.data.graph.services).toBe(3);
    const ids = parsed.data.findings.map(f => f.ruleId);
    expect(ids).toContain('scale.service-no-healthcheck');
    expect(ids).toContain('scale.single-point-of-failure');
  });

  it('human output lists findings with evidence and a recommendation', () => {
    const root = fixture();
    const r = run(root, ['--type', 'architecture']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Findings \(\d+\)/);
    expect(r.stdout).toMatch(/\[high\] Dependency cycle between 2 packages \(arch\.dependency-cycle\)/);
    expect(r.stdout).toMatch(/evidence: packages\/ui\/package\.json:\d+/);
    expect(r.stdout).toMatch(/-> Break the cycle/);
  });

  it('--fail-on gates the exit code on finding severity', () => {
    const root = fixture();
    expect(run(root, ['--type', 'architecture', '--json']).status).toBe(0);
    expect(run(root, ['--type', 'architecture', '--json', '--fail-on', 'high']).status).toBe(1);
    expect(run(root, ['--type', 'architecture', '--json', '--fail-on', 'critical']).status).toBe(0);
  });

  it('rejects unknown types and severities with a non-zero exit', () => {
    const root = fixture();
    const type = run(root, ['--type', 'banana', '--json']);
    expect(type.status).not.toBe(0);
    expect(JSON.parse(type.stdout)).toMatchObject({ ok: false, error: { code: 'ANALYZE_ERROR' } });
    const sev = run(root, ['--type', 'architecture', '--fail-on', 'severe', '--json']);
    expect(sev.status).not.toBe(0);
  });

  it('--output saves the same report to a file', () => {
    const root = fixture();
    const out = path.join(root, 'report.json');
    run(root, ['--type', 'architecture', '--json', '--output', out]);
    const saved = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(saved.findings.length).toBeGreaterThan(0);
    expect(analysisReportSchema.safeParse(saved).success).toBe(true);
  });
});
