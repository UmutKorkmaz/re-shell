import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFile, spawnSync } from 'child_process';
import * as fs from 'fs';
import { createRequire } from 'module';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';
import Redis from 'ioredis';

import { generateAsync } from '../../src/bridge/async/codegen';
import { runAsync } from '../../src/bridge/async/command';
import { loadAsyncContract } from '../../src/bridge/async/spec';
import { writeBundle } from '../../src/bridge/generate';
import { BridgeSpecError } from '../../src/bridge/spec/errors';
import { copyBundle, verifyBundleDir, verifyTypeScript } from '../../src/bridge/verify';
import { dockerAvailable, startContainer, waitFor, type Container } from '../utils/docker';

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'bridge-async', 'async.yaml');

function have(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
const HAS_PY = have('python3', ['--version']);
const HAS_REDIS_PY = HAS_PY && have('python3', ['-c', 'import redis']);
const HAS_MYPY = HAS_PY && have('python3', ['-m', 'mypy', '--version']);

let tmp: string;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-async-'));
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function specFile(yaml: string): string {
  const f = path.join(tmp, `spec-${Math.random().toString(36).slice(2)}.yaml`);
  fs.writeFileSync(f, yaml);
  return f;
}

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    execFile(cmd, args, { cwd, encoding: 'utf8', timeout: 120000, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      const code = error ? (error as NodeJS.ErrnoException & { code?: number | string }).code : 0;
      resolve({ status: typeof code === 'number' ? code : error ? 1 : 0, stdout, stderr });
    });
  });
}

