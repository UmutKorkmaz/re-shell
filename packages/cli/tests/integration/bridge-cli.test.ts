// The BUILT CLI (dist/index.js): bridge commands are listed in --help and every
// --json payload validates against its zod schema in @re-shell/contracts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  bridgeAsyncResponseSchema,
  bridgeDiffResponseSchema,
  bridgeGatewayResponseSchema,
  bridgeGenerateResponseSchema,
  bridgeLinkResponseSchema,
  bridgeMockResponseSchema,
  bridgeTransformResponseSchema,
  bridgeUnlinkResponseSchema,
  bridgeValidateResponseSchema,
  jsonResponseSchema,
} from '@re-shell/contracts';
import type { z } from 'zod';

const CLI = path.resolve(process.cwd(), 'dist/index.js');
const FIXTURES = path.resolve(process.cwd(), 'tests/fixtures');

let tmp: string;
let ws: string;

/** Run the CLI, capturing stdout through a file (large payloads truncate on pipes). */
function cli(args: string[], cwd: string): { stdout: string; status: number } {
  const out = path.join(tmp, `out-${Math.random().toString(36).slice(2)}.txt`);
  const fd = fs.openSync(out, 'w');
  let status = 0;
  try {
    execFileSync('node', [CLI, ...args], { cwd, stdio: ['ignore', fd, 'ignore'], timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    status = (error as { status?: number }).status ?? 1;
  } finally {
    fs.closeSync(fd);
  }
  return { stdout: fs.readFileSync(out, 'utf8'), status };
}

function envelope<T extends z.ZodTypeAny>(schema: T, stdout: string): z.infer<T> {
  const lines = stdout.trim().split('\n');
  expect(lines, 'stdout must be exactly one JSON line').toHaveLength(1);
  const parsed = jsonResponseSchema(schema).safeParse(JSON.parse(lines[0]));
  expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
  const body = (parsed as { data: { ok: boolean; data: z.infer<T> } }).data;
  expect(body.ok).toBe(true);
  return body.data;
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-cli-'));
  ws = path.join(tmp, 'ws');
  fs.cpSync(path.join(FIXTURES, 'bridge-workspace'), ws, { recursive: true });
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('re-shell service ... --help', () => {
  it('lists link / unlink / validate and the bridge subcommands', () => {
    const service = cli(['service', '--help'], ws).stdout;
    for (const cmd of ['bridge', 'link', 'unlink', 'validate']) expect(service).toMatch(new RegExp(`\\n\\s+${cmd}[ \\n]`));
    const bridge = cli(['service', 'bridge', '--help'], ws).stdout;
    for (const cmd of ['generate', 'diff', 'mock', 'gateway', 'async', 'transform']) expect(bridge).toMatch(new RegExp(`\\n\\s+${cmd}[ \\n]`));
  });
});

describe('bridge generate (spec-driven) and the default contract', () => {
  it('--rest --spec emits a spec-derived multi-language bundle', () => {
    const r = cli(['service', 'bridge', 'generate', '--rest', '--service', 'catalog', '--lang', 'ts,python,go', '--dry-run', '--json'], ws);
    expect(r.status).toBe(0);
    const data = envelope(bridgeGenerateResponseSchema, r.stdout);
    expect(data.contractSource).toBe('spec');
    expect(data.spec?.operations).toBe(5);
    expect(data.languages).toEqual(['ts', 'python', 'go']);
    expect(data.artifacts.map(a => a.path)).toEqual(expect.arrayContaining(['openapi.yaml', 'ts/client.ts', 'python/catalog_client/client.py', 'go/client.go']));
    expect(data.tsCheck).toEqual({ ran: true, ok: true });
    expect(data.written).toEqual([]);
  });

  it('a service without a spec falls back to the default contract and says so', () => {
    const r = cli(['service', 'bridge', 'generate', '--rest', '--service', 'web', '--dry-run', '--json'], ws);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.data.contractSource).toBe('default');
    expect(parsed.warnings.join(' ')).toMatch(/no spec found/);
    envelope(bridgeGenerateResponseSchema, r.stdout);
  });

  it('--spec with the wrong protocol flag is a BRIDGE_GENERATE_ERROR (exit 1)', () => {
    const r = cli(['service', 'bridge', 'generate', '--grpc', '--spec', 'services/catalog/openapi.yaml', '--json'], ws);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).error.code).toBe('BRIDGE_GENERATE_ERROR');
  });
});

