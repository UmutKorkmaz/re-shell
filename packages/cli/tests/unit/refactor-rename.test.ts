import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { renameService, planRenameService, RefactorError } from '../../src/refactor/engine';
import { loadWorkspace } from '../../src/platform/workspace';
import { rewriteEnvNames, rewritePathRefs, rewriteUrlHosts } from '../../src/refactor/generic';
import { buildContext } from '../../src/refactor/context';
import { editYamlScalars } from '../../src/refactor/yaml-edit';
import { renameImageRepo, rewriteCompose } from '../../src/refactor/structural';
import { caseVariants, renameInName, SERVICE_NAME_PATTERN } from '../../src/refactor/names';
import { renderFileDiff } from '../../src/refactor/diff';
import { refactorRenameServiceResponseSchema } from '@re-shell/contracts';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'polyglot-workspace');
const dirs: string[] = [];

function copyFixture(opts: { git?: boolean } = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-refactor-'));
  dirs.push(dir);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  if (opts.git) {
    const run = (...args: string[]): void => {
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: dir, stdio: 'ignore' });
    };
    run('init', '-q', '-b', 'main');
    run('add', '-A');
    run('commit', '-q', '-m', 'fixture');
  }
  return dir;
}

afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

function read(dir: string, rel: string): string {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}