describe('async contract parsing and validation', () => {
  it('parses messages, versions, channels and migration rules', () => {
    const c = loadAsyncContract(FIXTURE);
    expect(c.service).toBe('orders');
    expect(c.messages.map(m => [m.name, m.channel, m.currentVersion])).toEqual([
      ['OrderCreated', 'orders.created', 3],
      ['InvoiceIssued', 'billing.invoice', 1],
      ['ShipmentPlanned', 'shipping.planned', 2],
    ]);
    expect(c.messages[0].versions[1].migrate).toEqual([{ rename: { from: 'amount', to: 'total' } }, { add: { field: 'currency', default: 'USD' } }]);
    expect(c.source.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  const base = (extra: string): string => `service: s\nmessages:\n  Msg:\n${extra}`;
  const cases: [string, string, RegExp][] = [
    ['an upgrade that leaves a required field without a source', base('    versions:\n      1: { fields: { a: string } }\n      2: { fields: { a: string, b: number } }\n'), /field "b" is required but v1 has no source/],
    ['a type change without a convert rule', base('    versions:\n      1: { fields: { a: string } }\n      2: { fields: { a: number } }\n'), /changes type string -> number; add a convert rule/],
    ['optional -> required without a default', base('    versions:\n      1: { fields: { a: "string?" } }\n      2: { fields: { a: string } }\n'), /was optional in v1 but is required in v2/],
    ['non-contiguous versions', base('    versions:\n      1: { fields: { a: string } }\n      3: { fields: { a: string } }\n'), /contiguous/],
    ['a rename of a field that does not exist', base('    versions:\n      1: { fields: { a: string } }\n      2:\n        fields: { b: string }\n        migrate: [ { rename: { from: zzz, to: b } } ]\n'), /rename source "zzz" does not exist/],
    ['an add default of the wrong type', base('    versions:\n      1: { fields: { a: string } }\n      2:\n        fields: { a: string, n: integer }\n        migrate: [ { add: { field: n, default: "x" } } ]\n'), /default for "n" must be an integer/],
    ['an unknown field type', base('    versions:\n      1: { fields: { a: strng } }\n'), /unknown field type "strng"/],
    ['an unknown rule', base('    versions:\n      1: { fields: { a: string } }\n      2:\n        fields: { a: string }\n        migrate: [ { explode: 1 } ]\n'), /unknown rule "explode"/],
    ['currentVersion that is not the newest version', base('    currentVersion: 1\n    versions:\n      1: { fields: { a: string } }\n      2: { fields: { a: string } }\n'), /currentVersion 1 must be the highest/],
    ['a lowercase message name', 'service: s\nmessages:\n  msg:\n    versions:\n      1: { fields: { a: string } }\n', /PascalCase/],
    ['two messages on one channel', 'service: s\nmessages:\n  A:\n    channel: x\n    versions: { 1: { fields: { a: string } } }\n  B:\n    channel: x\n    versions: { 1: { fields: { a: string } } }\n', /channel "x" is already used/],
  ];
  it.each(cases)('rejects %s', (_name, yaml, pattern) => {
    expect(() => loadAsyncContract(specFile(yaml))).toThrow(BridgeSpecError);
    expect(() => loadAsyncContract(specFile(yaml))).toThrow(pattern);
  });

  it('requires a service name and a readable file', () => {
    expect(() => loadAsyncContract(specFile('messages:\n  A:\n    versions: { 1: { fields: { a: string } } }\n'))).toThrow(/missing "service"/);
    expect(loadAsyncContract(specFile('messages:\n  A:\n    versions: { 1: { fields: { a: string } } }\n'), 'fallback').service).toBe('fallback');
    expect(() => loadAsyncContract('/nonexistent/async.yaml')).toThrow(/cannot read/);
  });
});

describe('generated async package (redis-streams, TypeScript + Python)', () => {
  const contract = loadAsyncContract(FIXTURE);
  const { files, warnings } = generateAsync({ contract, transport: 'redis-streams', languages: ['ts', 'python'], registry: { orders: { url: 'http://localhost:9090' }, redis: { url: 'redis://localhost:6379' } } });
  let root: string;

  beforeAll(() => {
    root = path.join(tmp, 'orders-async');
    writeBundle(files, root);
    fs.writeFileSync(path.join(root, '.re-shell-bridge.json'), JSON.stringify({ protocol: 'async' }));
  });

  it('emits the runtime, typed messages, manifests, registry and the contract copy', () => {
    const paths = files.map(f => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'ts/messages.ts', 'ts/index.ts', 'ts/package.json', 'ts/runtime/bus.ts', 'ts/runtime/circuit-breaker.ts', 'ts/runtime/discovery.ts',
        'ts/runtime/evolution.ts', 'ts/runtime/redis-streams.ts', 'ts/runtime/memory-transport.ts',
        'python/orders_messaging/messages.py', 'python/orders_messaging/runtime/core.py', 'python/orders_messaging/runtime/redis_streams.py',
        'python/pyproject.toml', 'services.registry.json', 'async.yaml', 'README.md',
      ])
    );
    expect(paths).not.toContain('ts/runtime/kafka.ts');
    expect(warnings).toEqual([]);
    const messages = files.find(f => f.path === 'ts/messages.ts')!.content;
    expect(messages).toContain('export interface OrderCreatedV1');
    expect(messages).toContain('export type OrderCreated = OrderCreatedV3');
    expect(messages).toContain('upcastOrderCreatedV1ToV2');
    expect(messages).toContain('publishOrderCreated(');
    // runtime is the tested source, verbatim
    expect(files.find(f => f.path === 'ts/runtime/bus.ts')!.content).toBe(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'bridge', 'async', 'runtime', 'bus.ts'), 'utf8'));
  });

  it('TypeScript package compiles under tsc --strict', () => {
    const copy = copyBundle(root);
    const r = verifyTypeScript(copy, 'ts/index.ts');
    fs.rmSync(copy, { recursive: true, force: true });
    expect(r.status, r.detail).toBe('passed');
  }, 120000);

  it.skipIf(!HAS_PY)('Python package passes py_compile', () => {
    const r = verifyBundleDir(root, ['python']).find(x => /py_compile/.test(x.tool))!;
    expect(r.status, r.detail).toBe('passed');
  }, 120000);

  it.skipIf(!HAS_MYPY || !HAS_REDIS_PY)('Python package (runtime included) passes mypy --strict', () => {
    const r = verifyBundleDir(root, ['python']).find(x => /mypy/.test(x.tool))!;
    expect(r.status, r.detail).toBe('passed');
  }, 120000);

  /** Load the generated TypeScript package (transpiled in place). */
  function loadTs(): Record<string, any> {
    const dir = path.join(root, 'ts');
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) {
          fs.writeFileSync(p.replace(/\.ts$/, '.js'), ts.transpileModule(fs.readFileSync(p, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText);
        }
      }
    };
    walk(dir);
    let nm = __dirname;
    while (!fs.existsSync(path.join(nm, 'node_modules', 'ioredis')) && path.dirname(nm) !== nm) nm = path.dirname(nm);
    if (!fs.existsSync(path.join(dir, 'node_modules'))) fs.symlinkSync(path.join(nm, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    return createRequire(path.join(dir, 'index.js'))(path.join(dir, 'index.js'));
  }

  it('generated upcasters implement the migrate rules (v1 -> v2 -> v3, convert/remove)', () => {
    const m = loadTs();
    expect(m.upcastOrderCreatedV1ToV2({ orderId: 'a', amount: 5 })).toEqual({ orderId: 'a', total: 5, currency: 'USD' });
    expect(m.upcastOrderCreatedV2ToV3({ orderId: 'a', total: 5, currency: 'EUR' })).toEqual({ orderId: 'a', total: 5, currency: 'EUR', quantity: 1 });
    expect(m.upcastShipmentPlannedV1ToV2({ orderId: 'o', weight: '12.5', legacy: { x: 1 } })).toEqual({ orderId: 'o', weight: 12.5 });
  });

  it('typed producers/consumers round-trip a correlation id over the in-memory transport, upcasting old versions', async () => {
    const m = loadTs();
    const transport = new m.MemoryTransport();
    const bus = new m.MessageBus({ transport, service: 'orders' });
    const messaging = new m.OrdersMessaging(bus);
    const got: any[] = [];
    await messaging.onOrderCreated('billing', async (p: unknown, env: any) => { got.push({ p, env }); });
    const sent = await messaging.publishOrderCreated({ orderId: 'o1', total: 4.5, currency: 'EUR', quantity: 2 }, { correlationId: 'corr-gen-1' });
    // an old v1 producer
    const legacy = m.createEnvelope({ type: 'OrderCreated', schemaVersion: 1, correlationId: 'corr-old', traceparent: m.formatTraceparent(m.newTraceContext()), source: 'legacy', payload: { orderId: 'o0', amount: 9 } });
    await transport.publish('orders.created', m.encodeEnvelope(legacy), m.envelopeHeaders(legacy));
    await transport.idle();
    expect(got).toHaveLength(2);
    expect(got[0].env.correlationId).toBe('corr-gen-1');
    expect(got[0].env.id).toBe(sent.id);
    expect(got[0].p).toEqual({ orderId: 'o1', total: 4.5, currency: 'EUR', quantity: 2 });
    expect(got[1].p).toEqual({ orderId: 'o0', total: 9, currency: 'USD', quantity: 1 }); // v1 -> v3
    expect(got[1].env.correlationId).toBe('corr-old');
    await expect(messaging.publishOrderCreated({ orderId: 1 } as never)).rejects.toThrow(/payload is invalid/);
  });

  describe.skipIf(!dockerAvailable())('over a real Redis (docker redis:7)', () => {
    let container: Container;
    let url: string;
    let admin: Redis;
    beforeAll(async () => {
      container = await startContainer({ image: 'redis:7', containerPort: 6379 });
      url = `redis://127.0.0.1:${container.port}`;
      admin = new Redis(url, { maxRetriesPerRequest: null });
      await waitFor(async () => { await admin.ping(); }, 30000, 'redis');
    }, 120000);
    afterAll(async () => {
      admin?.disconnect();
      container?.stop();
    });

    async function until(cond: () => boolean, ms = 20000, what = 'condition'): Promise<void> {
      const deadline = Date.now() + ms;
      while (!cond()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise(r => setTimeout(r, 50));
      }
    }

    it('a generated TypeScript stub round-trips a message with its correlation id (connectBus + discovery)', async () => {
      const m = loadTs();
      // broker address found through discovery: env REDIS_URL
      const prev = process.env.REDIS_URL;
      process.env.REDIS_URL = url;
      const producerBus = await m.connectBus({ service: 'orders' });
      const consumerBus = await m.connectBus({ service: 'billing' });
      if (prev === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prev;
      const got: any[] = [];
      await new m.OrdersMessaging(consumerBus).onOrderCreated('billing-gen', async (p: unknown, env: unknown) => { got.push({ p, env }); });
      const sent = await new m.OrdersMessaging(producerBus).publishOrderCreated({ orderId: 'r1', total: 10, currency: 'USD', quantity: 1 }, { correlationId: 'gen-redis-1' });
      await until(() => got.length === 1, 20000, 'delivery');
      expect(got[0].env.correlationId).toBe('gen-redis-1');
      expect(got[0].env.traceparent).toBe(sent.traceparent);
      expect(got[0].p.orderId).toBe('r1');
      await producerBus.close();
      await consumerBus.close();
    }, 90000);

    it.skipIf(!HAS_REDIS_PY)('cross-language: TypeScript produces, Python consumes (and back) with the correlation id and trace intact', async () => {
      const m = loadTs();
      const tsBus = await m.connectBus({ url, service: 'ts-orders' });
      const tsGot: any[] = [];
      const messaging = new m.OrdersMessaging(tsBus);
      await messaging.onInvoiceIssued('ts-billing', async (p: unknown, env: unknown) => { tsGot.push({ p, env }); });

      // Python: consume OrderCreated (v1 produced by TS is upcast), then publish InvoiceIssued within the handler
      const script = `
import json, sys, time
sys.path.insert(0, ${JSON.stringify(path.join(root, 'python'))})
from orders_messaging import connect_bus, OrdersMessaging
bus = connect_bus(service="py-billing", url=${JSON.stringify(url)})
m = OrdersMessaging(bus)
seen = []
def handler(payload, env):
    seen.append({"payload": payload, "correlationId": env["correlationId"], "traceparent": env["traceparent"], "id": env["id"], "version": env["schemaVersion"]})
    m.publish_invoice_issued({"orderId": payload["orderId"], "invoiceId": "inv-" + payload["orderId"]})
m.on_order_created("py-group", handler)
print("READY", flush=True)
deadline = time.time() + 30
while not seen and time.time() < deadline:
    time.sleep(0.1)
time.sleep(1.0)
bus.close()
print(json.dumps(seen))
`;
      // Wait for Python to print READY (its consumer group exists) instead of sleeping: deterministic under load.
      let ready!: () => void;
      const readyPromise = new Promise<void>(r => (ready = r));
      const child = new Promise<{ status: number; stdout: string; stderr: string }>(resolve => {
        const proc = execFile('python3', ['-c', script], { cwd: tmp, encoding: 'utf8', timeout: 120000, env: process.env }, (error, stdout, stderr) => {
          const code = error ? (error as NodeJS.ErrnoException & { code?: number | string }).code : 0;
          resolve({ status: typeof code === 'number' ? code : error ? 1 : 0, stdout, stderr });
        });
        proc.stdout?.on('data', (d: string) => { if (String(d).includes('READY')) ready(); });
      });
      await Promise.race([readyPromise, child.then(r => { throw new Error(`python exited before READY: ${r.stderr}`); })]);
      const sent = await messaging.publishOrderCreated({ orderId: 'x1', total: 3, currency: 'EUR', quantity: 4 }, { correlationId: 'cross-lang-1' });
      const res = await child;
      expect(res.status, res.stderr).toBe(0);
      const seen = JSON.parse(res.stdout.split('\n').filter(l => l.startsWith('['))[0]);
      expect(seen).toHaveLength(1);
      expect(seen[0].correlationId).toBe('cross-lang-1'); // TS -> Python
      expect(seen[0].id).toBe(sent.id);
      expect(seen[0].payload).toEqual({ orderId: 'x1', total: 3, currency: 'EUR', quantity: 4 });
      expect(seen[0].traceparent).toBe(sent.traceparent);

      await until(() => tsGot.length === 1, 20000, 'python -> ts delivery');
      const back = tsGot[0].env;
      expect(back.correlationId).toBe('cross-lang-1'); // ... and Python -> TS, same flow
      expect(back.causationId).toBe(sent.id);
      expect(back.source).toBe('py-billing');
      expect(back.traceparent.split('-')[1]).toBe(sent.traceparent.split('-')[1]); // same trace-id
      expect(back.traceparent).not.toBe(sent.traceparent);
      await tsBus.close();
    }, 120000);
  });

  it.skipIf(!HAS_PY)('Python runtime: breaker, retry, discovery, upcasting and DLQ behave like the TypeScript runtime (memory transport)', async () => {
    const script = `
import json, sys, time
sys.path.insert(0, ${JSON.stringify(path.join(root, 'python'))})
from orders_messaging.runtime import MemoryTransport, MessageBus, CircuitBreaker, CircuitOpenError, ServiceDiscovery, ServiceNotFoundError, RetryExhaustedError, retry, dead_letter_channel
from orders_messaging.runtime.core import decode_envelope, create_envelope, encode_envelope, envelope_headers, format_traceparent, new_trace_context
from orders_messaging.messages import ORDER_CREATED, INVOICE_ISSUED
out = {}
# breaker
t = [0.0]
trans = []
b = CircuitBreaker("db", failure_threshold=2, reset_timeout_ms=1000, now=lambda: t[0], on_state_change=lambda to, frm, n: trans.append(frm + "->" + to))
def boom(): raise RuntimeError("x")
for _ in range(2):
    try: b.execute(boom)
    except RuntimeError: pass
try: b.execute(lambda: 1)
except CircuitOpenError: out["failfast"] = True
t[0] = 1.0
out["probe"] = b.execute(lambda: "ok")
out["transitions"] = trans
# retry
calls = []
def flaky(n):
    calls.append(n)
    if n < 3: raise RuntimeError("f")
    return "done"
out["retry"] = [retry(flaky, max_attempts=5, sleep=lambda s: None), calls]
try: retry(lambda n: (_ for _ in ()).throw(RuntimeError("always")), max_attempts=2, sleep=lambda s: None)
except RetryExhaustedError as e: out["exhausted"] = e.attempts
# discovery
d = ServiceDiscovery(env={"ORDERS_URL": "http://env:1"}, read_file=lambda p: json.dumps({"services": {"billing": {"url": "http://reg:2"}}}))
out["disc"] = [d.resolve("orders").source, d.resolve("billing").url]
try: d.resolve("ghost")
except ServiceNotFoundError: out["notfound"] = True
srv = ServiceDiscovery(env={}, srv_domain="x.test", read_file=lambda p: (_ for _ in ()).throw(OSError()), resolve_srv=lambda n: [{"name": "a", "port": 1, "priority": 20, "weight": 1}, {"name": "b", "port": 2, "priority": 10, "weight": 1}])
out["srv"] = [e.host for e in srv.resolve_all("svc")]
# bus: upcast v1, invalid payload -> DLQ, handler retry -> DLQ
transport = MemoryTransport()
bus = MessageBus(transport, "py", sleep=lambda s: None, handler_attempts=2)
got = []
bus.subscribe(ORDER_CREATED, "g", lambda p, e: got.append(p))
legacy = create_envelope(type="OrderCreated", schema_version=1, correlation_id="old", traceparent=format_traceparent(new_trace_context()), source="legacy", payload={"orderId": "o", "amount": 3})
transport.publish("orders.created", encode_envelope(legacy), envelope_headers(legacy))
bad = create_envelope(type="OrderCreated", schema_version=3, correlation_id="bad", traceparent=format_traceparent(new_trace_context()), source="s", payload={"orderId": 5})
transport.publish("orders.created", encode_envelope(bad), envelope_headers(bad))
def failing(p, e): raise RuntimeError("nope")
bus.subscribe(INVOICE_ISSUED, "g", failing)
bus.publish(INVOICE_ISSUED, {"orderId": "o", "invoiceId": "i"}, correlation_id="inv-flow")
deadline = time.time() + 10
while (len(got) < 1 or len(transport.published(dead_letter_channel("orders.created"))) < 1 or len(transport.published(dead_letter_channel("billing.invoice"))) < 1) and time.time() < deadline:
    time.sleep(0.05)
out["got"] = got
out["dlq"] = [json.loads(m.body)["payload"]["reason"] for m in transport.published("orders.created.dlq")] + [json.loads(m.body)["payload"]["reason"] + ":" + str(json.loads(m.body)["payload"]["attempts"]) for m in transport.published("billing.invoice.dlq")]
out["dlq_corr"] = json.loads(transport.published("billing.invoice.dlq")[0].body)["correlationId"]
bus.close()
print(json.dumps(out))
`;
    const r = await run('python3', ['-c', script], tmp);
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.failfast).toBe(true);
    expect(out.probe).toBe('ok');
    expect(out.transitions).toEqual(['closed->open', 'open->half-open', 'half-open->closed']);
    expect(out.retry).toEqual(['done', [1, 2, 3]]);
    expect(out.exhausted).toBe(2);
    expect(out.disc).toEqual(['env', 'http://reg:2']);
    expect(out.notfound).toBe(true);
    expect(out.srv).toEqual(['b', 'a']);
    expect(out.got).toEqual([{ orderId: 'o', total: 3, currency: 'USD', quantity: 1 }]);
    expect(out.dlq).toEqual(['invalid-payload', 'handler-failed:2']);
    expect(out.dlq_corr).toBe('inv-flow');
  }, 60000);
});