describe('service link / validate / unlink', () => {
  it('link records the dependency and generates the client; validate passes; a breaking provider change fails validate with exit 1', () => {
    const link = cli(['service', 'link', 'web', 'catalog', '--json'], ws);
    expect(link.status).toBe(0);
    const linked = envelope(bridgeLinkResponseSchema, link.stdout);
    expect(linked.client).toBe('services/web/clients/catalog-rest');
    expect(fs.existsSync(path.join(ws, linked.client, 'ts', 'client.ts'))).toBe(true);
    const cfg = yaml.load(fs.readFileSync(path.join(ws, 're-shell.workspaces.yaml'), 'utf8')) as { services: { web: { dependsOn: string[]; links: unknown[] } } };
    expect(cfg.services.web.dependsOn).toEqual(['catalog']);
    expect(cfg.services.web.links).toHaveLength(1);

    const ok = cli(['service', 'validate', '--json'], ws);
    expect(ok.status).toBe(0);
    expect(envelope(bridgeValidateResponseSchema, ok.stdout).valid).toBe(true);

    const specPath = path.join(ws, 'services', 'catalog', 'openapi.yaml');
    const doc = yaml.load(fs.readFileSync(specPath, 'utf8')) as { paths: Record<string, Record<string, unknown>> };
    delete doc.paths['/products/{productId}'].delete;
    fs.writeFileSync(specPath, yaml.dump(doc));
    const bad = cli(['service', 'validate', '--json'], ws);
    expect(bad.status).toBe(1);
    const verdict = envelope(bridgeValidateResponseSchema, bad.stdout);
    expect(verdict.valid).toBe(false);
    expect(verdict.issues[0].code).toBe('CONTRACT_BREAKING');

    const unlink = cli(['service', 'unlink', 'web', 'catalog', '--remove-client', '--json'], ws);
    expect(unlink.status).toBe(0);
    expect(envelope(bridgeUnlinkResponseSchema, unlink.stdout).clientRemoved).toEqual(['services/web/clients/catalog-rest']);
  }, 180000);

  it('link to a provider without a spec fails explicitly (BRIDGE_SPEC_ERROR, exit 1)', () => {
    const r = cli(['service', 'link', 'web', 'reports', '--json'], ws);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).error.code).toBe('BRIDGE_SPEC_ERROR');
  });
});

