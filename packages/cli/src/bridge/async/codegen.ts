// Async transport code generation: typed producers/consumers (TypeScript and
// Python) over the shared runtime, with envelopes, version upcasters and
// service discovery. The runtime sources shipped in the CLI are copied verbatim
// into the output, so the tested code is exactly the generated code.

import * as fs from 'fs';
import * as path from 'path';

import type { ClientFile } from '../codegen/common';
import { toPascal, toSnake } from '../naming';
import { BridgeSpecError } from '../spec/errors';
import { versionTypeName, type AsyncContract, type AsyncMessage, type AsyncVersion, type MigrateRule } from './spec';

/** Supported broker transports. */
export type AsyncTransport = 'kafka' | 'redis-streams';

/** Client languages with an async runtime. */
export type AsyncLanguage = 'ts' | 'python';

const TS_RUNTIME_COMMON = [
  'trace.ts', 'envelope.ts', 'context.ts', 'evolution.ts', 'circuit-breaker.ts', 'retry.ts',
  'discovery.ts', 'transport.ts', 'memory-transport.ts', 'bus.ts', 'index.ts',
];

function readDirFirst(candidates: string[], what: string): string {
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'trace.ts')) || fs.existsSync(path.join(dir, 'core.py'))) return dir;
  }
  throw new BridgeSpecError(`async runtime sources for ${what} not found (looked in ${candidates.join(', ')})`);
}

/** Directory holding the TypeScript runtime sources (src layout, or dist/runtime-src). */
export function tsRuntimeDir(): string {
  return readDirFirst([path.join(__dirname, 'runtime-src'), path.join(__dirname, 'runtime')], 'TypeScript');
}

/** Directory holding the Python runtime sources. */
export function pyRuntimeDir(): string {
  return readDirFirst([path.join(__dirname, 'runtime-src-py'), path.join(__dirname, 'runtime-py')], 'Python');
}

function tsFieldType(spec: string): string {
  let s = spec.trim();
  const opt = s.endsWith('?');
  if (opt) s = s.slice(0, -1);
  let arrays = 0;
  while (s.endsWith('[]')) {
    s = s.slice(0, -2);
    arrays++;
  }
  const en = /^enum\((.*)\)$/.exec(s);
  let t: string;
  if (en) t = en[1].split('|').map(v => JSON.stringify(v)).join(' | ');
  else
    t =
      s === 'string' || s === 'datetime' ? 'string' : s === 'number' || s === 'integer' ? 'number' : s === 'boolean' ? 'boolean' : s === 'object' ? 'Record<string, unknown>' : 'unknown';
  if (arrays > 0) t = `(${t})` + '[]'.repeat(arrays);
  return opt ? `${t} | null` : t;
}

function isOptional(spec: string): boolean {
  return spec.trim().endsWith('?');
}

function tsInterface(name: string, fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([f, spec]) => `  ${f}${isOptional(spec) ? '?' : ''}: ${tsFieldType(spec)};`);
  return `export interface ${name} {\n${lines.join('\n')}\n}`;
}

function schemaLiteral(fields: Record<string, string>): string {
  return `{ ${Object.entries(fields).map(([f, spec]) => `${f}: ${JSON.stringify(spec)}`).join(', ')} }`;
}

function tsRule(rule: MigrateRule): string {
  if ('rename' in rule) return `  out[${JSON.stringify(rule.rename.to)}] = out[${JSON.stringify(rule.rename.from)}];\n  delete out[${JSON.stringify(rule.rename.from)}];`;
  if ('copy' in rule) return `  out[${JSON.stringify(rule.copy.to)}] = out[${JSON.stringify(rule.copy.from)}];`;
  if ('add' in rule) return `  if (out[${JSON.stringify(rule.add.field)}] === undefined || out[${JSON.stringify(rule.add.field)}] === null) out[${JSON.stringify(rule.add.field)}] = ${JSON.stringify(rule.add.default)};`;
  if ('remove' in rule) return `  delete out[${JSON.stringify(rule.remove)}];`;
  const f = JSON.stringify(rule.convert.field);
  const conv =
    rule.convert.to === 'string' ? `String(out[${f}])` : rule.convert.to === 'number' ? `Number(out[${f}])` : rule.convert.to === 'integer' ? `Math.trunc(Number(out[${f}]))` : `Boolean(out[${f}])`;
  return `  if (out[${f}] !== undefined && out[${f}] !== null) out[${f}] = ${conv};`;
}

