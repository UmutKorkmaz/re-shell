import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';
import { execute, parse } from 'graphql';

import { generateGateway, stitchSubgraphs, BridgeGatewayError, type Subgraph } from '../../src/bridge/gateway';
import { runGateway } from '../../src/bridge/gateway-command';
import { startMockServer, type RunningMockServer } from '../../src/bridge/mock/server';
import { writeBundle } from '../../src/bridge/generate';
import { vi } from 'vitest';

const FIX = path.join(__dirname, '..', 'fixtures', 'bridge-gateway');
const read = (f: string): string => fs.readFileSync(path.join(FIX, f), 'utf8');

const FEDERATED: Subgraph[] = [
  { name: 'products', sdl: read('products.graphql'), url: 'http://localhost:4001/graphql' },
  { name: 'reviews', sdl: read('reviews.graphql'), url: 'http://localhost:4002/graphql' },
];

describe('gateway: Apollo Federation 2 composition (@apollo/composition)', () => {
  it('composes federated subgraphs into a supergraph with entity joins', () => {
    const r = generateGateway(FEDERATED, 'federation');
    expect(r.mode).toBe('federation');
    const sdl = r.supergraphSdl as string;
    // supergraph SDL declares the join graph and ties each type to its subgraphs
    expect(sdl).toContain('enum join__Graph');
    expect(sdl).toContain('PRODUCTS @join__graph(name: "products", url: "http://localhost:4001/graphql")');
    expect(sdl).toMatch(/type Product[\s\S]*@join__type\(graph: PRODUCTS, key: "id"\)[\s\S]*@join__type\(graph: REVIEWS, key: "id"\)/);
    // fields of the two subgraphs are merged on the shared entity
    expect(sdl).toMatch(/reviews: \[Review!\]! @join__field\(graph: REVIEWS\)/);
    expect(sdl).toMatch(/name: String! @join__field\(graph: PRODUCTS\)/);
    expect(r.subgraphs.map(s => s.rootFields)).toEqual([['Query.product', 'Query.products'], ['Query.reviews', 'Mutation.addReview']]);
    expect(r.files.map(f => f.path)).toEqual(
      expect.arrayContaining(['supergraph.graphql', 'gateway/index.ts', 'gateway/package.json', 'gateway/subgraphs.json', 'README.md'])
    );
    expect(r.files.find(f => f.path === 'gateway/index.ts')!.content).toContain('ApolloGateway');
  });

  it('fails explicitly, with the Apollo error codes, when composition fails', () => {
    const clashing: Subgraph[] = [
      FEDERATED[0],
      {
        name: 'pricing',
        url: 'http://localhost:4003/graphql',
        sdl: 'extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])\n' +
          'type Product @key(fields: "id") { id: ID! price: String! }\n',
      },
    ];
    let error: BridgeGatewayError | undefined;
    try {
      generateGateway(clashing, 'federation');
    } catch (e) {
      error = e as BridgeGatewayError;
    }
    expect(error).toBeInstanceOf(BridgeGatewayError);
    expect(error!.errors.length).toBeGreaterThan(0);
    expect(error!.errors.map(e => e.code)).toContain('INVALID_FIELD_SHARING');
    expect(error!.message).toMatch(/composition failed/);
  });

  it('rejects fewer than two subgraphs, duplicate names and invalid SDL', () => {
    expect(() => generateGateway([FEDERATED[0]], 'federation')).toThrow(/at least two/);
    expect(() => generateGateway([FEDERATED[0], { ...FEDERATED[1], name: 'products' }], 'federation')).toThrow(/duplicate subgraph/);
    expect(() => generateGateway([FEDERATED[0], { name: 'bad', sdl: 'type Query {' }], 'federation')).toThrow(/invalid GraphQL SDL/);
  });

  it('warns when a subgraph has no URL', () => {
    const r = generateGateway([{ ...FEDERATED[0], url: undefined }, FEDERATED[1]], 'federation');
    expect(r.warnings.some(w => /has no URL/.test(w))).toBe(true);
  });
});