/** Map of relative path -> content for every file under dir (excluding .git). */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out.set(path.relative(dir, abs).split(path.sep).join('/'), fs.readFileSync(abs, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

function git(dir: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

describe('names', () => {
  it('case variants', () => {
    expect(caseVariants('billing-api')).toEqual({
      kebab: 'billing-api',
      snake: 'billing_api',
      pascal: 'BillingApi',
      camel: 'billingApi',
      upper: 'BILLING_API',
    });
  });

  it('service name validation matches the workspace schema pattern', () => {
    for (const ok of ['a', 'billing', 'billing-api', 'a1', 'x'.repeat(63)]) expect(SERVICE_NAME_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ['', 'Billing', '-a', 'a-', 'a_b', 'a b', 'x'.repeat(64), '../x']) expect(SERVICE_NAME_PATTERN.test(bad), bad).toBe(false);
  });

  it('renameInName replaces only whole delimited tokens of the last segment', () => {
    expect(renameInName('@acme/billing', 'billing', 'payments')).toBe('@acme/payments');
    expect(renameInName('billing-service', 'billing', 'payments')).toBe('payments-service');
    expect(renameInName('acme_billing', 'billing', 'payments')).toBe('acme_payments');
    expect(renameInName('rebilling', 'billing', 'payments')).toBe('rebilling');
    expect(renameInName('@billing/core', 'billing', 'payments')).toBe('@billing/core');
  });
});

describe('text rewriters', () => {
  const ctx = (): ReturnType<typeof buildContext> =>
    buildContext({ root: '/ws', configPath: '/ws/w.yaml', oldName: 'billing', newName: 'payments', oldRel: 'services/billing', explicitPath: true });

  it('env var names: only <OLD>_<SUFFIX> tokens', () => {
    const c = ctx();
    expect(rewriteEnvNames('BILLING_URL=1 BILLING_PORT=2 BILLING_SERVICE_URL=3 BILLING_GRPC_ADDR=4', c)).toBe(
      'PAYMENTS_URL=1 PAYMENTS_PORT=2 PAYMENTS_SERVICE_URL=3 PAYMENTS_GRPC_ADDR=4'
    );
    // unrelated tokens are not touched
    expect(rewriteEnvNames('NEXT_PUBLIC_BILLING_URL BILLING_MODE BILLINGS_URL', c)).toBe('NEXT_PUBLIC_BILLING_URL BILLING_MODE BILLINGS_URL');
  });

  it('url hosts: exact host only, including k8s service DNS', () => {
    const c = ctx();
    expect(rewriteUrlHosts('http://billing:8081/x https://billing/y grpc://billing.demo.svc.cluster.local:50051', c)).toBe(
      'http://payments:8081/x https://payments/y grpc://payments.demo.svc.cluster.local:50051'
    );
    expect(rewriteUrlHosts('http://billing.example.com http://mybilling:1 http://billing-api:1', c)).toBe(
      'http://billing.example.com http://mybilling:1 http://billing-api:1'
    );
  });

  it('path refs: relative tokens resolved against the file, plus root-relative service paths', () => {
    const c = ctx();
    expect(rewritePathRefs("import x from '../../billing/generated/billing-rest/ts/client';", '/ws/services/api/src', c)).toBe(
      "import x from '../../payments/generated/payments-rest/ts/client';"
    );
    expect(rewritePathRefs('replace x => ../billing', '/ws/services/edge', c)).toBe('replace x => ../payments');
    expect(rewritePathRefs('COPY services/billing /app', '/ws', c)).toBe('COPY services/payments /app');
    expect(rewritePathRefs('cd services\\billing\\x', '/ws', c)).toBe('cd services\\payments\\x');
    // a relative path that does NOT resolve into the service is untouched
    expect(rewritePathRefs("from '../billing/x'", '/ws/services/api/src', c)).toBe("from '../billing/x'");
    expect(rewritePathRefs('./src and ../ and ./billing', '/ws/services/billing', c)).toBe('./src and ../ and ./billing');
    expect(rewritePathRefs('my-services/billing-x services/billing-x', '/ws', c)).toBe('my-services/billing-x services/billing-x');
  });

  it('path refs: nothing is rewritten when the service directory is not named after the service', () => {
    const c = buildContext({ root: '/ws', configPath: '/ws/w.yaml', oldName: 'billing', newName: 'payments', oldRel: 'apps/pay', explicitPath: true });
    expect(c.moveDir).toBe(false);
    expect(rewritePathRefs('../billing/x services/billing', '/ws/services/api', c)).toBe('../billing/x services/billing');
  });

  it('image repository rename keeps registry and tag', () => {
    expect(renameImageRepo('acme/billing:latest', 'billing', 'payments')).toBe('acme/payments:latest');
    expect(renameImageRepo('registry.example.com:5000/team/billing@sha256:abc', 'billing', 'payments')).toBe(
      'registry.example.com:5000/team/payments@sha256:abc'
    );
    expect(renameImageRepo('billing', 'billing', 'payments')).toBe('payments');
    expect(renameImageRepo('acme/billing-sidecar:1', 'billing', 'payments')).toBe('acme/billing-sidecar:1');
  });
});

describe('yaml scalar editing preserves formatting', () => {
  it('keeps comments, quoting style, anchors and ordering; edits only targeted scalars', () => {
    const src = `# top comment\nservices:\n  a: &x\n    name: "old" # trailing\n    list: ['old', old, "keep"]\n  b:\n    <<: *x\n`;
    const r = editYamlScalars(src, ({ value }) => (value === 'old' ? 'new' : undefined));
    expect(r.changed).toBe(true);
    expect(r.text).toBe(`# top comment\nservices:\n  a: &x\n    name: "new" # trailing\n    list: ['new', new, "keep"]\n  b:\n    <<: *x\n`);
  });

  it('returns the original text untouched for invalid YAML', () => {
    const r = editYamlScalars('a: [unclosed', () => 'x');
    expect(r).toEqual({ text: 'a: [unclosed', changed: false, parsed: false });
  });

  it('handles multi-document streams with per-document indexes', () => {
    const src = 'a: x\n---\na: x\n';
    const r = editYamlScalars(src, ({ value, docIndex }) => (value === 'x' && docIndex === 1 ? 'y' : undefined));
    expect(r.text).toBe('a: x\n---\na: y\n');
  });

  it('compose: depends_on list+map, links aliases, extends, networks aliases, image', () => {
    const ctx = buildContext({ root: '/ws', configPath: '/ws/w.yaml', oldName: 'billing', newName: 'payments', oldRel: 'services/billing', explicitPath: true });
    const compose = [
      'services:',
      '  billing:',
      '    image: acme/billing:1',
      '    container_name: billing',
      '    networks:',
      '      default:',
      '        aliases: [billing, billing.internal, other]',
      '  a:',
      '    depends_on: [billing, db]',
      '    links: ["billing:billing-svc", db]',
      '    extends:',
      '      service: billing',
      '  b:',
      '    depends_on:',
      '      billing:',
      '        condition: service_started',
      '    environment:',
      '      NOTE: billing',
      '',
    ].join('\n');
    const out = rewriteCompose(compose, ctx);
    expect(out).toBe(
      [
        'services:',
        '  payments:',
        '    image: acme/payments:1',
        '    container_name: payments',
        '    networks:',
        '      default:',
        '        aliases: [payments, payments.internal, other]',
        '  a:',
        '    depends_on: [payments, db]',
        '    links: ["payments:billing-svc", db]',
        '    extends:',
        '      service: payments',
        '  b:',
        '    depends_on:',
        '      payments:',
        '        condition: service_started',
        '    environment:',
        '      NOTE: billing',
        '',
      ].join('\n')
    );
  });
});

describe('diff rendering', () => {
  it('renders git-style headers for renames and content changes', () => {
    const d = renderFileDiff('a/x.txt', 'b/y.txt', 'one\ntwo\n', 'one\n2\n');
    expect(d.patch).toContain('diff --git a/a/x.txt b/b/y.txt');
    expect(d.patch).toContain('rename from a/x.txt');
    expect(d.patch).toContain('--- a/a/x.txt');
    expect(d.patch).toContain('+++ b/b/y.txt');
    expect(d.patch).toContain('-two\n+2');
    expect(d.changedLines).toBe(2);
    const pure = renderFileDiff('k.yaml', 'm.yaml', 'same', 'same');
    expect(pure.patch).toContain('similarity index 100%');
    expect(pure.changedLines).toBe(0);
  });
});

describe('rename-service on the polyglot fixture: billing -> payments (java)', () => {
  it('dry run changes nothing on disk and reports a complete plan + unified diff', () => {
    const dir = copyFixture();
    const before = snapshot(dir);
    const res = renameService({ cwd: dir, oldName: 'billing', newName: 'payments', dryRun: true });
    expect(snapshot(dir)).toEqual(before);
    expect(res.dryRun).toBe(true);
    expect(res.applied).toBe(false);
    expect(refactorRenameServiceResponseSchema.safeParse(res).success).toBe(true);

    const kinds = new Set(res.files.map(f => f.kind));
    for (const k of ['workspace', 'compose', 'k8s', 'helm', 'dependency', 'env', 'source']) expect(kinds.has(k as never), k).toBe(true);

    // service directory move + k8s file renames
    expect(res.moves).toContainEqual({ from: 'services/billing', to: 'services/payments', kind: 'directory' });
    expect(res.moves).toContainEqual({ from: 'services/payments/generated/billing-rest', to: 'services/payments/generated/payments-rest', kind: 'directory' });
    expect(res.moves).toContainEqual({ from: 'k8s/deployment-billing.yaml', to: 'k8s/deployment-payments.yaml', kind: 'file' });
    expect(res.moves).toContainEqual({ from: 'k8s/networkpolicy-billing-default-deny-allow-intra.yaml', to: 'k8s/networkpolicy-payments-default-deny-allow-intra.yaml', kind: 'file' });

    const d = res.diff;
    // workspace yaml
    expect(d).toContain('-  billing:\n-    name: billing');
    expect(d).toContain('+  payments:\n+    name: payments');
    expect(d).toContain('-    path: services/billing\n+    path: services/payments');
    expect(d).toContain('-      - billing\n+      - payments'); // dependsOn
    // env var + URL host references in other services
    expect(d).toContain('-      BILLING_URL: http://billing:8081 # billing over the compose network\n+      PAYMENTS_URL: http://payments:8081 # billing over the compose network');
    expect(d).toContain('-BILLING_URL = os.environ["BILLING_URL"]'.replace('BILLING_URL = os', 'BILLING_URL = os'));
    expect(d).toContain('+PAYMENTS_URL = os.environ["PAYMENTS_URL"]');
    // generated client import + identifier
    expect(d).toContain("-import { BillingRestClient } from '../../billing/generated/billing-rest/ts/client';");
    expect(d).toContain("+import { PaymentsRestClient } from '../../payments/generated/payments-rest/ts/client';");
    // package manifest
    expect(d).toContain('-  <artifactId>billing</artifactId>\n+  <artifactId>payments</artifactId>');
    // compose
    expect(d).toContain('-    build: ./services/billing\n-    image: acme/billing:latest');
    expect(d).toContain('-      - billing:billing-svc\n+      - payments:billing-svc');
    // k8s + helm
    expect(d).toContain('-  name: billing\n+  name: payments');
    expect(d).toContain('-      repository: billing\n+      repository: payments');
    // CI path
    expect(d).toContain('-      - run: mvn -f services/billing/pom.xml -B verify\n+      - run: mvn -f services/payments/pom.xml -B verify');
    // rename headers
    expect(d).toContain('rename from services/billing\nrename to services/payments');
    expect(d).toContain('rename from k8s/service-billing.yaml\nrename to k8s/service-payments.yaml');
  });

  it('unresolvable prose and identifiers are reported as residual references, never silently changed', () => {
    const dir = copyFixture();
    const res = renameService({ cwd: dir, oldName: 'billing', newName: 'payments', dryRun: true });
    const paths = res.residualReferences.map(r => r.path);
    expect(paths).toContain('README.md');
    expect(res.residualReferences.some(r => r.path.endsWith('Application.java'))).toBe(true);
    expect(res.warnings.join('\n')).toMatch(/remaining mention/);
    // the prose line itself is untouched in the diff
    expect(res.diff).not.toContain('+The payments service owns invoices');
  });

  it('applies for real inside a git repo: git mv, valid workspace, history-friendly renames', () => {
    const dir = copyFixture({ git: true });
    const res = renameService({ cwd: dir, oldName: 'billing', newName: 'payments' });
    expect(res.applied).toBe(true);
    expect(res.git).toEqual({ inRepo: true, dirty: false, moved: 'git-mv' });

    expect(fs.existsSync(path.join(dir, 'services/billing'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'services/payments/pom.xml'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'services/payments/generated/payments-rest/ts/client.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'k8s/deployment-payments.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'k8s/deployment-billing.yaml'))).toBe(false);

    const ws = loadWorkspace(dir);
    expect(ws.services.map(s => s.name)).toContain('payments');
    expect(ws.services.map(s => s.name)).not.toContain('billing');
    expect(ws.services.find(s => s.name === 'api')!.config.dependsOn).toEqual(['payments', 'analytics']);
    expect(ws.services.find(s => s.name === 'api')!.config.env).toMatchObject({ PAYMENTS_URL: 'http://payments:8081' });
    expect(ws.services.find(s => s.name === 'payments')!.dir).toBe(path.join(fs.realpathSync(dir), 'services', 'payments'));

    // comments and formatting survive
    const yml = read(dir, 're-shell.workspaces.yaml');
    expect(yml).toContain('# Polyglot fixture workspace');
    expect(yml).toContain('# billing over the compose network');
    expect(yml).toContain('dependsOn: [payments]');

    // git sees real renames (staged by git mv) with the content edits unstaged
    const status = git(dir, 'status', '--porcelain');
    expect(status).toMatch(/^R[ M] .*services\/billing\/pom\.xml -> services\/payments\/pom\.xml/m);
    expect(git(dir, 'diff', '--name-only').split('\n')).toContain('services/payments/pom.xml');
  });

  it('falls back to a plain rename outside a git repository', () => {
    const dir = copyFixture();
    const res = renameService({ cwd: dir, oldName: 'billing', newName: 'payments' });
    expect(res.git).toEqual({ inRepo: false, dirty: false, moved: 'fs-rename' });
    expect(fs.existsSync(path.join(dir, 'services/payments/pom.xml'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'services/billing'))).toBe(false);
  });

  it('is reversible: renaming back restores every file byte-for-byte (except residual prose)', () => {
    const dir = copyFixture();
    const original = snapshot(dir);
    renameService({ cwd: dir, oldName: 'billing', newName: 'payments' });
    renameService({ cwd: dir, oldName: 'payments', newName: 'billing' });
    const after = snapshot(dir);
    expect([...after.keys()].sort()).toEqual([...original.keys()].sort());
    for (const [file, content] of original) expect(after.get(file), file).toBe(content);
  });
});

describe('guards', () => {
  it('refuses a dirty git tree unless --force; dry-run only warns', () => {
    const dir = copyFixture({ git: true });
    fs.writeFileSync(path.join(dir, 'scratch.txt'), 'uncommitted');
    try {
      renameService({ cwd: dir, oldName: 'billing', newName: 'payments' });
      expect.unreachable('should have refused');
    } catch (err) {
      expect(err).toBeInstanceOf(RefactorError);
      expect((err as RefactorError).code).toBe('REFACTOR_DIRTY_TREE');
      expect((err as RefactorError).details?.entries).toContain('?? scratch.txt');
    }
    expect(fs.existsSync(path.join(dir, 'services/billing'))).toBe(true);

    const dry = renameService({ cwd: dir, oldName: 'billing', newName: 'payments', dryRun: true });
    expect(dry.git.dirty).toBe(true);
    expect(dry.warnings.join('\n')).toMatch(/would refuse without --force/);

    const forced = renameService({ cwd: dir, oldName: 'billing', newName: 'payments', force: true });
    expect(forced.applied).toBe(true);
    expect(forced.warnings.join('\n')).toMatch(/continuing because of --force/);
  });

  it('refuses a name that collides with an existing service, even with --force', () => {
    const dir = copyFixture();
    for (const force of [false, true]) {
      try {
        renameService({ cwd: dir, oldName: 'billing', newName: 'api', force, dryRun: true });
        expect.unreachable('should have refused');
      } catch (err) {
        expect((err as RefactorError).code).toBe('REFACTOR_NAME_COLLISION');
      }
    }
  });

  it('refuses a name already used by a compose-only service', () => {
    const dir = copyFixture();
    try {
      renameService({ cwd: dir, oldName: 'billing', newName: 'db', dryRun: true });
      expect.unreachable('should have refused');
    } catch (err) {
      expect((err as RefactorError).code).toBe('REFACTOR_NAME_COLLISION');
      expect((err as RefactorError).message).toContain('docker-compose.yml');
    }
  });

  it('refuses when the target directory already exists', () => {
    const dir = copyFixture();
    fs.mkdirSync(path.join(dir, 'services', 'payments'), { recursive: true });
    expect(() => renameService({ cwd: dir, oldName: 'billing', newName: 'payments', dryRun: true })).toThrow(/Target directory already exists/);
  });

  it('rejects invalid names, unknown services, identical names and a missing workspace', () => {
    const dir = copyFixture();
    const code = (fn: () => unknown): string => {
      try {
        fn();
      } catch (err) {
        return (err as RefactorError).code;
      }
      return 'none';
    };
    expect(code(() => planRenameService({ cwd: dir, oldName: 'billing', newName: 'Bad_Name' }))).toBe('REFACTOR_INVALID_NAME');
    expect(code(() => planRenameService({ cwd: dir, oldName: 'billing', newName: '../escape' }))).toBe('REFACTOR_INVALID_NAME');
    expect(code(() => planRenameService({ cwd: dir, oldName: 'nope', newName: 'fresh' }))).toBe('REFACTOR_SERVICE_NOT_FOUND');
    expect(code(() => planRenameService({ cwd: dir, oldName: 'billing', newName: 'billing' }))).toBe('REFACTOR_INVALID_NAME');
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-refactor-empty-'));
    dirs.push(empty);
    expect(code(() => planRenameService({ cwd: empty, oldName: 'a', newName: 'b' }))).toBe('WORKSPACE_NOT_FOUND');
  });
});

describe('rename-service per language', () => {
  it('npm + generated client + relative import + env (api -> public-api)', () => {
    const dir = copyFixture();
    renameService({ cwd: dir, oldName: 'api', newName: 'public-api' });
    expect(JSON.parse(read(dir, 'services/public-api/package.json')).name).toBe('@acme/public-api');
    const web = JSON.parse(read(dir, 'services/web/package.json'));
    expect(web.dependencies).toEqual({ '@acme/public-api': 'workspace:*', react: '^18.3.0' });
    // a scripts key named "api" is NOT a dependency and must survive
    expect(web.scripts.api).toBe('node scripts/api.js');
    const main = read(dir, 'services/web/src/main.ts');
    expect(main).toContain("from '../../public-api/generated/public-api-rest/ts/client'");
    expect(main).toContain("from '@acme/public-api/dist/helper'");
    expect(main).toContain('PublicApiRestClient');
    expect(main).toContain('process.env.PUBLIC_API_URL');
    expect(read(dir, 'services/public-api/generated/public-api-rest/ts/client.ts')).toContain('export class PublicApiRestClient');
    expect(read(dir, 'docker-compose.yml')).toContain('container_name: public-api');
    expect(read(dir, 'k8s/service-public-api.yaml')).toContain('name: public-api');
    // another service's Deployment only had its env reference rewritten
    expect(read(dir, 'k8s/deployment-web.yaml')).toContain('http://public-api:4000');
  });

  it('go module path + importers + replace directive (gateway -> edge-gw)', () => {
    const dir = copyFixture();
    renameService({ cwd: dir, oldName: 'gateway', newName: 'edge-gw' });
    expect(read(dir, 'services/edge-gw/go.mod')).toContain('module github.com/acme/edge-gw');
    expect(read(dir, 'services/edge/go.mod')).toContain('require github.com/acme/edge-gw v0.0.0');
    expect(read(dir, 'services/edge/go.mod')).toContain('replace github.com/acme/edge-gw => ../edge-gw');
    expect(read(dir, 'services/edge/main.go')).toContain('"github.com/acme/edge-gw/client"');
  });

  it('rust crate: Cargo name, dependents Cargo.toml key + path, `use` statements (search -> lookup)', () => {
    const dir = copyFixture();
    renameService({ cwd: dir, oldName: 'search', newName: 'lookup' });
    expect(read(dir, 'services/lookup/Cargo.toml')).toContain('name = "lookup"');
    expect(read(dir, 'services/indexer/Cargo.toml')).toContain('lookup = { path = "../lookup" }');
    expect(read(dir, 'services/indexer/src/main.rs')).toContain('use lookup::query;');
    // unrelated word in a string literal stays
    expect(read(dir, 'services/lookup/src/main.rs')).toContain('println!("search");');
  });

  it('python project name (analytics -> insights) and php composer name (reports -> summaries)', () => {
    const dir = copyFixture();
    renameService({ cwd: dir, oldName: 'analytics', newName: 'insights' });
    expect(read(dir, 'services/insights/pyproject.toml')).toContain('name = "insights"');
    expect(read(dir, 'services/api/src/index.ts')).toContain('process.env.INSIGHTS_URL');
    renameService({ cwd: dir, oldName: 'reports', newName: 'summaries' });
    expect(JSON.parse(read(dir, 'services/summaries/composer.json')).name).toBe('acme/summaries');
  });

  it('dotnet assembly name (ledger -> books)', () => {
    const dir = copyFixture();
    renameService({ cwd: dir, oldName: 'ledger', newName: 'books' });
    expect(read(dir, 'services/books/Ledger.csproj')).toContain('<AssemblyName>Books</AssemblyName>');
  });

  it('package name that does not mention the service is left alone, with a warning', () => {
    const dir = copyFixture();
    fs.writeFileSync(path.join(dir, 'services/mailer/Gemfile'), 'source "https://rubygems.org"\n');
    fs.writeFileSync(path.join(dir, 'services/web/package.json'), JSON.stringify({ name: '@acme/storefront', version: '1.0.0' }, null, 2) + '\n');
    const res = renameService({ cwd: dir, oldName: 'web', newName: 'shop' });
    expect(JSON.parse(read(dir, 'services/shop/package.json')).name).toBe('@acme/storefront');
    expect(res.warnings.join('\n')).toMatch(/does not contain the service name "web", left unchanged/);
  });

  it('a service whose directory is not named after it is not moved', () => {
    const dir = copyFixture();
    const cfg = path.join(dir, 're-shell.workspaces.yaml');
    fs.writeFileSync(cfg, read(dir, 're-shell.workspaces.yaml').replace('path: services/mailer', 'path: apps/mail-worker'));
    fs.mkdirSync(path.join(dir, 'apps'), { recursive: true });
    fs.renameSync(path.join(dir, 'services/mailer'), path.join(dir, 'apps/mail-worker'));
    const res = renameService({ cwd: dir, oldName: 'mailer', newName: 'courier' });
    expect(res.moves.filter(m => m.kind === 'directory')).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'apps/mail-worker'))).toBe(true);
    expect(read(dir, 're-shell.workspaces.yaml')).toContain('path: apps/mail-worker');
    expect(res.warnings.join('\n')).toMatch(/directory is not moved/);
    expect(loadWorkspace(dir).services.map(s => s.name)).toContain('courier');
  });

  it('lockfiles are never edited; a warning explains how to refresh them', () => {
    const dir = copyFixture();
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), "importers:\n  services/billing:\n    dependencies: {}\n");
    const res = renameService({ cwd: dir, oldName: 'billing', newName: 'payments' });
    expect(read(dir, 'pnpm-lock.yaml')).toContain('services/billing');
    expect(res.warnings.join('\n')).toMatch(/Lockfiles reference "billing".*pnpm-lock.yaml/);
  });
});
