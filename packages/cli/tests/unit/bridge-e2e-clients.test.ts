// End-to-end: the generated clients (TypeScript, Python, Go) are *executed*
// against the universal mock server, over real sockets, for REST, GraphQL and
// gRPC. This is stronger than compiling them: it proves the wire format,
// parameter encoding, model decoding and error handling.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile, spawnSync } from 'child_process';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';

import { buildBridgeBundle, writeBundle } from '../../src/bridge/generate';
import { startMockServer, type RunningMockServer } from '../../src/bridge/mock/server';
import { compileGrpcStubs, findProtoc, type StubResult } from '../../src/bridge/stubs';
import { loadContract } from '../../src/bridge/spec/discover';

const WS = path.join(__dirname, '..', 'fixtures', 'bridge-workspace', 'services');

function have(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
const HAS_PY = have('python3', ['--version']);
const HAS_GRPC_PY = HAS_PY && have('python3', ['-c', 'import grpc, google.protobuf']);
const HAS_GO = have('go', ['version']);

let tmp: string;
let server: RunningMockServer;
const roots: Record<'catalog' | 'inventory' | 'orders', string> = { catalog: '', inventory: '', orders: '' };
let stubs: StubResult[] = [];

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-e2e-'));
  server = await startMockServer({
    specs: [path.join(WS, 'catalog', 'openapi.yaml'), path.join(WS, 'inventory', 'schema.graphql'), path.join(WS, 'orders', 'orders.proto')],
    port: 0,
  });
  for (const [dir, spec] of [['catalog', 'openapi.yaml'], ['inventory', 'schema.graphql'], ['orders', 'orders.proto']] as const) {
    const contract = loadContract(path.join(WS, dir, spec));
    const bundle = buildBridgeBundle({ serviceName: dir, contract });
    roots[dir] = path.join(tmp, `${dir}-${contract.protocol}`);
    writeBundle(bundle.files, roots[dir]);
    if (bundle.grpc) stubs = compileGrpcStubs(roots[dir], bundle.grpc, bundle.languages);
  }
}, 240000);