describe('async: kafka output and command layer', () => {
  it('kafka output ships the kafkajs transport, TypeScript only, and warns for Python', () => {
    const contract = loadAsyncContract(FIXTURE);
    const { files, warnings } = generateAsync({ contract, transport: 'kafka', languages: ['ts', 'python'] });
    const paths = files.map(f => f.path);
    expect(paths).toContain('ts/runtime/kafka.ts');
    expect(paths).not.toContain('ts/runtime/redis-streams.ts');
    expect(JSON.parse(files.find(f => f.path === 'ts/package.json')!.content).dependencies).toEqual({ kafkajs: '^2.2.4' });
    expect(files.find(f => f.path === 'ts/index.ts')!.content).toContain('KafkaTransport');
    expect(warnings[0]).toMatch(/no Kafka transport/);
  });

  it('kafka TypeScript package compiles under tsc --strict', () => {
    const contract = loadAsyncContract(FIXTURE);
    const { files } = generateAsync({ contract, transport: 'kafka', languages: ['ts'] });
    const root = path.join(tmp, 'kafka-out');
    writeBundle(files, root);
    const copy = copyBundle(root);
    const r = verifyTypeScript(copy, 'ts/index.ts');
    fs.rmSync(copy, { recursive: true, force: true });
    expect(r.status, r.detail).toBe('passed');
  }, 120000);

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

  it('--json: ok envelope with artifacts; --dry-run writes nothing; the registry comes from the workspace', async () => {
    process.exitCode = 0;
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-async-ws-'));
    fs.cpSync(path.join(__dirname, '..', 'fixtures', 'bridge-workspace'), ws, { recursive: true });
    fs.copyFileSync(FIXTURE, path.join(ws, 'async.yaml'));
    const env = await capture<{ ok: boolean; data: { transport: string; messages: { name: string }[]; artifacts: { path: string; content: string }[]; written: string[] } }>(() =>
      runAsync({ transport: 'redis-streams', cwd: ws, out: 'gen', dryRun: true, lang: 'ts', json: true })
    );
    expect(env.ok).toBe(true);
    expect(env.data.messages.map(m => m.name)).toEqual(['OrderCreated', 'InvoiceIssued', 'ShipmentPlanned']);
    expect(env.data.written).toEqual([]);
    expect(fs.existsSync(path.join(ws, 'gen'))).toBe(false);
    const registry = JSON.parse(env.data.artifacts.find(a => a.path === 'services.registry.json')!.content);
    expect(registry.services.catalog.url).toBe('http://localhost:8081');
    expect(registry.services.redis.url).toBe('redis://localhost:6379');
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it('--out writes the package; failures are BRIDGE_ASYNC_ERROR / BRIDGE_SPEC_ERROR with exit 1; --init scaffolds a valid contract', async () => {
    process.exitCode = 0;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-async-cmd-'));
    const noTransport = await capture<{ ok: boolean; error: { code: string } }>(() => runAsync({ cwd: dir, json: true }));
    expect(noTransport.error.code).toBe('BRIDGE_SPEC_ERROR');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    const noSpec = await capture<{ ok: boolean; error: { code: string; message: string } }>(() => runAsync({ transport: 'kafka', cwd: dir, json: true }));
    expect(noSpec.error.message).toMatch(/no async contract found/);
    process.exitCode = 0;

    const init = await capture<{ ok: boolean; data: { initialized: string } }>(() => runAsync({ init: true, cwd: dir, json: true }));
    expect(init.ok).toBe(true);
    expect(loadAsyncContract(init.data.initialized).messages[0].name).toBe('OrderCreated'); // the starter is itself valid
    const again = await capture<{ ok: boolean; error: { message: string } }>(() => runAsync({ init: true, cwd: dir, json: true }));
    expect(again.error.message).toMatch(/already exists/);
    process.exitCode = 0;

    const written = await capture<{ ok: boolean; data: { written: string[]; verification: { language: string; status: string }[] } }>(() =>
      runAsync({ transport: 'redis-streams', cwd: dir, out: 'out', lang: 'ts', verify: true, json: true })
    );
    expect(written.ok).toBe(true);
    expect(fs.existsSync(path.join(dir, 'out', 'orders-async-redis-streams', 'ts', 'messages.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'out', 'orders-async-redis-streams', '.re-shell-bridge.json'))).toBe(true);
    expect(written.data.verification).toEqual([expect.objectContaining({ language: 'ts', status: 'passed' })]);
    fs.rmSync(dir, { recursive: true, force: true });
  }, 120000);
});
