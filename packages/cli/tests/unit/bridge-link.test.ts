import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { linkServices, unlinkServices, validateWorkspace } from '../../src/bridge/link';
import { runLink, runValidate } from '../../src/bridge/commands';
import { BridgeSpecError } from '../../src/bridge/spec/errors';
import { BridgeWorkspaceError, findCycles } from '../../src/bridge/workspace';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'bridge-workspace');

async function workspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-link-'));
  await fs.copy(FIXTURE, dir);
  // a comment the editor must preserve
  const cfg = path.join(dir, 're-shell.workspaces.yaml');
  await fs.writeFile(cfg, '# top-level comment must survive\n' + (await fs.readFile(cfg, 'utf8')));
  return dir;
}

function readConfig(dir: string): { services: Record<string, { dependsOn?: string[]; links?: Array<Record<string, unknown>> }> } {
  return yaml.load(fs.readFileSync(path.join(dir, 're-shell.workspaces.yaml'), 'utf8')) as never;
}

async function captureEnvelope<T = unknown>(fn: () => Promise<void>): Promise<T> {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  }) as typeof process.stdout.write);
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return JSON.parse(chunks.join('').trim()) as T;
}

describe('service link', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await workspace();
  });
  afterEach(async () => {
    await fs.remove(dir);
  });

  it('generates the provider client inside the consumer and records the dependency', () => {
    const result = linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    expect(result.protocol).toBe('rest');
    expect(result.languages).toEqual(['ts']); // web is a typescript service
    expect(result.client).toBe('services/web/clients/catalog-rest');
    expect(result.spec).toBe('services/catalog/openapi.yaml');
    expect(result.dependsOnAdded).toBe(true);
    expect(result.operations).toBe(5);

    const clientDir = path.join(dir, result.client);
    expect(fs.existsSync(path.join(clientDir, 'ts', 'client.ts'))).toBe(true);
    expect(fs.existsSync(path.join(clientDir, 'openapi.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(clientDir, 'python'))).toBe(false); // only the consumer's language
    expect(fs.readFileSync(path.join(clientDir, 'ts', 'client.ts'), 'utf8')).toContain('class CatalogClient');

    const raw = fs.readFileSync(path.join(dir, 're-shell.workspaces.yaml'), 'utf8');
    expect(raw).toContain('# top-level comment must survive');
    const cfg = readConfig(dir);
    expect(cfg.services.web.dependsOn).toEqual(['catalog']);
    expect(cfg.services.web.links).toEqual([
      expect.objectContaining({
        service: 'catalog',
        protocol: 'rest',
        spec: 'services/catalog/openapi.yaml',
        client: 'services/web/clients/catalog-rest',
        languages: ['ts'],
        contractSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
  });

  it('is idempotent: linking twice keeps one dependsOn entry and one link', () => {
    linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    const second = linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    expect(second.dependsOnAdded).toBe(false);
    const cfg = readConfig(dir);
    expect(cfg.services.web.dependsOn).toEqual(['catalog']);
    expect(cfg.services.web.links).toHaveLength(1);
  });

  it('picks the python client for a python consumer and honours --lang / --out', () => {
    const py = linkServices({ consumer: 'reports', provider: 'catalog', cwd: dir });
    expect(py.languages).toEqual(['python']);
    expect(fs.existsSync(path.join(dir, py.client, 'python', 'catalog_client', 'client.py'))).toBe(true);

    const multi = linkServices({ consumer: 'web', provider: 'inventory', cwd: dir, lang: 'ts,go', out: 'gen/inv' });
    expect(multi.languages).toEqual(['ts', 'go']);
    expect(multi.client).toBe('gen/inv');
    expect(fs.existsSync(path.join(dir, 'gen', 'inv', 'go', 'client.go'))).toBe(true);
  });

  it('links a gRPC provider from its .proto (stubs compiled when protoc exists)', () => {
    const r = linkServices({ consumer: 'reports', provider: 'orders', cwd: dir });
    expect(r.protocol).toBe('grpc');
    expect(r.client).toBe('services/reports/clients/orders-grpc');
    expect(fs.existsSync(path.join(dir, r.client, 'orders.proto'))).toBe(true);
    const py = r.stubs.find(s => s.language === 'python');
    expect(py).toBeDefined();
    if (py?.status === 'generated') {
      expect(fs.existsSync(path.join(dir, r.client, 'python', 'orders_client', 'orders_pb2_grpc.py'))).toBe(true);
    } else {
      expect(r.warnings.some(w => /stubs skipped/.test(w))).toBe(true);
    }
  });

  it('--dry-run writes nothing', () => {
    const before = fs.readFileSync(path.join(dir, 're-shell.workspaces.yaml'), 'utf8');
    const r = linkServices({ consumer: 'web', provider: 'catalog', cwd: dir, dryRun: true });
    expect(r.written).toBe(false);
    expect(fs.existsSync(path.join(dir, 'services', 'web', 'clients'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 're-shell.workspaces.yaml'), 'utf8')).toBe(before);
  });

  it('fails explicitly for unknown services, self links, missing specs and cycles', () => {
    expect(() => linkServices({ consumer: 'ghost', provider: 'catalog', cwd: dir })).toThrow(/consumer service "ghost" not found/);
    expect(() => linkServices({ consumer: 'web', provider: 'ghost', cwd: dir })).toThrow(/provider service "ghost" not found/);
    expect(() => linkServices({ consumer: 'web', provider: 'web', cwd: dir })).toThrow(/itself/);
    // reports has no spec of its own
    expect(() => linkServices({ consumer: 'web', provider: 'reports', cwd: dir })).toThrow(BridgeSpecError);
    expect(() => linkServices({ consumer: 'web', provider: 'reports', cwd: dir })).toThrow(/No spec found/);
    // cycle
    linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    expect(() => linkServices({ consumer: 'catalog', provider: 'web', cwd: dir })).toThrow(BridgeWorkspaceError);
    expect(() => linkServices({ consumer: 'catalog', provider: 'web', cwd: dir })).toThrow(/cycle: catalog -> web -> catalog/);
    // unsupported consumer language
    const cfgPath = path.join(dir, 're-shell.workspaces.yaml');
    fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, 'utf8').replace('language: python\n    framework: fastapi\n    path: services/reports', 'language: ruby\n    framework: rails\n    path: services/reports'));
    expect(() => linkServices({ consumer: 'reports', provider: 'catalog', cwd: dir })).toThrow(/no client generator/);
  });

  it('writes nothing when linking fails', () => {
    const before = fs.readFileSync(path.join(dir, 're-shell.workspaces.yaml'), 'utf8');
    expect(() => linkServices({ consumer: 'web', provider: 'reports', cwd: dir })).toThrow();
    expect(fs.readFileSync(path.join(dir, 're-shell.workspaces.yaml'), 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(dir, 'services', 'web', 'clients'))).toBe(false);
  });
});

describe('service validate', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await workspace();
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    await fs.remove(dir);
  });

  it('passes for a workspace whose links resolve and have no cycles', () => {
    linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    linkServices({ consumer: 'reports', provider: 'inventory', cwd: dir });
    const r = validateWorkspace({ cwd: dir });
    expect(r.valid).toBe(true);
    expect(r.links.map(l => `${l.consumer}->${l.provider}:${l.status}`)).toEqual(['web->catalog:ok', 'reports->inventory:ok']);
    expect(r.cycles).toEqual([]);
    expect(r.issues).toEqual([]);
  });

  it('flags a non-breaking provider change as a stale-client warning (still valid)', () => {
    linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    const spec = path.join(dir, 'services', 'catalog', 'openapi.yaml');
    fs.writeFileSync(
      spec,
      fs.readFileSync(spec, 'utf8').replace(
        '    Error:\n      type: object',
        '    Extra:\n      type: object\n      properties:\n        x: { type: string }\n    Error:\n      type: object'
      )
    );
    const r = validateWorkspace({ cwd: dir });
    expect(r.valid).toBe(true);
    expect(r.links[0].status).toBe('stale');
    expect(r.issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'CONTRACT_DRIFT' })]);
  });

  it('detects a breaking provider change (removed operation + required param)', () => {
    linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    const spec = path.join(dir, 'services', 'catalog', 'openapi.yaml');
    const doc = yaml.load(fs.readFileSync(spec, 'utf8')) as { paths: Record<string, Record<string, unknown>> };
    delete doc.paths['/products/{productId}'].delete;
    fs.writeFileSync(spec, yaml.dump(doc));
    const r = validateWorkspace({ cwd: dir });
    expect(r.valid).toBe(false);
    expect(r.links[0].status).toBe('broken');
    expect(r.links[0].changes.some(c => c.code === 'OPERATION_REMOVED' && c.severity === 'breaking')).toBe(true);
    expect(r.issues[0]).toEqual(expect.objectContaining({ severity: 'error', code: 'CONTRACT_BREAKING', consumer: 'web', provider: 'catalog' }));
  });

  it('reports a missing spec, a missing client, unknown services and unlisted dependsOn', () => {
    linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    linkServices({ consumer: 'reports', provider: 'inventory', cwd: dir });
    fs.removeSync(path.join(dir, 'services', 'catalog', 'openapi.yaml'));
    fs.removeSync(path.join(dir, 'services', 'reports', 'clients'));
    const cfgPath = path.join(dir, 're-shell.workspaces.yaml');
    const cfg = yaml.load(fs.readFileSync(cfgPath, 'utf8')) as ReturnType<typeof readConfig>;
    cfg.services.web.dependsOn = ['nope'];
    fs.writeFileSync(cfgPath, yaml.dump(cfg));
    const r = validateWorkspace({ cwd: dir });
    const codes = r.issues.map(i => i.code).sort();
    expect(codes).toEqual(expect.arrayContaining(['SPEC_MISSING', 'CLIENT_MISSING', 'DEPENDS_ON_UNKNOWN', 'LINK_NOT_IN_DEPENDS_ON']));
    expect(r.valid).toBe(false);
  });

  it('detects dependency cycles across dependsOn and links', () => {
    const cfgPath = path.join(dir, 're-shell.workspaces.yaml');
    const cfg = yaml.load(fs.readFileSync(cfgPath, 'utf8')) as ReturnType<typeof readConfig>;
    cfg.services.web.dependsOn = ['catalog'];
    cfg.services.catalog.dependsOn = ['orders'];
    cfg.services.orders.dependsOn = ['web'];
    fs.writeFileSync(cfgPath, yaml.dump(cfg));
    const r = validateWorkspace({ cwd: dir });
    expect(r.valid).toBe(false);
    expect(r.cycles).toHaveLength(1);
    expect(r.cycles[0]).toEqual(expect.arrayContaining(['web', 'catalog', 'orders']));
    expect(r.issues.some(i => i.code === 'CYCLE')).toBe(true);
  });

  it('findCycles finds simple and multi-node cycles and ignores DAGs', () => {
    expect(findCycles(new Map([['a', ['b']], ['b', ['c']], ['c', []]]))).toEqual([]);
    expect(findCycles(new Map([['a', ['b']], ['b', ['a']]]))).toEqual([['a', 'b', 'a']]);
  });

  it('--json: ok envelope with data.valid, and exit code 1 when invalid', async () => {
    linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    const good = await captureEnvelope<{ ok: boolean; data: { valid: boolean; links: unknown[] } }>(() =>
      runValidate({ cwd: dir, json: true })
    );
    expect(good.ok).toBe(true);
    expect(good.data.valid).toBe(true);
    expect(process.exitCode).toBe(0);

    fs.removeSync(path.join(dir, 'services', 'catalog', 'openapi.yaml'));
    const bad = await captureEnvelope<{ ok: boolean; data: { valid: boolean; issues: { code: string }[] } }>(() =>
      runValidate({ cwd: dir, json: true })
    );
    expect(bad.ok).toBe(true);
    expect(bad.data.valid).toBe(false);
    expect(bad.data.issues[0].code).toBe('SPEC_MISSING');
    expect(process.exitCode).toBe(1);
  });

  it('--json with no workspace emits BRIDGE_VALIDATE_ERROR and exit 1', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-empty-'));
    const env = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() => runValidate({ cwd: empty, json: true }));
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('BRIDGE_VALIDATE_ERROR');
    expect(process.exitCode).toBe(1);
    await fs.remove(empty);
  });
});