describe('diff, transform, gateway, async', () => {
  it('diff exits 1 on a breaking change and 0 otherwise; payload matches the schema', () => {
    const base = path.join(ws, 'services', 'inventory', 'schema.graphql');
    const head = path.join(tmp, 'head.graphql');
    fs.writeFileSync(head, fs.readFileSync(base, 'utf8').replace('stock(sku: ID!): StockResult', 'stock(sku: ID!, tenant: ID!): StockResult'));
    const breaking = cli(['service', 'bridge', 'diff', '--base', base, '--head', head, '--json'], ws);
    expect(breaking.status).toBe(1);
    const d = envelope(bridgeDiffResponseSchema, breaking.stdout);
    expect(d.compatible).toBe(false);
    expect(d.changes.some(c => c.code === 'REQUIRED_ARGUMENT_ADDED')).toBe(true);
    const same = cli(['service', 'bridge', 'diff', '--base', base, '--head', base, '--json'], ws);
    expect(same.status).toBe(0);
    expect(envelope(bridgeDiffResponseSchema, same.stdout).changes).toEqual([]);
  });

  it('transform converts json -> protobuf -> json through the CLI', () => {
    const schema = path.join(FIXTURES, 'bridge-transform', 'user.v1.proto');
    const data = JSON.stringify({ id: 'u1', name: 'Ada', age: 3, role: 'USER' });
    const toPb = cli(['service', 'bridge', 'transform', '--from', 'json', '--to', 'protobuf', '--schema', schema, '--message', 'User', '--data', data, '--json'], ws);
    expect(toPb.status).toBe(0);
    const pb = envelope(bridgeTransformResponseSchema, toPb.stdout);
    const back = cli(['service', 'bridge', 'transform', '--from', 'protobuf', '--to', 'json', '--schema', schema, '--message', 'User', '--data', pb.outputBase64 as string, '--input-encoding', 'base64', '--json'], ws);
    expect(JSON.parse(envelope(bridgeTransformResponseSchema, back.stdout).output as string)).toEqual(expect.objectContaining({ id: 'u1', name: 'Ada', age: 3, role: 'USER' }));
    const bad = cli(['service', 'bridge', 'transform', '--from', 'json', '--to', 'protobuf', '--schema', schema, '--message', 'User', '--data', '{"age":"x"}', '--json'], ws);
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout).error.code).toBe('BRIDGE_TRANSFORM_ERROR');
  });

  it('gateway composes federated subgraphs (Apollo composition) and fails on conflicts', () => {
    const gw = path.join(FIXTURES, 'bridge-gateway');
    const r = cli(['service', 'bridge', 'gateway', '--subgraph', `products=${gw}/products.graphql@http://localhost:4001/graphql`, `reviews=${gw}/reviews.graphql@http://localhost:4002/graphql`, '--dry-run', '--json'], ws);
    expect(r.status).toBe(0);
    expect(envelope(bridgeGatewayResponseSchema, r.stdout).supergraphSdl).toContain('join__Graph');
    const clash = path.join(tmp, 'clash.graphql');
    fs.writeFileSync(clash, 'extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])\ntype Product @key(fields: "id") { id: ID! price: String! }\n');
    const bad = cli(['service', 'bridge', 'gateway', '--subgraph', `products=${gw}/products.graphql`, `pricing=${clash}`, '--json'], ws);
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout).error.code).toBe('BRIDGE_GATEWAY_ERROR');
  });

  it('async generates from async.yaml using the runtime shipped in dist; --init scaffolds', () => {
    fs.copyFileSync(path.join(FIXTURES, 'bridge-async', 'async.yaml'), path.join(ws, 'async.yaml'));
    const r = cli(['service', 'bridge', 'async', '--transport', 'redis-streams', '--lang', 'ts', '--dry-run', '--json'], ws);
    expect(r.status).toBe(0);
    const data = envelope(bridgeAsyncResponseSchema, r.stdout);
    expect(data.messages.map(m => m.name)).toEqual(['OrderCreated', 'InvoiceIssued', 'ShipmentPlanned']);
    expect(data.artifacts.map(a => a.path)).toEqual(expect.arrayContaining(['ts/runtime/bus.ts', 'ts/runtime/redis-streams.ts', 'ts/messages.ts', 'services.registry.json']));
    const none = cli(['service', 'bridge', 'async', '--transport', 'nats', '--json'], ws);
    expect(none.status).toBe(1);
    expect(JSON.parse(none.stdout).error.code).toBe('BRIDGE_SPEC_ERROR');
  });
});

describe('bridge mock (long-running)', () => {
  it('starts all three protocols, announces them with one JSON envelope, serves requests, stops on --timeout', async () => {
    const specs = ['catalog/openapi.yaml', 'orders/orders.proto', 'inventory/schema.graphql'].map(p => path.join(FIXTURES, 'bridge-workspace', 'services', p));
    const child = spawn('node', [CLI, 'service', 'bridge', 'mock', '--spec', ...specs, '--port', '0', '--timeout', '60', '--json'], { cwd: ws });
    let out = '';
    child.stdout.on('data', d => (out += d));
    const started = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`mock did not start: ${out}`)), 60000);
      const poll = setInterval(() => {
        if (out.includes('\n')) {
          clearInterval(poll);
          clearTimeout(t);
          resolve(out.split('\n')[0]);
        }
      }, 50);
    });
    try {
      const info = envelope(bridgeMockResponseSchema, started);
      expect(info.protocols.sort()).toEqual(['graphql', 'grpc', 'rest']);
      const res = await fetch(`${info.baseUrl}/products`);
      expect(res.status).toBe(200);
      expect(((await res.json()) as { items: { id: string }[] }).items[0].id).toBe('p-1');
      const gql = await fetch(info.graphqlUrl as string, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '{ warehouses { id } }' }) });
      expect(((await gql.json()) as { data: { warehouses: unknown[] } }).data.warehouses).toHaveLength(2);
      expect(info.grpcPort).toBeGreaterThan(0);
    } finally {
      child.kill('SIGINT');
      await new Promise(r => child.once('exit', r));
    }
    expect(out.trim().split('\n')).toHaveLength(1); // exactly one JSON document on stdout
  }, 120000);
});