describe('gateway: schema stitching (@graphql-tools/stitch)', () => {
  const PLAIN: Subgraph[] = [
    { name: 'products', sdl: 'type Product { id: ID! name: String! price: Float! }\ntype Query { product(id: ID!): Product products: [Product!]! }\n' },
    { name: 'reviews', sdl: 'type Review { id: ID! body: String! rating: Int! }\ntype Query { reviews: [Review!]! }\ntype Mutation { addReview(body: String!, rating: Int!): Review! }\n' },
  ];

  it('merges root fields and types of every subgraph into one schema', () => {
    const r = generateGateway(PLAIN, 'stitch');
    expect(r.gatewaySdl).toContain('product(id: ID!): Product');
    expect(r.gatewaySdl).toContain('reviews: [Review!]!');
    expect(r.gatewaySdl).toContain('addReview(body: String!, rating: Int!): Review!');
    expect(r.files.map(f => f.path)).toEqual(expect.arrayContaining(['gateway.graphql', 'gateway/index.ts', 'gateway/subgraphs.json']));
  });

  it('rejects ambiguous root fields and conflicting field types', () => {
    const clash: Subgraph[] = [PLAIN[0], { name: 'other', sdl: 'type Query { products: [String!]! }\n' }];
    expect(() => generateGateway(clash, 'stitch')).toThrow(/Query.products is defined by both "products" and "other"/);
    const typeClash: Subgraph[] = [PLAIN[0], { name: 'other', sdl: 'type Product { id: ID! price: String! }\ntype Query { other: Product }\n' }];
    expect(() => generateGateway(typeClash, 'stitch')).toThrow(/Product.price is Float! in "products" but String! in "other"/);
  });
});