describe('service link --json + unlink', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await workspace();
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    await fs.remove(dir);
  });

  it('link --json: ok envelope; failure uses BRIDGE_SPEC_ERROR / BRIDGE_LINK_ERROR with exit 1', async () => {
    const good = await captureEnvelope<{ ok: boolean; data: { consumer: string; client: string } }>(() =>
      runLink({ consumer: 'web', provider: 'catalog', cwd: dir, json: true })
    );
    expect(good.ok).toBe(true);
    expect(good.data.client).toBe('services/web/clients/catalog-rest');

    const noSpec = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
      runLink({ consumer: 'web', provider: 'reports', cwd: dir, json: true })
    );
    expect(noSpec.ok).toBe(false);
    expect(noSpec.error.code).toBe('BRIDGE_SPEC_ERROR');
    expect(process.exitCode).toBe(1);

    process.exitCode = 0;
    const unknown = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
      runLink({ consumer: 'web', provider: 'ghost', cwd: dir, json: true })
    );
    expect(unknown.error.code).toBe('BRIDGE_LINK_ERROR');
  });

  it('unlink removes the link, the dependsOn edge and (optionally) the generated client', () => {
    const r = linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    const u = unlinkServices({ consumer: 'web', provider: 'catalog', cwd: dir, removeClient: true });
    expect(u.removed).toHaveLength(1);
    expect(u.clientRemoved).toEqual([r.client]);
    expect(fs.existsSync(path.join(dir, r.client))).toBe(false);
    const cfg = readConfig(dir);
    expect(cfg.services.web.links).toBeUndefined();
    expect(cfg.services.web.dependsOn).toBeUndefined();
    expect(validateWorkspace({ cwd: dir }).valid).toBe(true);
    expect(() => unlinkServices({ consumer: 'web', provider: 'catalog', cwd: dir })).toThrow(/no link or dependency/);
  });

  it('unlink will not delete a directory that lacks the bridge marker', () => {
    const r = linkServices({ consumer: 'web', provider: 'catalog', cwd: dir });
    fs.removeSync(path.join(dir, r.client, '.re-shell-bridge.json'));
    const u = unlinkServices({ consumer: 'web', provider: 'catalog', cwd: dir, removeClient: true });
    expect(u.clientRemoved).toEqual([]);
    expect(fs.existsSync(path.join(dir, r.client))).toBe(true);
  });
});