afterAll(async () => {
  await server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Transpile a generated client.ts to CommonJS and load it (node_modules linked for @grpc/*). */
function loadTsClient(root: string): Record<string, any> {
  const dir = path.join(root, 'ts');
  const source = fs.readFileSync(path.join(dir, 'client.ts'), 'utf8');
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  fs.writeFileSync(path.join(dir, 'client.js'), out.outputText);
  let nm = __dirname;
  while (!fs.existsSync(path.join(nm, 'node_modules', '@grpc')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
  if (!fs.existsSync(path.join(dir, 'node_modules'))) fs.symlinkSync(path.join(nm, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  return createRequire(path.join(dir, 'client.js'))(path.join(dir, 'client.js'));
}

/** Async on purpose: the mock server lives in this process, so the event loop must keep serving the child. */
function run(cmd: string, args: string[], cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    execFile(cmd, args, { cwd, encoding: 'utf8', timeout: 380000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GOFLAGS: '-mod=mod' } }, (error, stdout, stderr) => {
      const code = error ? ((error as NodeJS.ErrnoException & { code?: number | string }).code) : 0;
      resolve({ status: typeof code === 'number' ? code : error ? 1 : 0, stdout, stderr: stderr || (error ? String(error.message) : '') });
    });
  });
}

describe('TypeScript clients against the mock server', () => {
  it('REST: typed calls, params, bodies, 204, error mapping', async () => {
    const { CatalogClient, ApiError } = loadTsClient(roots.catalog);
    const client = new CatalogClient({ baseUrl: server.baseUrl });
    const list = await client.listProducts({ limit: 5, tag: ['a', 'b'], 'X-Request-Id': 'rid-1' });
    expect(list.items[0]).toEqual(expect.objectContaining({ id: 'p-1', name: 'Widget', price: 9.99 }));

    const created = await client.createProduct({ name: 'Gadget', price: 3, currency: 'EUR' });
    expect(created.id).toBe('string');
    expect(await client.deleteProduct({ productId: '42' })).toBeUndefined();
    const detail = await client.getProduct({ productId: 'a/b c' });
    expect(detail.description).toBe('string');
    const price = await client.setPrice({ productId: 'p-1' }, { price: 4 });
    expect(price.id).toBe('string');

    const log = (await (await fetch(`${server.baseUrl}/__mock/requests`)).json()) as { call: string }[];
    expect(log.some(r => r.call === 'GET /products?limit=5&tag=a&tag=b')).toBe(true);
    expect(log.some(r => r.call === 'GET /products/a%2Fb%20c')).toBe(true); // path params are escaped

    const failing = new CatalogClient({ baseUrl: server.baseUrl, headers: { Prefer: 'code=404' } });
    await expect(failing.getProduct({ productId: '1' })).rejects.toBeInstanceOf(ApiError);
    await expect(failing.getProduct({ productId: '1' })).rejects.toMatchObject({ status: 404 });
    await expect(client.createProduct({ price: 1 } as never)).rejects.toMatchObject({ status: 400 });
  });

  it('GraphQL: typed operations with generated selection sets', async () => {
    const { InventoryClient, GraphqlError } = loadTsClient(roots.inventory);
    const client = new InventoryClient({ endpoint: server.graphqlUrl });
    const stock = await client.stock({ sku: 'S9' });
    expect(stock).toEqual(expect.objectContaining({ __typename: 'StockLevel', sku: 'S9', quantity: 42, status: 'IN_STOCK' }));
    const adjusted = await client.adjustStock({ input: { sku: 'ABC', delta: 2 } });
    expect(adjusted).toEqual(expect.objectContaining({ sku: 'ABC', quantity: 42 }));
    const warehouses = await client.warehouses();
    expect(warehouses).toHaveLength(2);
    expect(warehouses[0]).toEqual({ id: '1', name: 'name', city: 'city' });

    const broken = new InventoryClient({ execute: async () => { throw new GraphqlError([{ message: 'boom' }]); } });
    await expect(broken.warehouses()).rejects.toThrow('boom');
  });

  it('gRPC: unary + server streaming through @grpc/grpc-js and proto-loader', async () => {
    const { OrderServiceClient } = loadTsClient(roots.orders);
    const client = new OrderServiceClient({ address: server.grpcAddress, metadata: { 'x-correlation-id': 'corr-1' }, deadlineMs: 5000 });
    const order = await client.getOrder({ id: 'o-1' });
    expect(order).toEqual(expect.objectContaining({ id: 'o-1', status: 'PENDING', total_cents: '1' }));
    const created = await client.createOrder({ customer_id: 'c', items: [{ sku: 'x', quantity: 2 }], labels: { a: 'b' } });
    expect(created.items[0].sku).toBe('sku');
    const seen: unknown[] = [];
    for await (const o of client.watchOrders({ max_events: 3 })) seen.push(o);
    expect(seen).toHaveLength(3);

    const log = (await (await fetch(`${server.baseUrl}/__mock/requests`)).json()) as { protocol: string; call: string }[];
    expect(log.some(r => r.protocol === 'grpc' && r.call === 'acme.orders.OrderService/CreateOrder')).toBe(true);
    client.close();
    const dead = new OrderServiceClient({ address: '127.0.0.1:1', deadlineMs: 500 });
    await expect(dead.getOrder({ id: 'x' })).rejects.toBeDefined();
    dead.close();
  });
});

describe.skipIf(!HAS_PY)('Python clients against the mock server', () => {
  it('REST: dataclass models, params, enums, errors', async () => {
    const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(roots.catalog, 'python'))})
from catalog_client import CatalogClient, CreateProduct, Currency, ApiError
base = ${JSON.stringify(server.baseUrl)}
c = CatalogClient(base)
lst = c.list_products(limit=5, tag=["a", "b"], x_request_id="rid-1")
out = {"first": lst.items[0].id, "price": lst.items[0].price, "currency": lst.items[0].currency.value if lst.items[0].currency else None, "next": lst.next_cursor}
p = c.create_product(CreateProduct(name="Gadget", price=3.0, currency=Currency.EUR))
out["created"] = type(p).__name__ + ":" + p.id
d = c.get_product("a/b c")
out["detail"] = [d.description, d.stock, d.created_at]
out["delete"] = c.delete_product("42")
out["price"] = c.set_price("p-1", body=None).id
try:
    CatalogClient(base, headers={"Prefer": "code=404"}).get_product("1")
    out["err"] = None
except ApiError as e:
    out["err"] = e.status
print(json.dumps(out))
`;
    const r = await run('python3', ['-c', script], tmp);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({
      first: 'p-1',
      price: 9.99,
      currency: 'USD',
      next: null,
      created: 'Product:string',
      detail: ['string', 1, '2024-01-01T00:00:00Z'],
      delete: null,
      price: 'string',
      err: 404,
    });
  });

  it('GraphQL: typed results, unions by __typename, input dataclasses', async () => {
    const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(roots.inventory, 'python'))})
from inventory_client import InventoryClient, AdjustInput, StockLevel
c = InventoryClient(${JSON.stringify(server.graphqlUrl)})
s = c.stock("S9")
a = c.adjust_stock(AdjustInput(sku="ABC", delta=2))
w = c.warehouses()
print(json.dumps({"stock": type(s).__name__, "sku": s.sku, "status": s.status.value, "adj": [a.sku, a.quantity], "wh": [x.name for x in w]}))
`;
    const r = await run('python3', ['-c', script], tmp);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ stock: 'StockLevel', sku: 'S9', status: 'IN_STOCK', adj: ['ABC', 42], wh: ['name', 'name'] });
  });

  it.skipIf(!HAS_GRPC_PY)('gRPC: grpcio stubs + typed dataclasses (unary + streaming)', async () => {
    expect(stubs.find(s => s.language === 'python')?.status).toBe('generated');
    const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(roots.orders, 'python'))})