function tsUpcaster(m: AsyncMessage, prev: AsyncVersion, next: AsyncVersion): string {
  const fn = `upcast${toPascal(m.name)}V${prev.version}ToV${next.version}`;
  return `export function ${fn}(payload: ${versionTypeName(m.name, prev.version)}): ${versionTypeName(m.name, next.version)} {
  const out: Record<string, unknown> = { ...(payload as unknown as Record<string, unknown>) };
${next.migrate.map(tsRule).join('\n')}${next.migrate.length ? '\n' : ''}  const next: Record<string, unknown> = {};
  for (const key of ${JSON.stringify(Object.keys(next.fields))}) if (out[key] !== undefined) next[key] = out[key];
  return next as unknown as ${versionTypeName(m.name, next.version)};
}`;
}

function tsMessages(contract: AsyncContract): string {
  const svc = toPascal(contract.service);
  const blocks: string[] = [];
  const members: string[] = [];
  for (const m of contract.messages) {
    const cur = m.versions[m.versions.length - 1];
    for (const v of m.versions) blocks.push(tsInterface(versionTypeName(m.name, v.version), v.fields));
    blocks.push(`/** Current shape of ${m.name} (v${m.currentVersion}). */\nexport type ${toPascal(m.name)} = ${versionTypeName(m.name, cur.version)};`);
    const upcasters: string[] = [];
    for (let i = 1; i < m.versions.length; i++) {
      blocks.push(tsUpcaster(m, m.versions[i - 1], m.versions[i]));
      upcasters.push(`${m.versions[i - 1].version}: upcast${toPascal(m.name)}V${m.versions[i - 1].version}ToV${m.versions[i].version} as (payload: any) => any`);
    }
    blocks.push(`export const ${toPascal(m.name)}Message = defineMessage<${toPascal(m.name)}>({
  type: ${JSON.stringify(m.name)},
  channel: ${JSON.stringify(m.channel)},
  currentVersion: ${m.currentVersion},
  schema: ${schemaLiteral(cur.fields)},
  upcasters: { ${upcasters.join(', ')} },
});`);
    const P = toPascal(m.name);
    members.push(`  /** Publish ${m.name} (validated, enveloped, retried behind a circuit breaker). */
  publish${P}(payload: ${P}, options?: PublishOptions): Promise<Envelope<${P}>> {
    return this.bus.publish(${P}Message, payload, options);
  }

  /** Consume ${m.name}: older versions are upcast; failures are retried, then dead-lettered to ${m.channel}.dlq. */
  on${P}(group: string, handler: TypedHandler<${P}>, options?: SubscriptionOptions): Promise<Subscription> {
    return this.bus.subscribe(${P}Message, group, handler, options);
  }`);
  }
  return `// Code generated by re-shell service bridge async. DO NOT EDIT.
/* eslint-disable */
import {
  defineMessage,
  type Envelope,
  type MessageBus,
  type PublishOptions,
  type Subscription,
  type SubscriptionOptions,
  type TypedHandler,
} from './runtime';

${blocks.join('\n\n')}

/** Typed producers and consumers for the ${contract.service} service. */
export class ${svc}Messaging {
  constructor(readonly bus: MessageBus) {}

${members.join('\n\n')}
}
`;
}

