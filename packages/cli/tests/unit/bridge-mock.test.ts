import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

import { startMockServer, type RunningMockServer } from '../../src/bridge/mock/server';
import { BridgeSpecError } from '../../src/bridge/spec/errors';

const WS = path.join(__dirname, '..', 'fixtures', 'bridge-workspace', 'services');
const OPENAPI = path.join(WS, 'catalog', 'openapi.yaml');
const PROTO = path.join(WS, 'orders', 'orders.proto');
const SDL = path.join(WS, 'inventory', 'schema.graphql');

async function http(server: RunningMockServer, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${server.baseUrl}${url}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) : undefined };
}

describe('universal mock server: REST + GraphQL + gRPC from one process', () => {
  let server: RunningMockServer;
  beforeAll(async () => {
    server = await startMockServer({ specs: [OPENAPI, SDL, PROTO], port: 0 });
  });
  afterAll(async () => {
    await server.close();
  });

  it('starts all three protocols and reports where they listen', () => {
    expect(server.protocols.sort()).toEqual(['graphql', 'grpc', 'rest']);
    expect(server.httpPort).toBeGreaterThan(0);
    expect(server.grpcPort).toBeGreaterThan(0);
    expect(server.graphqlUrl).toBe(`${server.baseUrl}/graphql`);
    expect(server.specs.map(s => s.protocol).sort()).toEqual(['graphql', 'grpc', 'rest']);
  });

  describe('REST (from OpenAPI examples and schemas)', () => {
    it('serves the documented example for a response that has one', async () => {
      const r = await http(server, 'GET', '/products?limit=5&tag=a&tag=b');
      expect(r.status).toBe(200);
      expect(r.body.items[0]).toEqual(expect.objectContaining({ id: 'p-1', name: 'Widget', price: 9.99, currency: 'USD' }));
      expect(r.body.nextCursor).toBeNull();
    });

    it('synthesizes a schema-conformant body when there is no example (allOf merged, enums, dates)', async () => {
      const r = await http(server, 'GET', '/products/42');
      expect(r.status).toBe(200);
      expect(r.body).toEqual(
        expect.objectContaining({ id: 'string', name: 'string', price: 1.5, currency: 'USD', createdAt: '2024-01-01T00:00:00Z', description: 'string', stock: 1 })
      );
      expect(r.body.attributes).toEqual({ key: 'string' });
      expect(r.body).not.toHaveProperty('parent'); // recursive optional property is cut
    });

    it('uses the documented success status (201 / 204)', async () => {
      const created = await http(server, 'POST', '/products', { name: 'Gadget', price: 3 });
      expect(created.status).toBe(201);
      expect(created.body.id).toBe('string');
      const deleted = await http(server, 'DELETE', '/products/42');
      expect(deleted.status).toBe(204);
      expect(deleted.body).toBeUndefined();
    });

    it('rejects requests that violate the contract with 400 and the problems', async () => {
      const bad = await http(server, 'POST', '/products', { price: 'free' });
      expect(bad.status).toBe(400);
      expect(bad.body.problems.join(' ')).toMatch(/name/);
      const notJson = await fetch(`${server.baseUrl}/products`, { method: 'POST', body: 'nope', headers: { 'content-type': 'application/json' } });
      expect(notJson.status).toBe(400);
    });

    it('honours "Prefer: code=N" for documented responses and refuses undocumented ones', async () => {
      const notFound = await http(server, 'GET', '/products/42', undefined, { Prefer: 'code=404' });
      expect(notFound.status).toBe(404);
      const undocumented = await http(server, 'GET', '/products/42', undefined, { Prefer: 'code=418' });
      expect(undocumented.status).toBe(501);
      expect(undocumented.body.defined).toEqual(['200', '404']);
    });

    it('404s unknown routes explicitly', async () => {
      const r = await http(server, 'GET', '/nope');
      expect(r.status).toBe(404);
      expect(r.body.error).toMatch(/no route/);
    });
  });

  describe('GraphQL (mocked resolvers from the SDL)', () => {
    const gql = (query: string, variables?: unknown) => http(server, 'POST', '/graphql', { query, variables });

    it('resolves queries with type-correct data, enums and abstract types', async () => {
      const r = await gql('{ stock(sku: "S1") { __typename ... on StockLevel { sku quantity status warehouse { name city } } } warehouses { id name } }');
      expect(r.status).toBe(200);
      expect(r.body.errors).toBeUndefined();
      expect(r.body.data.stock).toEqual({
        __typename: 'StockLevel',
        sku: 'S1', // argument echoed
        quantity: 42,
        status: 'IN_STOCK',
        warehouse: { name: 'name', city: 'city' },
      });
      expect(r.body.data.warehouses).toHaveLength(2);
    });

    it('echoes mutation input fields', async () => {
      const r = await gql('mutation M($i: AdjustInput!) { adjustStock(input: $i) { sku quantity } }', { i: { sku: 'ABC', delta: 3 } });
      expect(r.body.data.adjustStock).toEqual({ sku: 'ABC', quantity: 42 });
    });

    it('validates against the schema (400 + errors) and supports GET', async () => {
      const bad = await gql('{ nope }');
      expect(bad.status).toBe(400);
      expect(bad.body.errors[0].message).toMatch(/Cannot query field "nope"/);
      const viaGet = await http(server, 'GET', `/graphql?query=${encodeURIComponent('{ warehouses { id } }')}`);
      expect(viaGet.status).toBe(200);
      expect(viaGet.body.data.warehouses[0]).toEqual({ id: '1' });
    });
  });

  describe('gRPC (served from the .proto)', () => {
    const def = protoLoader.loadSync(PROTO, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
    const pkg = grpc.loadPackageDefinition(def) as any;
    const client = (): any => new pkg.acme.orders.OrderService(`127.0.0.1:${server.grpcPort}`, grpc.credentials.createInsecure());

    it('answers unary calls, echoing same-named request fields', async () => {
      const c = client();
      const order = await new Promise<any>((resolve, reject) => c.GetOrder({ id: 'o-7' }, (e: Error | null, r: unknown) => (e ? reject(e) : resolve(r))));
      expect(order.id).toBe('o-7');
      expect(order.status).toBe('PENDING'); // first non-zero enum value
      expect(order.items).toHaveLength(1);
      expect(order.items[0]).toEqual({ sku: 'sku', quantity: 1 });
      expect(order.total_cents).toBe('1');
      expect(order.meta).toEqual({ source: 'source' });
      c.close();
    });

    it('serves server-streaming RPCs', async () => {
      const c = client();
      const messages: any[] = [];
      await new Promise<void>((resolve, reject) => {
        const call = c.WatchOrders({ max_events: 3 });
        call.on('data', (m: unknown) => messages.push(m));
        call.on('end', () => resolve());
        call.on('error', reject);
      });
      expect(messages).toHaveLength(3);
      c.close();
    });
  });

  it('records the calls it served, across all three protocols', async () => {
    const log = (await http(server, 'GET', '/__mock/requests')).body as { protocol: string; call: string; operation?: string }[];
    const protocols = new Set(log.map(r => r.protocol));
    expect([...protocols].sort()).toEqual(['graphql', 'grpc', 'rest']);
    expect(log.some(r => r.protocol === 'rest' && r.call.startsWith('GET /products') && r.operation === 'listProducts')).toBe(true);
    expect(log.some(r => r.protocol === 'grpc' && r.call === 'acme.orders.OrderService/GetOrder')).toBe(true);
    const cleared = await http(server, 'DELETE', '/__mock/requests');
    expect(cleared.status).toBe(204);
    expect(((await http(server, 'GET', '/__mock/requests')).body as unknown[]).length).toBe(0);
  });

  it('health endpoint lists protocols', async () => {
    const r = await http(server, 'GET', '/__mock/health');
    expect(r.body.ok).toBe(true);
    expect(r.body.protocols.sort()).toEqual(['graphql', 'grpc', 'rest']);
  });
});

describe('universal mock server: errors', () => {
  it('needs at least one spec and reports unreadable specs as BridgeSpecError', async () => {
    await expect(startMockServer({ specs: [] })).rejects.toThrow(BridgeSpecError);
    await expect(startMockServer({ specs: ['/nonexistent/spec.yaml'], port: 0 })).rejects.toThrow(BridgeSpecError);
  });

  it('a REST-only mock does not open a gRPC port (and vice versa)', async () => {
    const rest = await startMockServer({ specs: [OPENAPI], port: 0 });
    expect(rest.grpcPort).toBeUndefined();
    expect(rest.protocols).toEqual(['rest']);
    await rest.close();
    const grpcOnly = await startMockServer({ specs: [PROTO], port: 0 });
    expect(grpcOnly.httpPort).toBeUndefined();
    expect(grpcOnly.grpcPort).toBeGreaterThan(0);
    await grpcOnly.close();
  });
});