from orders_client import OrderServiceClient, CreateOrderRequest, Item, Order, Status
c = OrderServiceClient(${JSON.stringify(server.grpcAddress)}, metadata={"x-correlation-id": "corr-py"})
o = c.get_order({"id": "o-1"})
made = c.create_order(CreateOrderRequest(customer_id="c", items=[Item(sku="x", quantity=2)], labels={"a": "b"}))
streamed = list(c.watch_orders({"max_events": 3}))
c.close()
print(json.dumps({"id": o.id, "status": o.status.value, "total": o.total_cents, "meta": o.meta.source if o.meta else None, "items": len(made.items), "stream": len(streamed), "t": type(o).__name__}))
`;
    const r = await run('python3', ['-c', script], tmp);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ id: 'o-1', status: 'PENDING', total: 1, meta: 'source', items: 1, stream: 3, t: 'Order' });
  });
});

describe.skipIf(!HAS_GO)('Go clients against the mock server', () => {
  function goRun(root: string, mainSource: string, args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
    const dir = path.join(root, 'go', 'cmd', 'smoke');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'main.go'), mainSource);
    return run('go', ['run', './cmd/smoke', ...args], path.join(root, 'go'));
  }

  it('REST: structs, pointers for optionals, query/header params, APIError', async () => {
    const r = await goRun(
      roots.catalog,
      `package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	catalog "example.com/catalog/client"
)

func main() {
	ctx := context.Background()
	c := catalog.NewClient(os.Args[1])
	limit := int32(5)
	rid := "rid-1"
	list, err := c.ListProducts(ctx, &catalog.ListProductsParams{Limit: &limit, Tag: []string{"a", "b"}, XRequestID: &rid})
	must(err)
	cur := catalog.CurrencyEUR
	created, err := c.CreateProduct(ctx, catalog.CreateProduct{Name: "Gadget", Price: 3, Currency: &cur})
	must(err)
	detail, err := c.GetProduct(ctx, "a/b c")
	must(err)
	must(c.DeleteProduct(ctx, "42"))
	failing := catalog.NewClient(os.Args[1])
	failing.Header = http.Header{"Prefer": []string{"code=404"}}
	_, ferr := failing.GetProduct(ctx, "1")
	var apiErr *catalog.APIError
	status := 0
	if errors.As(ferr, &apiErr) {
		status = apiErr.Status
	}
	out, _ := json.Marshal(map[string]interface{}{"first": list.Items[0].ID, "price": list.Items[0].Price, "created": created.ID, "desc": *detail.Description, "stock": *detail.Stock, "status": status})
	fmt.Println(string(out))
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
`,
      [server.baseUrl as string]
    );
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ first: 'p-1', price: 9.99, created: 'string', desc: 'string', stock: 1, status: 404 });
  }, 400000);

  it('GraphQL: typed args + data decoding', async () => {
    const r = await goRun(
      roots.inventory,
      `package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	inventory "example.com/inventory/client"
)

func main() {
	ctx := context.Background()
	c := inventory.NewClient(os.Args[1])
	stock, err := c.Stock(ctx, inventory.StockArgs{Sku: "S9"})
	must(err)
	adj, err := c.AdjustStock(ctx, inventory.AdjustStockArgs{Input: inventory.AdjustInput{Sku: "ABC", Delta: 2}})
	must(err)
	whs, err := c.Warehouses(ctx, inventory.WarehousesArgs{})
	must(err)
	out, _ := json.Marshal(map[string]interface{}{"stock": json.RawMessage(stock), "sku": adj.Sku, "qty": adj.Quantity, "wh": len(whs)})
	fmt.Println(string(out))
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
`,
      [server.graphqlUrl as string]
    );
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.stock).toEqual(expect.objectContaining({ __typename: 'StockLevel', sku: 'S9', quantity: 42 }));
    expect(out).toEqual(expect.objectContaining({ sku: 'ABC', qty: 42, wh: 2 }));
  }, 400000);

  it.skipIf(!HAS_PY || !findProtoc())('gRPC: protoc-gen-go stubs + typed wrapper', async () => {
    const goStub = stubs.find(s => s.language === 'go');
    if (goStub?.status !== 'generated') {
      // protoc-gen-go / protoc-gen-go-grpc not installed: nothing to run.
      expect(goStub?.status).toBe('skipped');
      return;
    }
    const r = await goRun(
      roots.orders,
      `package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	orders "example.com/orders/client"
	pb "example.com/orders/client/pb"
)

func main() {
	ctx := context.Background()
	c, err := orders.NewOrderServiceClient(os.Args[1])
	must(err)
	defer c.Close()
	c.WithMetadata("x-correlation-id", "corr-go")
	o, err := c.GetOrder(ctx, &pb.GetOrderRequest{Id: "o-1"})
	must(err)
	stream, err := c.WatchOrders(ctx, &pb.WatchRequest{MaxEvents: 3})
	must(err)
	n := 0
	for {
		_, err := stream.Recv()
		if err == io.EOF {
			break
		}
		must(err)
		n++
	}
	out, _ := json.Marshal(map[string]interface{}{"id": o.GetId(), "status": o.GetStatus().String(), "total": o.GetTotalCents(), "stream": n})
	fmt.Println(string(out))
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
`,
      [server.grpcAddress as string]
    );
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ id: 'o-1', status: 'PENDING', total: 1, stream: 3 });
  }, 400000);
});