function tsIndex(contract: AsyncContract, transport: AsyncTransport): string {
  const connect =
    transport === 'kafka'
      ? `import { KafkaTransport } from './runtime/kafka';

/**
 * Connect a bus over Kafka. The broker list comes from \`options.brokers\`, else service
 * discovery of "kafka" (env KAFKA_URL / services.registry.json / DNS SRV).
 */
export async function connectBus(options: ConnectOptions & { brokers?: string[] } = {}): Promise<MessageBus> {
  let brokers = options.brokers;
  if (!brokers) {
    const endpoints = await (options.discovery ?? new ServiceDiscovery()).resolveAll('kafka');
    brokers = endpoints.map(e => (e.url ?? \`\${e.host}:\${e.port}\`).replace(/^[a-z]+:\\/\\//, ''));
  }
  const { discovery: _d, brokers: _b, service, ...bus } = options;
  return new MessageBus({ transport: new KafkaTransport({ brokers, clientId: service ?? ${JSON.stringify(contract.service)} }), service: service ?? ${JSON.stringify(contract.service)}, ...bus });
}`
      : `import { RedisStreamsTransport } from './runtime/redis-streams';

/**
 * Connect a bus over Redis Streams. The URL comes from \`options.url\`, else service
 * discovery of "redis" (env REDIS_URL / services.registry.json / DNS SRV).
 */
export async function connectBus(options: ConnectOptions & { url?: string } = {}): Promise<MessageBus> {
  let url = options.url;
  if (!url) {
    const e = await (options.discovery ?? new ServiceDiscovery()).resolve('redis');
    url = e.url ?? \`redis://\${e.host}:\${e.port ?? 6379}\`;
  }
  const { discovery: _d, url: _u, service, ...bus } = options;
  return new MessageBus({ transport: new RedisStreamsTransport({ url }), service: service ?? ${JSON.stringify(contract.service)}, ...bus });
}`;
  return `// Code generated by re-shell service bridge async. DO NOT EDIT.
/* eslint-disable */
import { MessageBus, ServiceDiscovery, type BusOptions } from './runtime';

export * from './runtime';
export * from './messages';

/** Options common to connectBus. */
export type ConnectOptions = Partial<Omit<BusOptions, 'transport'>> & { discovery?: ServiceDiscovery };

${connect}
`;
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

function pyLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pyLiteral).join(', ')}]`;
  return `{${Object.entries(value as Record<string, unknown>).map(([k, v]) => `${JSON.stringify(k)}: ${pyLiteral(v)}`).join(', ')}}`;
}

function pyFieldType(spec: string): string {
  let s = spec.trim();
  if (s.endsWith('?')) s = s.slice(0, -1);
  let arrays = 0;
  while (s.endsWith('[]')) {
    s = s.slice(0, -2);
    arrays++;
  }
  const en = /^enum\((.*)\)$/.exec(s);
  let t = en
    ? `Literal[${en[1].split('|').map(v => JSON.stringify(v)).join(', ')}]`
    : s === 'string' || s === 'datetime' ? 'str' : s === 'number' ? 'float' : s === 'integer' ? 'int' : s === 'boolean' ? 'bool' : s === 'object' ? 'Dict[str, Any]' : 'Any';
  for (let i = 0; i < arrays; i++) t = `List[${t}]`;
  return t;
}

function pyTypedDict(name: string, fields: Record<string, string>): string {
  const req = Object.entries(fields).filter(([, s]) => !isOptional(s));
  const opt = Object.entries(fields).filter(([, s]) => isOptional(s));
  const lines = (list: [string, string][], optional: boolean): string =>
    list.map(([f, s]) => `    ${f}: ${optional ? `Optional[${pyFieldType(s)}]` : pyFieldType(s)}`).join('\n') || '    pass';
  if (opt.length === 0) return `class ${name}(TypedDict):\n${lines(req, false)}`;
  return `class _${name}Required(TypedDict):\n${lines(req, false)}\n\n\nclass ${name}(_${name}Required, total=False):\n${lines(opt, true)}`;
}

function pyRule(rule: MigrateRule): string {
  if ('rename' in rule) return `    out[${JSON.stringify(rule.rename.to)}] = out.pop(${JSON.stringify(rule.rename.from)}, None)`;
  if ('copy' in rule) return `    out[${JSON.stringify(rule.copy.to)}] = out.get(${JSON.stringify(rule.copy.from)})`;
  if ('add' in rule) return `    if out.get(${JSON.stringify(rule.add.field)}) is None:\n        out[${JSON.stringify(rule.add.field)}] = ${pyLiteral(rule.add.default)}`;
  if ('remove' in rule) return `    out.pop(${JSON.stringify(rule.remove)}, None)`;
  const f = JSON.stringify(rule.convert.field);
  const conv = rule.convert.to === 'string' ? `str(out[${f}])` : rule.convert.to === 'number' ? `float(out[${f}])` : rule.convert.to === 'integer' ? `int(float(out[${f}]))` : `bool(out[${f}])`;
  return `    if out.get(${f}) is not None:\n        out[${f}] = ${conv}`;
}

function pyMessages(contract: AsyncContract): string {
  const svc = toPascal(contract.service);
  const blocks: string[] = [];
  const members: string[] = [];
  for (const m of contract.messages) {
    const P = toPascal(m.name);
    const S = toSnake(m.name);
    const cur = m.versions[m.versions.length - 1];
    for (const v of m.versions) blocks.push(pyTypedDict(versionTypeName(m.name, v.version), v.fields));
    blocks.push(`${P} = ${versionTypeName(m.name, cur.version)}`);
    const ups: string[] = [];
    for (let i = 1; i < m.versions.length; i++) {
      const prev = m.versions[i - 1];
      const next = m.versions[i];
      const fn = `upcast_${S}_v${prev.version}_to_v${next.version}`;
      blocks.push(`def ${fn}(payload: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = dict(payload)
${next.migrate.map(pyRule).join('\n')}${next.migrate.length ? '\n' : ''}    return {k: out[k] for k in ${pyLiteral(Object.keys(next.fields))} if k in out}`);
      ups.push(`${prev.version}: ${fn}`);
    }
    blocks.push(`${S.toUpperCase()} = MessageDefinition(
    type=${JSON.stringify(m.name)},
    channel=${JSON.stringify(m.channel)},
    current_version=${m.currentVersion},
    schema=${pyLiteral(cur.fields)},
    upcasters={${ups.join(', ')}},
)`);
    members.push(`    def publish_${S}(self, payload: ${P}, correlation_id: Optional[str] = None, key: Optional[str] = None) -> Envelope:
        """Publish ${m.name} (validated, enveloped, retried behind a circuit breaker)."""
        return self.bus.publish(${S.toUpperCase()}, cast(Dict[str, Any], payload), correlation_id=correlation_id, key=key)

    def on_${S}(self, group: str, handler: Callable[[${P}, Envelope], None], start_from: str = "latest") -> Subscription:
        """Consume ${m.name}: older versions are upcast; failures are retried, then dead-lettered to ${m.channel}.dlq."""
        return self.bus.subscribe(${S.toUpperCase()}, group, cast(Callable[[Dict[str, Any], Envelope], None], handler), start_from)`);
  }
  return `# Code generated by re-shell service bridge async. DO NOT EDIT.
from __future__ import annotations

from typing import Any, Callable, Dict, List, Literal, Optional, TypedDict, cast

from .runtime import Envelope, MessageBus, MessageDefinition, ServiceDiscovery, Subscription


${blocks.join('\n\n\n')}


class ${svc}Messaging:
    """Typed producers and consumers for the ${contract.service} service."""

    def __init__(self, bus: MessageBus) -> None:
        self.bus = bus

${members.join('\n\n')}
`;
}

function pyConnect(contract: AsyncContract, transport: AsyncTransport): string {
  if (transport === 'kafka') {
    return `# Code generated by re-shell service bridge async. DO NOT EDIT.
"""The Python runtime ships the in-memory and Redis Streams transports only; Kafka is
provided by the TypeScript runtime. Use redis-streams, or consume Kafka from TypeScript."""

from .messages import *  # noqa: F401,F403
`;
  }
  return `# Code generated by re-shell service bridge async. DO NOT EDIT.
from __future__ import annotations

from typing import Any, Optional

from .messages import *  # noqa: F401,F403
from .runtime import MessageBus, ServiceDiscovery
from .runtime.redis_streams import RedisStreamsTransport


def connect_bus(service: str = ${JSON.stringify(contract.service)}, url: Optional[str] = None, discovery: Optional[ServiceDiscovery] = None, **bus_options: Any) -> MessageBus:
    """Connect a bus over Redis Streams; the URL comes from \`url\`, else discovery of "redis"
    (env REDIS_URL / services.registry.json / DNS SRV)."""
    if url is None:
        endpoint = (discovery or ServiceDiscovery()).resolve("redis")
        url = endpoint.url or f"redis://{endpoint.host}:{endpoint.port or 6379}"
    return MessageBus(RedisStreamsTransport(url=url), service, **bus_options)
`;
}

/** Inputs of {@link generateAsync}. */
export interface AsyncGenerateInput {
  contract: AsyncContract;
  transport: AsyncTransport;
  languages: AsyncLanguage[];
  /** services.registry.json content, when a workspace was available. */
  registry?: Record<string, { url: string }>;
}

/**
 * Generate the async package.
 * @throws BridgeSpecError when Python is requested for Kafka (no Python Kafka runtime is shipped).
 */
export function generateAsync(input: AsyncGenerateInput): { files: ClientFile[]; warnings: string[] } {
  const { contract, transport, languages } = input;
  const files: ClientFile[] = [];
  const warnings: string[] = [];

  if (languages.includes('ts')) {
    const dir = tsRuntimeDir();
    const names = [...TS_RUNTIME_COMMON, transport === 'kafka' ? 'kafka.ts' : 'redis-streams.ts'];
    for (const n of names) files.push({ path: `ts/runtime/${n}`, content: fs.readFileSync(path.join(dir, n), 'utf8'), kind: 'support' });
    files.push({ path: 'ts/messages.ts', content: tsMessages(contract), kind: 'ts-client' });
    files.push({ path: 'ts/index.ts', content: tsIndex(contract, transport), kind: 'ts-client' });
    files.push({
      path: 'ts/package.json',
      content:
        JSON.stringify(
          {
            name: `${contract.service}-messaging`,
            version: '0.1.0',
            main: 'dist/index.js',
            types: 'dist/index.d.ts',
            scripts: { build: 'tsc -p tsconfig.json' },
            dependencies: transport === 'kafka' ? { kafkajs: '^2.2.4' } : { ioredis: '>=5.4.0' },
            devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
          },
          null,
          2
        ) + '\n',
      kind: 'manifest',
    });
    files.push({
      path: 'ts/tsconfig.json',
      content:
        JSON.stringify(
          { compilerOptions: { target: 'ES2020', module: 'CommonJS', moduleResolution: 'node', strict: true, declaration: true, outDir: 'dist', skipLibCheck: true, esModuleInterop: true, types: ['node'] }, include: ['index.ts'] },
          null,
          2
        ) + '\n',
      kind: 'manifest',
    });
  }

  if (languages.includes('python')) {
    const pkg = `${toSnake(contract.service)}_messaging`;
    const dir = pyRuntimeDir();
    for (const n of ['__init__.py', 'core.py', 'memory.py', ...(transport === 'redis-streams' ? ['redis_streams.py'] : [])]) {
      files.push({ path: `python/${pkg}/runtime/${n}`, content: fs.readFileSync(path.join(dir, n), 'utf8'), kind: 'support' });
    }
    files.push({ path: `python/${pkg}/messages.py`, content: pyMessages(contract), kind: 'python-client' });
    files.push({ path: `python/${pkg}/__init__.py`, content: pyConnect(contract, transport), kind: 'python-client' });
    files.push({ path: `python/${pkg}/py.typed`, content: '', kind: 'support' });
    files.push({
      path: 'python/pyproject.toml',
      content: `[build-system]\nrequires = ["setuptools>=61"]\nbuild-backend = "setuptools.build_meta"\n\n[project]\nname = "${contract.service}-messaging"\nversion = "0.1.0"\nrequires-python = ">=3.8"\ndependencies = [${transport === 'redis-streams' ? '"redis>=5"' : ''}]\n\n[tool.setuptools]\npackages = ["${pkg}", "${pkg}.runtime"]\n`,
      kind: 'manifest',
    });
    if (transport === 'kafka') warnings.push('the Python runtime has no Kafka transport (only memory and redis-streams); the Python package has no connect_bus for Kafka');
  }

  files.push({ path: path.basename(contract.source.path), content: fs.readFileSync(contract.source.path, 'utf8'), kind: 'support' });
  if (input.registry) {
    files.push({ path: 'services.registry.json', content: JSON.stringify({ version: 1, services: input.registry }, null, 2) + '\n', kind: 'support' });
  }
  files.push({
    path: 'README.md',
    content: [
      `# ${toPascal(contract.service)} async messaging (${transport})`,
      '',
      `Generated by \`re-shell service bridge async\` from **${path.basename(contract.source.path)}**. ${contract.messages.length} message type(s): ${contract.messages.map(m => `\`${m.name}\` -> \`${m.channel}\``).join(', ')}.`,
      '',
      '- Every message travels in an envelope: `id`, `type`, `schemaVersion`, `correlationId`, `causationId`, `traceparent` (W3C), `source`, `timestamp`, `payload`.',
      '- Consumers upcast older payloads through the generated `upcast*` chain; unreadable messages go to `<channel>.dlq`.',
      '- Publishing is guarded by a circuit breaker and retried with backoff; handlers are retried, then dead-lettered.',
      '- Broker address: `options.url`, else discovery (`REDIS_URL`/`KAFKA_URL` env, `services.registry.json`, DNS SRV).',
      '',
    ].join('\n'),
    kind: 'readme',
  });
  return { files, warnings };
}