describe('gateway: the stitched gateway executes against real GraphQL servers', () => {
  let products: RunningMockServer;
  let reviews: RunningMockServer;
  let tmp: string;
  const plainProducts = 'type Product { id: ID! name: String! price: Float! }\ntype Query { product(id: ID!): Product }\n';
  const plainReviews = 'type Review { id: ID! body: String! rating: Int! }\ntype Query { reviews: [Review!]! }\ntype Mutation { addReview(body: String!, rating: Int!): Review! }\n';

  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-gw-'));
    fs.writeFileSync(path.join(tmp, 'products.graphql'), plainProducts);
    fs.writeFileSync(path.join(tmp, 'reviews.graphql'), plainReviews);
    products = await startMockServer({ specs: [path.join(tmp, 'products.graphql')], port: 0 });
    reviews = await startMockServer({ specs: [path.join(tmp, 'reviews.graphql')], port: 0 });
  });
  afterAll(async () => {
    await products.close();
    await reviews.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('stitchSubgraphs: one query spans both services', async () => {
    const schema = stitchSubgraphs(
      [
        { name: 'products', sdl: plainProducts, url: products.graphqlUrl },
        { name: 'reviews', sdl: plainReviews, url: reviews.graphqlUrl },
      ],
      { executors: true }
    );
    const result = await execute({
      schema,
      document: parse('{ product(id: "7") { id name price } reviews { body rating } }'),
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      product: { id: '7', name: 'name', price: 3.14 },
      reviews: [
        { body: 'body', rating: 42 },
        { body: 'body', rating: 42 },
      ],
    });
    // both upstream services really received a request
    const log1 = (await (await fetch(`${products.baseUrl}/__mock/requests`)).json()) as { call: string }[];
    const log2 = (await (await fetch(`${reviews.baseUrl}/__mock/requests`)).json()) as { call: string }[];
    expect(log1.length).toBeGreaterThan(0);
    expect(log2.length).toBeGreaterThan(0);
  });

  it('the generated gateway/index.ts type-checks and serves a cross-service query', async () => {
    const r = generateGateway(
      [
        { name: 'products', sdl: plainProducts, url: products.graphqlUrl },
        { name: 'reviews', sdl: plainReviews, url: reviews.graphqlUrl },
      ],
      'stitch'
    );
    const out = path.join(tmp, 'gw');
    writeBundle(r.files, out);
    const dir = path.join(out, 'gateway');
    // link the CLI's node_modules so the generated imports resolve
    let nm = __dirname;
    while (!fs.existsSync(path.join(nm, 'node_modules', '@graphql-tools')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
    fs.symlinkSync(path.join(nm, 'node_modules'), path.join(dir, 'node_modules'), 'dir');

    const program = ts.createProgram([path.join(dir, 'index.ts')], {
      noEmit: true,
      strict: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
      esModuleInterop: true,
      types: ['node'],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    expect(diagnostics).toEqual([]);

    const js = ts.transpileModule(fs.readFileSync(path.join(dir, 'index.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    fs.writeFileSync(path.join(dir, 'index.js'), js);
    process.env.PRODUCTS_URL = products.graphqlUrl;
    process.env.REVIEWS_URL = reviews.graphqlUrl;
    const mod = createRequire(path.join(dir, 'index.js'))(path.join(dir, 'index.js')) as { startGateway(port?: number): import('http').Server };
    const server = mod.startGateway(0);
    await new Promise<void>(resolve => server.once('listening', () => resolve()));
    try {
      const port = (server.address() as { port: number }).port;
      const res = await fetch(`http://127.0.0.1:${port}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'mutation { addReview(body: "great", rating: 5) { body rating } } ' }),
      });
      const body = (await res.json()) as { data?: unknown; errors?: unknown };
      expect(body.errors).toBeUndefined();
      expect(body.data).toEqual({ addReview: { body: 'great', rating: 5 } }); // routed to the reviews service, args echoed
      const q = await fetch(`http://127.0.0.1:${port}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ product(id: "9") { name } reviews { id } }' }),
      });
      expect(((await q.json()) as { data: { product: { name: string } } }).data.product.name).toBe('name');
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      delete process.env.PRODUCTS_URL;
      delete process.env.REVIEWS_URL;
    }
  });
});

describe('gateway: command layer', () => {
  async function capture<T = unknown>(fn: () => Promise<void>): Promise<T> {
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

  it('--json: composition result for --subgraph flags, nothing written on --dry-run', async () => {
    process.exitCode = 0;
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-gwcmd-'));
    const env = await capture<{ ok: boolean; data: { mode: string; supergraphSdl: string; written: string[]; artifacts: { path: string }[] } }>(() =>
      runGateway({
        subgraphs: [`products=${path.join(FIX, 'products.graphql')}@http://localhost:4001/graphql`, `reviews=${path.join(FIX, 'reviews.graphql')}@http://localhost:4002/graphql`],
        mode: 'federation',
        out,
        dryRun: true,
        json: true,
      })
    );
    expect(env.ok).toBe(true);
    expect(env.data.supergraphSdl).toContain('join__Graph');
    expect(env.data.written).toEqual([]);
    expect(fs.readdirSync(out)).toEqual([]);
    fs.rmSync(out, { recursive: true, force: true });
  });

  it('--json: composition failure is BRIDGE_GATEWAY_ERROR with exit 1 and structured errors', async () => {
    process.exitCode = 0;
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-gwbad-'));
    const bad = path.join(tmp2, 'pricing.graphql');
    fs.writeFileSync(bad, 'extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])\ntype Product @key(fields: "id") { id: ID! price: String! }\n');
    const env = await capture<{ ok: boolean; error: { code: string; details?: { errors: { code: string }[] } } }>(() =>
      runGateway({ subgraphs: [`products=${path.join(FIX, 'products.graphql')}`, `pricing=${bad}`], json: true })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('BRIDGE_GATEWAY_ERROR');
    expect(env.error.details?.errors.map(e => e.code)).toContain('INVALID_FIELD_SHARING');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    fs.rmSync(tmp2, { recursive: true, force: true });
  });

  it('--services resolves SDL + URL from the workspace', async () => {
    process.exitCode = 0;
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-gwws-'));
    fs.cpSync(path.join(__dirname, '..', 'fixtures', 'bridge-workspace'), ws, { recursive: true });
    fs.mkdirSync(path.join(ws, 'services', 'catalog'), { recursive: true });
    fs.writeFileSync(path.join(ws, 'services', 'catalog', 'schema.graphql'), 'type Item { id: ID! }\ntype Query { items: [Item!]! }\n');
    fs.rmSync(path.join(ws, 'services', 'catalog', 'openapi.yaml'));
    const env = await capture<{ ok: boolean; data: { subgraphs: { name: string; url?: string }[]; gatewaySdl: string } }>(() =>
      runGateway({ services: ['inventory', 'catalog'], mode: 'stitch', cwd: ws, json: true })
    );
    expect(env.ok).toBe(true);
    expect(env.data.subgraphs).toEqual([
      expect.objectContaining({ name: 'inventory', url: 'http://localhost:4000/graphql' }),
      expect.objectContaining({ name: 'catalog', url: 'http://localhost:8081/graphql' }),
    ]);
    expect(env.data.gatewaySdl).toContain('items: [Item!]!');
    fs.rmSync(ws, { recursive: true, force: true });
  });
});
