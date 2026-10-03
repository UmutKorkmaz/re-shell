import { describe, expect, it } from 'vitest';
import * as path from 'path';

import { discoverSpecs, loadContract, resolveContract, selectSpec } from '../../src/bridge/spec/discover';
import { BridgeSpecError } from '../../src/bridge/spec/errors';
import { findModel } from '../../src/bridge/spec/ir';

const WS = path.join(__dirname, '..', 'fixtures', 'bridge-workspace', 'services');

describe('bridge spec: OpenAPI', () => {
  const contract = loadContract(path.join(WS, 'catalog', 'openapi.yaml'));

  it('derives operations from paths + operationIds', () => {
    expect(contract.protocol).toBe('rest');
    expect(contract.title).toBe('Catalog API');
    expect(contract.version).toBe('1.2.0');
    expect(contract.baseUrl).toBe('http://localhost:8081');
    const names = contract.operations.map(o => o.name).sort();
    expect(names).toEqual(['createProduct', 'deleteProduct', 'getProduct', 'listProducts', 'setPrice']);
  });

  it('resolves refs, enums, allOf, nullable and inline schemas into models', () => {
    const product = findModel(contract, 'Product');
    expect(product?.kind).toBe('object');
    if (product?.kind !== 'object') throw new Error('unreachable');
    const byName = Object.fromEntries(product.fields.map(f => [f.name, f]));
    expect(byName.id.required).toBe(true);
    expect(byName.tags.type).toEqual({ k: 'list', of: { k: 'scalar', name: 'string' } });
    expect(byName.createdAt.type).toEqual({ k: 'scalar', name: 'datetime' });
    expect(byName.attributes.type).toEqual({ k: 'map', of: { k: 'scalar', name: 'string' } });
    expect(byName.parent.type).toEqual({ k: 'ref', name: 'Product' });
    expect(findModel(contract, 'Currency')?.kind).toBe('enum');
    const detail = findModel(contract, 'ProductDetail');
    expect(detail?.kind).toBe('object');
    if (detail?.kind === 'object') {
      expect(detail.fields.map(f => f.name)).toEqual(expect.arrayContaining(['id', 'name', 'description', 'stock']));
    }
    // inline request body is hoisted to a named model
    expect(findModel(contract, 'SetPriceRequest')?.kind).toBe('object');
  });

  it('binds path/query/header params, bodies and success responses', () => {
    const list = contract.operations.find(o => o.name === 'listProducts');
    if (list?.protocol !== 'rest') throw new Error('unreachable');
    expect(list.params.map(p => `${p.in}:${p.name}`)).toEqual(['query:limit', 'query:tag', 'header:X-Request-Id']);
    const create = contract.operations.find(o => o.name === 'createProduct');
    if (create?.protocol !== 'rest') throw new Error('unreachable');
    expect(create.body?.required).toBe(true);
    expect(create.response?.type).toEqual({ k: 'ref', name: 'Product' });
    const del = contract.operations.find(o => o.name === 'deleteProduct');
    if (del?.protocol !== 'rest') throw new Error('unreachable');
    expect(del.response).toBeUndefined();
    const get = contract.operations.find(o => o.name === 'getProduct');
    if (get?.protocol !== 'rest') throw new Error('unreachable');
    expect(get.params).toEqual([
      expect.objectContaining({ name: 'productId', in: 'path', required: true }),
    ]);
  });

  it('rejects Swagger 2.0 and non-OpenAPI documents with a BridgeSpecError', () => {
    const fs = require('fs') as typeof import('fs');
    const os = require('os') as typeof import('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-bad-'));
    const swagger = path.join(dir, 'swagger.json');
    fs.writeFileSync(swagger, JSON.stringify({ swagger: '2.0', paths: {} }));
    expect(() => loadContract(swagger)).toThrow(BridgeSpecError);
    expect(() => loadContract(swagger)).toThrow(/Swagger 2.0 is not supported/);
    const junk = path.join(dir, 'junk.yaml');
    fs.writeFileSync(junk, 'hello: world\n');
    expect(() => loadContract(junk)).toThrow(/openapi/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('bridge spec: proto', () => {
  const contract = loadContract(path.join(WS, 'orders', 'orders.proto'));

  it('derives package, services and rpc streaming flags', () => {
    expect(contract.protocol).toBe('grpc');
    expect(contract.packageName).toBe('acme.orders');
    const ops = contract.operations.filter(o => o.protocol === 'grpc');
    expect(ops.map(o => o.protocol === 'grpc' && `${o.fqService}/${o.method}`)).toEqual([
      'acme.orders.OrderService/CreateOrder',
      'acme.orders.OrderService/GetOrder',
      'acme.orders.OrderService/WatchOrders',
    ]);
    const watch = ops.find(o => o.protocol === 'grpc' && o.method === 'WatchOrders');
    expect(watch?.protocol === 'grpc' && watch.serverStreaming).toBe(true);
  });

  it('keeps field numbers, repeated/map/optional/oneof and nested messages', () => {
    const create = findModel(contract, 'CreateOrderRequest');
    if (create?.kind !== 'object') throw new Error('unreachable');
    const by = Object.fromEntries(create.fields.map(f => [f.name, f]));
    expect(by.customer_id.tag).toBe(1);
    expect(by.items.type).toEqual({ k: 'list', of: { k: 'ref', name: 'Item' } });
    expect(by.note.required).toBe(false);
    expect(by.labels.type).toEqual({ k: 'map', of: { k: 'scalar', name: 'string' } });
    const order = findModel(contract, 'Order');
    if (order?.kind !== 'object') throw new Error('unreachable');
    const o = Object.fromEntries(order.fields.map(f => [f.name, f]));
    expect(o.total_cents.type).toEqual({ k: 'scalar', name: 'long' });
    expect(o.card.required).toBe(false);
    expect(o.meta.type).toEqual({ k: 'ref', name: 'OrderMeta' });
    expect(findModel(contract, 'OrderMeta')?.kind).toBe('object');
    expect(findModel(contract, 'Status')?.kind).toBe('enum');
  });
});

describe('bridge spec: GraphQL', () => {
  const contract = loadContract(path.join(WS, 'inventory', 'schema.graphql'));

  it('derives query/mutation operations with typed args', () => {
    expect(contract.protocol).toBe('graphql');
    const stock = contract.operations.find(o => o.name === 'stock');
    if (stock?.protocol !== 'graphql') throw new Error('unreachable');
    expect(stock.operation).toBe('query');
    expect(stock.args).toEqual([expect.objectContaining({ name: 'sku', required: true, gqlType: 'ID!' })]);
    expect(stock.returnsNullable).toBe(true);
    const adjust = contract.operations.find(o => o.name === 'adjustStock');
    if (adjust?.protocol !== 'graphql') throw new Error('unreachable');
    expect(adjust.operation).toBe('mutation');
    expect(adjust.args[0].gqlType).toBe('AdjustInput!');
    const warehouses = contract.operations.find(o => o.name === 'warehouses');
    if (warehouses?.protocol !== 'graphql') throw new Error('unreachable');
    expect(warehouses.args[0].required).toBe(false); // has a default
  });

  it('models enums, unions, inputs and flags fields that need arguments', () => {
    expect(findModel(contract, 'StockStatus')?.kind).toBe('enum');
    const union = findModel(contract, 'StockResult');
    expect(union).toEqual(expect.objectContaining({ kind: 'union', members: ['StockLevel', 'Discontinued'] }));
    const input = findModel(contract, 'AdjustInput');
    expect(input).toEqual(expect.objectContaining({ kind: 'object', input: true }));
    const level = findModel(contract, 'StockLevel');
    if (level?.kind !== 'object') throw new Error('unreachable');
    expect(level.fields.find(f => f.name === 'history')?.noSelect).toBe(true);
    // root types are not models
    expect(findModel(contract, 'Query')).toBeUndefined();
  });

  it('tolerates federation directives and extend-only subgraph SDL', () => {
    const fs = require('fs') as typeof import('fs');
    const os = require('os') as typeof import('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-fed-'));
    const file = path.join(dir, 'schema.graphql');
    fs.writeFileSync(
      file,
      'extend type Query { me: User }\ntype User @key(fields: "id") { id: ID! name: String }\n'
    );
    const c = loadContract(file);
    expect(c.operations.map(o => o.name)).toEqual(['me']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('bridge spec: discovery', () => {
  it('finds the provider spec in a service directory', () => {
    expect(discoverSpecs(path.join(WS, 'catalog')).map(c => [path.basename(c.path), c.protocol])).toEqual([
      ['openapi.yaml', 'rest'],
    ]);
    expect(discoverSpecs(path.join(WS, 'orders')).map(c => c.protocol)).toEqual(['grpc']);
    expect(discoverSpecs(path.join(WS, 'inventory')).map(c => c.protocol)).toEqual(['graphql']);
    expect(discoverSpecs(path.join(WS, 'web'))).toEqual([]);
  });

  it('errors explicitly when there is no spec, or several', () => {
    expect(() => resolveContract({ serviceDir: path.join(WS, 'web') })).toThrow(/No spec found/);
    expect(() =>
      selectSpec(
        [
          { path: 'a.proto', protocol: 'grpc', format: 'proto' },
          { path: 'b.graphql', protocol: 'graphql', format: 'graphql' },
        ],
        undefined,
        'x'
      )
    ).toThrow(/Multiple specs/);
  });

  it('honours an explicit --spec and checks it against the requested protocol', () => {
    const spec = path.join(WS, 'orders', 'orders.proto');
    expect(resolveContract({ specPath: spec }).protocol).toBe('grpc');
    expect(() => resolveContract({ specPath: spec, protocol: 'rest' })).toThrow(/is a grpc spec/);
  });
});
