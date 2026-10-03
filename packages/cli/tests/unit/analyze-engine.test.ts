import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { analyzeWorkspace, buildModel } from '../../src/analyze';
import { analysisFindingSchema } from '@re-shell/contracts';

/**
 * Fixture workspaces with KNOWN issues. Every assertion is about evidence the
 * files contain (rule id, file:line, graph path), never about templated text.
 */
const roots: string[] = [];

type Files = Record<string, string | object>;

function workspace(files: Files, rootPkg: object = { name: 'root', private: true, workspaces: ['apps/*', 'packages/*', 'services/*'] }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-engine-'));
  roots.push(root);
  const all: Files = { 'package.json': rootPkg, ...files };
  for (const [rel, content] of Object.entries(all)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  }
  return root;
}

const pkg = (name: string, deps: Record<string, string> = {}, extra: object = {}) => ({
  name,
  version: '1.0.0',
  dependencies: deps,
  ...extra,
});

afterEach(() => {
  for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

const byRule = (r: ReturnType<typeof analyzeWorkspace>, rule: string) => r.findings.filter(f => f.ruleId === rule);

describe('workspace model', () => {
  it('expands workspace globs, builds the dependency graph, and records the dependency line', () => {
    const root = workspace({
      'apps/web/package.json': pkg('@acme/web', { '@acme/ui': 'workspace:*', react: '^18.0.0' }),
      'packages/ui/package.json': pkg('@acme/ui'),
      'packages/ignored/readme.md': '# no package.json here',
    });
    const model = buildModel(root);
    expect(model.packages.map(p => p.name).sort()).toEqual(['@acme/ui', '@acme/web']);
    expect(model.packages.find(p => p.name === '@acme/web')!.kind).toBe('app');
    expect(model.edges).toEqual([
      expect.objectContaining({ from: '@acme/web', to: '@acme/ui', section: 'dependencies', file: 'apps/web/package.json', line: 5 }),
    ]);
    expect(model.dependents.get('@acme/ui')).toEqual(['@acme/web']);
  });

  it('supports pnpm-workspace.yaml and conventional directories when no workspaces field exists', () => {
    const root = workspace(
      {
        'pnpm-workspace.yaml': 'packages:\n  - "tools/*"\n',
        'tools/a/package.json': pkg('a'),
        'packages/not-listed/package.json': pkg('b'),
      },
      { name: 'root', private: true }
    );
    expect(buildModel(root).packages.map(p => p.name)).toEqual(['a']);
  });
});

describe('architecture', () => {
  function layered() {
    return workspace({
      'apps/web/package.json': pkg('@acme/web', { '@acme/admin': 'workspace:*', '@acme/core': 'workspace:*' }),
      'apps/web/src/index.ts': 'export const web = 1;\n',
      'apps/web/src/index.test.ts': 'test("x", () => {});\n',
      'apps/admin/package.json': pkg('@acme/admin', { '@acme/ui': 'workspace:*', '@acme/core': 'workspace:*' }),
      'apps/admin/src/index.ts': 'export const admin = 1;\n',
      'apps/admin/src/index.test.ts': 'test("x", () => {});\n',
      'packages/ui/package.json': pkg('@acme/ui', { '@acme/web': 'workspace:*', '@acme/core': 'workspace:*' }),
      'packages/ui/src/index.ts': 'export const ui = 1;\n',
      'packages/ui/src/index.test.ts': 'test("x", () => {});\n',
      'packages/core/package.json': pkg('@acme/core', {}, { scripts: { test: 'vitest run' } }),
      'packages/core/src/index.ts': 'export const core = 1;\n',
      'packages/utils/package.json': pkg('@acme/utils', { '@acme/core': 'workspace:*' }),
      'packages/utils/src/a.ts': 'export const a = 1;\n',
      'packages/utils/src/b.ts': 'export const b = 1;\n',
    });
  }

  it('detects a dependency cycle with a concrete path and the declaring lines', () => {
    const r = analyzeWorkspace(layered(), { types: ['architecture'] });
    const cycles = byRule(r, 'arch.dependency-cycle');
    expect(cycles).toHaveLength(1);
    const c = cycles[0];
    expect(c.severity).toBe('high');
    const graph = c.evidence.find(e => e.kind === 'graph')!;
    expect(graph.path![0]).toBe(graph.path![graph.path!.length - 1]); // closes on itself
    expect(new Set(graph.path)).toEqual(new Set(['@acme/web', '@acme/admin', '@acme/ui']));
    const fileEvidence = c.evidence.filter(e => e.kind === 'file');
    expect(fileEvidence.length).toBe(3);
    for (const e of fileEvidence) expect(e.line).toBeGreaterThan(0);
    expect(c.recommendation).toMatch(/Break the cycle/);
  });

  it('reports layering violations: app -> app and package -> app', () => {
    const r = analyzeWorkspace(layered(), { types: ['architecture'] });
    const appApp = byRule(r, 'arch.layering-app-depends-on-app');
    expect(appApp.map(f => f.id)).toEqual(['arch.layering-app-depends-on-app:@acme/web->@acme/admin']);
    expect(appApp[0].evidence[0]).toMatchObject({ file: 'apps/web/package.json', line: 5 });
    const pkgApp = byRule(r, 'arch.layering-package-depends-on-app');
    expect(pkgApp.map(f => f.id)).toEqual(['arch.layering-package-depends-on-app:@acme/ui->@acme/web']);
    expect(pkgApp[0].severity).toBe('high');
  });

  it('flags fan-in hotspots with the dependents as graph evidence', () => {
    const r = analyzeWorkspace(layered(), { types: ['architecture'] });
    const hot = byRule(r, 'arch.fan-in-hotspot');
    expect(hot).toHaveLength(1);
    expect(hot[0].id).toBe('arch.fan-in-hotspot:@acme/core');
    expect(hot[0].evidence[0].path).toEqual(['@acme/admin', '@acme/ui', '@acme/utils', '@acme/web', '@acme/core']);
    expect(hot[0].message).toMatch(/4 of 4/);
  });

  it('flags fan-out hotspots', () => {
    const deps: Record<string, string> = {};
    const files: Files = {};
    for (let i = 1; i <= 9; i++) {
      files[`packages/p${i}/package.json`] = pkg(`p${i}`);
      deps[`p${i}`] = 'workspace:*';
    }
    files['apps/big/package.json'] = pkg('big', deps);
    const r = analyzeWorkspace(workspace(files), { types: ['architecture'] });
    const f = byRule(r, 'arch.fan-out-hotspot');
    expect(f).toHaveLength(1);
    expect(f[0].id).toBe('arch.fan-out-hotspot:big');
    expect(f[0].message).toMatch(/9 internal packages/);
  });

  it('finds packages without tests, but not ones with test files or a real test script', () => {
    const r = analyzeWorkspace(layered(), { types: ['architecture'] });
    const missing = byRule(r, 'arch.missing-tests').map(f => f.id.split(':')[1]);
    expect(missing).toEqual(['@acme/utils']); // core has a test script; ui/web/admin have test files
    const f = byRule(r, 'arch.missing-tests')[0];
    expect(f.evidence[0]).toMatchObject({ file: 'packages/utils/package.json' });
    expect(f.evidence[1].file).toBe('packages/utils/src/a.ts');
  });

  it('treats the npm placeholder test script as no test', () => {
    const r = analyzeWorkspace(
      workspace({
        'packages/x/package.json': pkg('x', {}, { scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
        'packages/x/src/index.ts': 'export {};\n',
      }),
      { types: ['architecture'] }
    );
    expect(byRule(r, 'arch.missing-tests')).toHaveLength(1);
  });

  it('a clean, layered, tested workspace has no architecture findings', () => {
    const r = analyzeWorkspace(
      workspace({
        'apps/web/package.json': pkg('web', { ui: 'workspace:*' }, { scripts: { test: 'vitest' } }),
        'apps/web/src/main.ts': 'export {};\n',
        'packages/ui/package.json': pkg('ui', {}, { scripts: { test: 'vitest' } }),
        'packages/ui/src/index.ts': 'export {};\n',
      }),
      { types: ['architecture'] }
    );
    expect(r.findings).toEqual([]);
    expect(r.summary.total).toBe(0);
  });
});

describe('security', () => {
  it('finds secrets in env files, never prints the value, and notes gitignore status', () => {
    const root = workspace({
      'apps/api/package.json': pkg('api'),
      'apps/api/.env': 'PORT=3000\nAPI_SECRET=s3cr3t-value-123456\nDATABASE_URL=postgres://app:hunter2hunter@db:5432/app\nDEBUG=true\nSTRIPE_KEY=changeme\n',
      'apps/api/.env.example': 'API_SECRET=real-looking-but-example-file-1234\n',
    });
    const r = analyzeWorkspace(root, { types: ['security'] });
    const env = byRule(r, 'sec.secret-in-env-file');
    expect(env.map(f => f.id).sort()).toEqual(['sec.secret-in-env-file:apps/api/.env:API_SECRET', 'sec.secret-in-env-file:apps/api/.env:DATABASE_URL']);
    const secret = env.find(f => f.id.endsWith(':API_SECRET'))!;
    expect(secret.evidence[0]).toMatchObject({ file: 'apps/api/.env', line: 2 });
    expect(secret.severity).toBe('critical'); // not ignored by git
    expect(JSON.stringify(r)).not.toContain('s3cr3t-value-123456');
    expect(JSON.stringify(r)).not.toContain('hunter2hunter');
    expect(secret.recommendation).toMatch(/\.gitignore/);
  });

  it('downgrades to high when the env file is gitignored', () => {
    const root = workspace({
      'apps/api/package.json': pkg('api'),
      'apps/api/.env': 'API_SECRET=s3cr3t-value-123456\n',
      '.gitignore': '.env\n',
    });
    const [f] = byRule(analyzeWorkspace(root, { types: ['security'] }), 'sec.secret-in-env-file');
    expect(f.severity).toBe('high');
    expect(f.evidence[1].detail).toMatch(/ignored by git/);
  });

  it('detects credential-shaped values and private keys in source, with test paths downgraded', () => {
    const root = workspace({
      'apps/api/package.json': pkg('api'),
      'apps/api/src/aws.ts': 'const key = "AKIAABCDEFGHIJKLMNOP";\n',
      'apps/api/src/key.ts': 'const k = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCWK8UjyoHgPTLa\n`;\n',
      'apps/api/src/doc.ts': '// openssl writes -----BEGIN PRIVATE KEY----- headers\n// Authorization: Bearer someTokenWordHere12345\n',
      'apps/api/tests/fixture.test.ts': 'const t = "ghp_' + 'a'.repeat(36) + '";\n',
      'apps/api/src/example.ts': 'const e = "AKIAIOSFODNN7EXAMPLE";\n',
    });
    const r = analyzeWorkspace(root, { types: ['security'] });
    const hits = byRule(r, 'sec.credential-in-source');
    const sev = Object.fromEntries(hits.map(f => [f.id.replace('sec.credential-in-source:', ''), f.severity]));
    expect(sev).toEqual({
      'apps/api/src/aws.ts:1': 'critical',
      'apps/api/src/key.ts:1': 'critical',
      'apps/api/tests/fixture.test.ts:1': 'low',
    });
    expect(JSON.stringify(r)).not.toContain('AKIAABCDEFGHIJKLMNOP');
  });

  it('flags unpinned dependency ranges (any/latest/open-ended/git) but not caret or workspace ranges', () => {
    const root = workspace({
      'apps/api/package.json': pkg('api', { a: '*', b: 'latest', c: '>=1.0.0', d: '^1.2.3', e: '~1.2.3', f: '1.2.3', g: 'workspace:*', h: 'github:org/repo', i: 'github:org/repo#abcdef1234567' }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    });
    const r = analyzeWorkspace(root, { types: ['security'] });
    const names = byRule(r, 'sec.unpinned-dependency').map(f => f.id.split(':')[2]).sort();
    expect(names).toEqual(['a', 'b', 'c', 'h']);
    const a = byRule(r, 'sec.unpinned-dependency').find(f => f.id.endsWith(':api:a'))!;
    expect(a.severity).toBe('medium');
    expect(a.evidence[0]).toMatchObject({ file: 'apps/api/package.json', line: 5 });
  });

  it('reports a missing lockfile only when there is none', () => {
    const files = { 'apps/api/package.json': pkg('api') };
    expect(byRule(analyzeWorkspace(workspace(files), { types: ['security'] }), 'sec.no-lockfile')).toHaveLength(1);
    expect(byRule(analyzeWorkspace(workspace({ ...files, 'package-lock.json': '{}' }), { types: ['security'] }), 'sec.no-lockfile')).toHaveLength(0);
  });

  it('finds literal secrets in compose and Kubernetes env, and unpinned images', () => {
    const root = workspace({
      'package.json': { name: 'root', private: true },
      'docker-compose.yml': [
        'services:',
        '  db:',
        '    image: postgres:latest',
        '    environment:',
        '      POSTGRES_PASSWORD: hunter2hunter2',
        '  api:',
        '    image: ghcr.io/acme/api:1.4.2',
        '    environment:',
        '      - API_TOKEN=${API_TOKEN}',
        '',
      ].join('\n'),
      'k8s/deploy.yaml': [
        'apiVersion: apps/v1',
        'kind: Deployment',
        'metadata:',
        '  name: worker',
        'spec:',
        '  template:',
        '    spec:',
        '      containers:',
        '        - name: worker',
        '          image: acme/worker',
        '          env:',
        '            - name: SIGNING_SECRET',
        '              value: literal-signing-secret-99',
        '            - name: DB_PASSWORD',
        '              valueFrom:',
        '                secretKeyRef: { name: db, key: password }',
        '',
      ].join('\n'),
    });
    const r = analyzeWorkspace(root, { types: ['security'] });
    const secrets = byRule(r, 'sec.secret-in-service-env').map(f => f.id).sort();
    expect(secrets).toEqual([
      'sec.secret-in-service-env:docker-compose:docker-compose.yml:db:POSTGRES_PASSWORD',
      'sec.secret-in-service-env:kubernetes:k8s/deploy.yaml:Deployment/worker:SIGNING_SECRET',
    ]);
    const images = byRule(r, 'sec.unpinned-image').map(f => f.title);
    expect(images.sort()).toEqual(['Image "acme/worker" is not pinned (worker)', 'Image "postgres:latest" is not pinned (db)']);
    expect(JSON.stringify(r)).not.toContain('hunter2hunter2');
    expect(JSON.stringify(r)).not.toContain('literal-signing-secret-99');
  });
});

describe('scalability', () => {
  const compose = [
    'services:',
    '  db:',
    '    image: postgres:16',
    '  api:',
    '    image: acme/api:1',
    '    depends_on: [db]',
    '    healthcheck:',
    '      test: ["CMD", "curl", "-f", "http://localhost/health"]',
    '    deploy:',
    '      resources:',
    '        limits: { cpus: "1", memory: 512M }',
    '  worker:',
    '    image: acme/worker:1',
    '    depends_on:',
    '      db:',
    '        condition: service_started',
    '  web:',
    '    image: acme/web:1',
    '    depends_on: [db, api]',
    '    healthcheck: { test: ["CMD", "true"] }',
    '    mem_limit: 256m',
    '  cache:',
    '    image: redis:7',
    '    healthcheck: { test: ["CMD", "redis-cli", "ping"] }',
    '    mem_limit: 128m',
    '    deploy: { replicas: 3 }',
    '',
  ].join('\n');

  it('reports services without health checks or resource limits, with file:line evidence', () => {
    const root = workspace({ 'package.json': { name: 'root', private: true }, 'docker-compose.yml': compose });
    const r = analyzeWorkspace(root, { types: ['scalability'] });
    const hc = byRule(r, 'scale.service-no-healthcheck').map(f => f.id.split(':').pop()).sort();
    expect(hc).toEqual(['db', 'worker']);
    const dbHc = byRule(r, 'scale.service-no-healthcheck').find(f => f.id.endsWith(':db'))!;
    expect(dbHc.severity).toBe('high'); // three services depend on it
    expect(dbHc.evidence[0]).toMatchObject({ file: 'docker-compose.yml', line: 2 });
    const lim = byRule(r, 'scale.service-no-resource-limits').map(f => f.id.split(':').pop()).sort();
    expect(lim).toEqual(['db', 'worker']);
  });

  it('detects a single point of failure: many dependents, one replica, no autoscaler', () => {
    const root = workspace({ 'package.json': { name: 'root', private: true }, 'docker-compose.yml': compose });
    const spof = byRule(analyzeWorkspace(root, { types: ['scalability'] }), 'scale.single-point-of-failure');
    expect(spof).toHaveLength(1);
    const f = spof[0];
    expect(f.id).toBe('scale.single-point-of-failure:docker-compose:docker-compose.yml:db');
    expect(f.severity).toBe('high');
    for (const name of ['api', 'web', 'worker']) expect(f.message).toContain(name);
    expect(f.evidence.filter(e => e.kind === 'graph').map(e => e.path)).toEqual(
      expect.arrayContaining([['api', 'db'], ['web', 'db'], ['worker', 'db']])
    );
    expect(f.evidence.some(e => e.detail === 'replicas not configured')).toBe(true);
  });

  it('does not flag a replicated shared service', () => {
    const replicated = compose.replace('    image: postgres:16\n', '    image: postgres:16\n    deploy: { replicas: 2 }\n');
    const root = workspace({ 'package.json': { name: 'root', private: true }, 'docker-compose.yml': replicated });
    expect(byRule(analyzeWorkspace(root, { types: ['scalability'] }), 'scale.single-point-of-failure')).toHaveLength(0);
  });

  it('analyzes Kubernetes workloads: probes, limits, single replicas, HPA, inferred dependencies', () => {
    const manifest = [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: cache',
      'spec:',
      '  replicas: 1',
      '  template:',
      '    spec:',
      '      containers:',
      '        - name: cache',
      '          image: redis:7',
      '---',
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: api',
      'spec:',
      '  replicas: 3',
      '  template:',
      '    spec:',
      '      containers:',
      '        - name: api',
      '          image: acme/api:2',
      '          env:',
      '            - name: REDIS_URL',
      '              value: redis://cache:6379',
      '          readinessProbe: { httpGet: { path: /ready, port: 80 } }',
      '          livenessProbe: { httpGet: { path: /live, port: 80 } }',
      '          resources: { limits: { cpu: 500m, memory: 256Mi } }',
      '---',
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: web',
      'spec:',
      '  replicas: 2',
      '  template:',
      '    spec:',
      '      containers:',
      '        - name: web',
      '          image: acme/web:2',
      '          args: ["--cache", "cache.default.svc:6379"]',
      '          readinessProbe: { httpGet: { path: /ready, port: 80 } }',
      '          resources: { limits: { memory: 128Mi } }',
      '',
    ].join('\n');
    const root = workspace({ 'package.json': { name: 'root', private: true }, 'k8s/app.yaml': manifest });
    const model = buildModel(root);
    const api = model.services.find(s => s.name === 'api')!;
    expect(api).toMatchObject({ kind: 'Deployment', replicas: 3, hasHealthcheck: true, hasResourceLimits: true });
    expect(api.dependsOn.map(d => d.name)).toEqual(['cache']);

    const r = analyzeWorkspace(root, { types: ['scalability'] });
    const ids = r.findings.map(f => f.id.replace(/^[^:]+:kubernetes:k8s\/app\.yaml:Deployment\//, '').concat('@').concat(f.ruleId)).sort();
    expect(ids).toEqual(
      [
        'cache@scale.service-no-healthcheck',
        'cache@scale.service-no-resource-limits',
        'cache@scale.single-point-of-failure',
      ].sort()
    );
    const spof = byRule(r, 'scale.single-point-of-failure')[0];
    expect(spof.severity).toBe('medium'); // two dependents (api, web)
    expect(spof.evidence[0]).toMatchObject({ file: 'k8s/app.yaml' });
    expect(spof.evidence[0].line).toBeGreaterThan(0);
  });

  it('an HPA removes the single-replica finding', () => {
    const m = (extra: string) =>
      [
        'apiVersion: apps/v1',
        'kind: Deployment',
        'metadata:',
        '  name: svc',
        'spec:',
        '  template:',
        '    spec:',
        '      containers:',
        '        - name: svc',
        '          image: acme/svc:1',
        '          readinessProbe: { httpGet: { path: /r, port: 80 } }',
        '          resources: { limits: { memory: 64Mi } }',
        extra,
      ].join('\n');
    const without = analyzeWorkspace(workspace({ 'package.json': { name: 'r', private: true }, 'k8s/a.yaml': m('') }), { types: ['scalability'] });
    expect(byRule(without, 'scale.single-replica')).toHaveLength(1);
    const hpa = '---\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: svc\nspec:\n  scaleTargetRef:\n    kind: Deployment\n    name: svc\n';
    const withHpa = analyzeWorkspace(workspace({ 'package.json': { name: 'r', private: true }, 'k8s/a.yaml': m(hpa) }), { types: ['scalability'] });
    expect(byRule(withHpa, 'scale.single-replica')).toHaveLength(0);
  });

  it('ignores Helm templates and malformed YAML instead of failing', () => {
    const root = workspace({
      'package.json': { name: 'root', private: true },
      'chart/templates/dep.yaml': 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {{ .Release.Name }}\n',
      'docker-compose.yml': 'services: [unclosed',
    });
    expect(analyzeWorkspace(root, { types: ['scalability'] }).findings).toEqual([]);
  });
});

describe('performance', () => {
  it('finds a dependency declared at different versions, and flags major differences higher', () => {
    const root = workspace({
      'apps/a/package.json': pkg('a', { react: '^17.0.0', lodash: '^4.17.0' }),
      'apps/b/package.json': pkg('b', { react: '^18.2.0', lodash: '^4.17.21' }),
    });
    const r = analyzeWorkspace(root, { types: ['performance'] });
    const dups = byRule(r, 'perf.duplicate-dependency-versions');
    expect(dups.map(f => [f.id.split(':')[1], f.severity])).toEqual([
      ['react', 'medium'],
      ['lodash', 'low'],
    ]);
    expect(dups[0].evidence).toEqual([
      expect.objectContaining({ file: 'apps/a/package.json', line: 5 }),
      expect.objectContaining({ file: 'apps/b/package.json', line: 5 }),
    ]);
  });

  it('flags a long dependency chain that serializes builds, with the chain as evidence', () => {
    const files: Files = {};
    for (let i = 1; i <= 7; i++) {
      files[`packages/p${i}/package.json`] = pkg(`p${i}`, i < 7 ? { [`p${i + 1}`]: 'workspace:*' } : {});
    }
    const r = analyzeWorkspace(workspace(files), { types: ['performance'] });
    const [f] = byRule(r, 'perf.deep-dependency-chain');
    expect(f.evidence[0].path).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  });

  it('flags known heavyweight production dependencies only', () => {
    const root = workspace({
      'apps/a/package.json': pkg('a', { moment: '^2.30.0' }, { devDependencies: { lodash: '^4.0.0' } }),
    });
    const ids = byRule(analyzeWorkspace(root, { types: ['performance'] }), 'perf.heavy-dependency').map(f => f.id);
    expect(ids).toEqual(['perf.heavy-dependency:a:moment']);
  });
});

describe('engine contract', () => {
  function everything() {
    return workspace({
      'apps/web/package.json': pkg('@acme/web', { '@acme/ui': 'workspace:*', left: '*' }),
      'apps/web/src/index.ts': 'export {};\n',
      'packages/ui/package.json': pkg('@acme/ui', { '@acme/web': 'workspace:*' }),
      'apps/web/.env': 'API_TOKEN=abcdef123456abcdef\n',
      'docker-compose.yml': 'services:\n  db:\n    image: postgres\n',
    });
  }

  it('every finding satisfies the contract schema and carries id, severity, evidence and recommendation', () => {
    const r = analyzeWorkspace(everything());
    expect(r.findings.length).toBeGreaterThan(5);
    for (const f of r.findings) {
      expect(analysisFindingSchema.safeParse(f).success, JSON.stringify(f)).toBe(true);
      expect(f.id.startsWith(`${f.ruleId}:`)).toBe(true);
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.recommendation.length).toBeGreaterThan(10);
    }
    expect(new Set(r.findings.map(f => f.id)).size).toBe(r.findings.length); // ids are unique
  });

  it('orders findings by severity then rule, and the summary adds up', () => {
    const r = analyzeWorkspace(everything());
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    const ranks = r.findings.map(f => order.indexOf(f.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const sum = Object.values(r.summary.bySeverity).reduce((a, b) => a + b, 0);
    expect(sum).toBe(r.summary.total);
    expect(Object.values(r.summary.byType).reduce((a, b) => a + b, 0)).toBe(r.summary.total);
    expect(r.graph).toEqual({ packages: 2, edges: 2, services: 1 });
  });

  it('runs only the requested types', () => {
    const r = analyzeWorkspace(everything(), { types: ['architecture'] });
    expect(r.types).toEqual(['architecture']);
    expect(new Set(r.findings.map(f => f.type))).toEqual(new Set(['architecture']));
  });

  it('restricts findings to one workspace by path or package name', () => {
    const root = everything();
    const byPath = analyzeWorkspace(root, { workspace: 'packages/ui' });
    expect(byPath.findings.length).toBeGreaterThan(0);
    for (const f of byPath.findings) {
      expect(f.evidence.some(e => e.file?.startsWith('packages/ui/') || (e.path ?? []).includes('@acme/ui'))).toBe(true);
    }
    const byName = analyzeWorkspace(root, { workspace: '@acme/ui' });
    expect(byName.findings.map(f => f.id)).toEqual(byPath.findings.map(f => f.id));
  });

  it('an empty directory yields an empty, valid report', () => {
    const root = workspace({}, { name: 'root', private: true });
    const r = analyzeWorkspace(root);
    expect(r.findings).toEqual([]);
    expect(r.graph).toEqual({ packages: 0, edges: 0, services: 0 });
  });
});
