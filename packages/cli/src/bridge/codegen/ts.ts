// IR -> typed TypeScript client (REST: fetch, GraphQL: POST, gRPC: @grpc/grpc-js + proto-loader).

import {
  findModel,
  type IRField,
  type IRGraphqlOperation,
  type IRModel,
  type IRObject,
  type IRRestOperation,
  type IRRpcOperation,
  type ServiceContract,
  type TypeRef,
} from '../spec/ir';
import { safeDoc, toPascal, tsIdent } from '../naming';
import { banner, type ClientFile, type GenerateClientOptions } from './common';

type Mode = 'json' | 'grpc';

function tsProp(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** TS type text for a TypeRef. */
export function tsType(ref: TypeRef, mode: Mode = 'json'): string {
  switch (ref.k) {
    case 'scalar':
      switch (ref.name) {
        case 'string':
        case 'datetime':
          return 'string';
        case 'int':
        case 'float':
          return 'number';
        case 'long':
          return mode === 'grpc' ? 'string' : 'number';
        case 'bool':
          return 'boolean';
        case 'bytes':
          return mode === 'grpc' ? 'Buffer' : 'string';
        default:
          return 'unknown';
      }
    case 'ref':
      return ref.name;
    case 'list': {
      const inner = tsType(ref.of, mode);
      const wrapped = ref.of.k === 'map' || inner.includes(' ') ? `(${inner})` : inner;
      return ref.itemNullable ? `(${inner} | null)[]` : `${wrapped}[]`;
    }
    case 'map':
      return `Record<string, ${tsType(ref.of, mode)}>`;
  }
}

function fieldLine(f: IRField, mode: Mode, indent = '  '): string {
  const doc = f.description ? `${indent}/** ${safeDoc(f.description)} */\n` : '';
  const optional = f.required ? '' : '?';
  const type = tsType(f.type, mode) + (f.nullable ? ' | null' : '');
  return `${doc}${indent}${tsProp(f.name)}${optional}: ${type};`;
}

function emitModel(m: IRModel, mode: Mode): string {
  const doc = m.description ? `/** ${safeDoc(m.description)} */\n` : '';
  if (m.kind === 'enum') {
    const values = m.values.map(v => JSON.stringify(v.name)).join(' | ') || 'never';
    return `${doc}export type ${m.name} = ${values};`;
  }
  if (m.kind === 'union') {
    return `${doc}export type ${m.name} = ${m.members.join(' | ') || 'unknown'};`;
  }
  if (m.fields.length === 0) {
    return `${doc}export interface ${m.name} {}`;
  }
  return `${doc}export interface ${m.name} {\n${m.fields.map(f => fieldLine(f, mode)).join('\n')}\n}`;
}

function emitModels(contract: ServiceContract, mode: Mode): string {
  return contract.models.map(m => emitModel(m, mode)).join('\n\n');
}

function clientClassName(serviceName: string): string {
  return `${toPascal(serviceName)}Client`;
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

interface ParamBinding {
  key: string;
  param: IRRestOperation['params'][number];
}

function bindParams(op: IRRestOperation): ParamBinding[] {
  const counts = new Map<string, number>();
  for (const p of op.params) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
  return op.params.map(p => ({
    key: counts.get(p.name)! > 1 ? `${p.in}${toPascal(p.name)}` : p.name,
    param: p,
  }));
}

function restMethod(op: IRRestOperation): string {
  const bindings = bindParams(op);
  const requiredParams = bindings.some(b => b.param.required);
  const paramsType = bindings.length
    ? `{ ${bindings
        .map(b => `${tsProp(b.key)}${b.param.required ? '' : '?'}: ${tsType(b.param.type)}`)
        .join('; ')} }`
    : undefined;
  const bodyType = op.body ? tsType(op.body.type) : undefined;
  const bodyRequired = op.body?.required ?? false;

  const args: string[] = [];
  if (paramsType && requiredParams) args.push(`params: ${paramsType}`);
  if (bodyType) args.push(`body${bodyRequired ? '' : '?'}: ${bodyType}`);
  if (paramsType && !requiredParams) args.push(`params: ${paramsType} = {}`);
  // A required positional cannot follow an optional one.
  const sig = args.join(', ');

  const pick = (loc: 'path' | 'query' | 'header'): string => {
    const items = bindings.filter(b => b.param.in === loc);
    if (items.length === 0) return '';
    return `${loc === 'header' ? 'headers' : loc}: { ${items
      .map(b => `${JSON.stringify(b.param.name)}: params[${JSON.stringify(b.key)}]`)
      .join(', ')} }`;
  };
  const initParts = [pick('path'), pick('query'), pick('header'), op.body ? 'body' : ''].filter(Boolean);
  const ret = op.response ? tsType(op.response.type) : 'void';

  const doc: string[] = [];
  const text = op.summary ?? op.description;
  if (text) doc.push(safeDoc(text));
  if (op.deprecated) doc.push('@deprecated');
  const docBlock = doc.length ? `  /**\n${doc.map(d => `   * ${d}`).join('\n')}\n   */\n` : '';
  const name = tsIdent(op.name);
  return `${docBlock}  async ${name}(${sig}): Promise<${ret}> {
    return this.request<${ret}>(${JSON.stringify(op.method)}, ${JSON.stringify(op.path)}, { ${initParts.join(', ')} });
  }`;
}

function restClient(contract: ServiceContract, opts: GenerateClientOptions): string {
  const cls = clientClassName(opts.serviceName);
  const baseUrl = contract.baseUrl ?? 'http://localhost:8080';
  const ops = contract.operations.filter((o): o is IRRestOperation => o.protocol === 'rest');
  return `${banner(contract, '//')}
/* eslint-disable */

${emitModels(contract, 'json')}

/** Options accepted by {@link ${cls}}. */
export interface ClientOptions {
  /** Base URL of the service. Default: ${JSON.stringify(baseUrl)}. */
  baseUrl?: string;
  /** fetch implementation. Default: the global \`fetch\`. */
  fetch?: typeof fetch;
  /** Extra headers for every request (e.g. Authorization, X-Correlation-Id), or a function returning them. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  /** Per-request timeout in milliseconds. Default: 30000. */
  timeoutMs?: number;
}

/** Thrown for every non-2xx response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown
  ) {
    super(\`HTTP \${status} \${statusText}\`);
    this.name = 'ApiError';
  }
}

interface RequestInit2 {
  path?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  body?: unknown;
}

/** Typed REST client for ${contract.title}. */
export class ${cls} {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: ClientOptions['headers'];
  private readonly timeoutMs: number;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? ${JSON.stringify(baseUrl)}).replace(/\\/+$/, '');
    this.fetchImpl = options.fetch ?? ((...args) => fetch(...args));
    this.headers = options.headers;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  private async request<T>(method: string, template: string, init: RequestInit2): Promise<T> {
    let url = this.baseUrl + template.replace(/\\{([^}]+)\\}/g, (_m, key: string) => {
      const value = init.path?.[key];
      if (value === undefined || value === null) throw new Error(\`missing path parameter "\${key}"\`);
      return encodeURIComponent(String(value));
    });
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) for (const item of value) search.append(key, String(item));
      else search.append(key, String(value));
    }
    const qs = search.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;

    const extra = typeof this.headers === 'function' ? await this.headers() : (this.headers ?? {});
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    for (const [key, value] of Object.entries(init.headers ?? {})) {
      if (value !== undefined && value !== null) headers[key] = String(value);
    }
    let body: string | undefined;
    if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { method, headers, body, signal: controller.signal });
      const text = await response.text();
      const isJson = (response.headers.get('content-type') ?? '').includes('json');
      const parsed: unknown = text === '' ? undefined : isJson ? JSON.parse(text) : text;
      if (!response.ok) throw new ApiError(response.status, response.statusText, parsed);
      return parsed as T;
    } finally {
      clearTimeout(timer);
    }
  }
${ops.length ? '\n' + ops.map(restMethod).join('\n\n') + '\n' : ''}}

export default ${cls};
`;
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const MAX_DEPTH = 3;

function selectionFor(contract: ServiceContract, ref: TypeRef, depth: number, trail: string[]): string {
  let cur = ref;
  while (cur.k === 'list') cur = cur.of;
  if (cur.k !== 'ref') return '';
  const model = findModel(contract, cur.name);
  if (!model || model.kind === 'enum') return '';
  if (model.kind === 'union') {
    const frags = model.members
      .map(member => {
        const m = findModel(contract, member);
        if (!m || m.kind !== 'object') return '';
        const sel = objectSelection(contract, m, depth, [...trail, m.name]);
        return sel ? `... on ${member} { __typename ${sel} }` : `... on ${member} { __typename }`;
      })
      .filter(Boolean);
    return `__typename ${frags.join(' ')}`;
  }
  const sel = objectSelection(contract, model, depth, [...trail, model.name]);
  const typename = model.isInterface ? '__typename ' : '';
  return `${typename}${sel}`.trim();
}

function objectSelection(contract: ServiceContract, model: IRObject, depth: number, trail: string[]): string {
  const parts: string[] = [];
  for (const f of model.fields) {
    if (f.noSelect) continue;
    let base = f.type;
    while (base.k === 'list') base = base.of;
    if (base.k === 'scalar' || base.k === 'map') {
      parts.push(f.name);
      continue;
    }
    if (base.k !== 'ref') continue;
    const target = findModel(contract, base.name);
    if (!target) continue;
    if (target.kind === 'enum') {
      parts.push(f.name);
      continue;
    }
    if (depth >= MAX_DEPTH || trail.includes(base.name)) continue;
    const sub = selectionFor(contract, base, depth + 1, trail);
    if (sub) parts.push(`${f.name} { ${sub} }`);
  }
  return parts.join(' ');
}

/** Build the GraphQL document for one operation (selection sets derived from the SDL). */
export function buildGraphqlDocument(contract: ServiceContract, op: IRGraphqlOperation): string {
  const opName = toPascal(op.name);
  const vars = op.args.map(a => `$${a.name}: ${a.gqlType ?? 'String'}`).join(', ');
  const callArgs = op.args.map(a => `${a.name}: $${a.name}`).join(', ');
  const sel = selectionFor(contract, op.returns, 1, []);
  return `${op.operation} ${opName}${vars ? `(${vars})` : ''} { ${op.field}${callArgs ? `(${callArgs})` : ''}${sel ? ` { ${sel} }` : ''} }`;
}

function graphqlMethod(contract: ServiceContract, op: IRGraphqlOperation): string {
  const doc = buildGraphqlDocument(contract, op);
  const varsType = op.args.length
    ? `{ ${op.args.map(a => `${tsProp(a.name)}${a.required ? '' : '?'}: ${tsType(a.type)}${a.nullable ? ' | null' : ''}`).join('; ')} }`
    : undefined;
  const anyRequired = op.args.some(a => a.required);
  const arg = varsType ? `variables: ${varsType}${anyRequired ? '' : ' = {}'}` : '';
  const ret = tsType(op.returns) + (op.returnsNullable ? ' | null' : '');
  const docBlock = op.description ? `  /** ${safeDoc(op.description)} */\n` : '';
  return `${docBlock}  async ${tsIdent(op.name)}(${arg}): Promise<${ret}> {
    const data = (await this.execute(${JSON.stringify(doc)}, ${varsType ? 'variables' : '{}'}, ${JSON.stringify(toPascal(op.name))})) as { ${tsProp(op.field)}: ${ret} };
    return data.${op.field.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/) ? op.field : `[${JSON.stringify(op.field)}]`};
  }`;
}

function graphqlClient(contract: ServiceContract, opts: GenerateClientOptions): string {
  const cls = clientClassName(opts.serviceName);
  const ops = contract.operations.filter(
    (o): o is IRGraphqlOperation => o.protocol === 'graphql' && o.operation !== 'subscription'
  );
  return `${banner(contract, '//')}
/* eslint-disable */

${emitModels(contract, 'json')}

/** Executes one GraphQL document and returns the \`data\` object. */
export type GraphqlExecute = (
  document: string,
  variables: Record<string, unknown>,
  operationName: string
) => Promise<unknown>;

/** Options accepted by {@link ${cls}}. */
export interface ClientOptions {
  /** GraphQL HTTP endpoint. Default: http://localhost:8080/graphql. */
  endpoint?: string;
  /** fetch implementation. Default: the global \`fetch\`. */
  fetch?: typeof fetch;
  /** Extra headers for every request, or a function returning them. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  /** Replace the transport entirely (e.g. for tests or subscriptions-over-ws gateways). */
  execute?: GraphqlExecute;
}

/** Thrown when the server returns GraphQL errors without data. */
export class GraphqlError extends Error {
  constructor(readonly errors: { message: string; path?: (string | number)[]; extensions?: Record<string, unknown> }[]) {
    super(errors.map(e => e.message).join('; '));
    this.name = 'GraphqlError';
  }
}

function defaultExecute(options: ClientOptions): GraphqlExecute {
  const endpoint = options.endpoint ?? 'http://localhost:8080/graphql';
  const doFetch: typeof fetch = options.fetch ?? ((...args) => fetch(...args));
  return async (document, variables, operationName) => {
    const extra = typeof options.headers === 'function' ? await options.headers() : (options.headers ?? {});
    const response = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...extra },
      body: JSON.stringify({ query: document, variables, operationName }),
    });
    const text = await response.text();
    let payload: { data?: unknown; errors?: GraphqlError['errors'] };
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(\`GraphQL endpoint returned HTTP \${response.status} with a non-JSON body\`);
    }
    if (payload.errors && payload.errors.length > 0 && (payload.data === undefined || payload.data === null)) {
      throw new GraphqlError(payload.errors);
    }
    return payload.data;
  };
}

/** Typed GraphQL client for ${contract.title}. */
export class ${cls} {
  private readonly execute: GraphqlExecute;

  constructor(options: ClientOptions = {}) {
    this.execute = options.execute ?? defaultExecute(options);
  }
${ops.length ? '\n' + ops.map(o => graphqlMethod(contract, o)).join('\n\n') + '\n' : ''}}

export default ${cls};
`;
}

// ---------------------------------------------------------------------------
// gRPC
// ---------------------------------------------------------------------------

function grpcMethod(op: IRRpcOperation): string {
  const req = tsType(op.request, 'grpc');
  const res = tsType(op.response, 'grpc');
  const docBlock = op.description ? `  /** ${safeDoc(op.description)} */\n` : '';
  if (op.serverStreaming) {
    return `${docBlock}  ${tsIdent(op.name)}(request: DeepPartial<${req}>, options: CallOptions = {}): ServerStream<${res}> {
    return this.stream<${res}>(${JSON.stringify(op.method)}, request, options);
  }`;
  }
  return `${docBlock}  ${tsIdent(op.name)}(request: DeepPartial<${req}>, options: CallOptions = {}): Promise<${res}> {
    return this.unary<${res}>(${JSON.stringify(op.method)}, request, options);
  }`;
}

function grpcClient(contract: ServiceContract, opts: GenerateClientOptions, protoFile: string): string {
  const services = new Map<string, IRRpcOperation[]>();
  const skipped: string[] = [];
  for (const op of contract.operations) {
    if (op.protocol !== 'grpc') continue;
    if (op.clientStreaming) {
      skipped.push(`${op.fqService}/${op.method}`);
      continue;
    }
    const list = services.get(op.fqService) ?? [];
    list.push(op);
    services.set(op.fqService, list);
  }
  const classes = [...services.entries()].map(([fq, ops]) => {
    const simple = fq.split('.').pop()!;
    const cls = /Client$/.test(simple) ? simple : `${simple}Client`;
    return `/** Typed gRPC client for \`${fq}\`. */
export class ${cls} extends GrpcServiceClient {
  constructor(options: ClientOptions) {
    super(${JSON.stringify(fq)}, options);
  }

${ops.map(grpcMethod).join('\n\n')}
}`;
  });
  const skippedNote = skipped.length
    ? `// Client-streaming and bidirectional RPCs are not generated: ${skipped.join(', ')}\n`
    : '';
  return `${banner(contract, '//')}
/* eslint-disable */
${skippedNote}
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

${emitModels(contract, 'grpc')}

/** Recursively optional: proto3 lets callers omit any request field. */
export type DeepPartial<T> = T extends Buffer
  ? T
  : T extends (infer U)[]
    ? DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/** An async-iterable server stream that can be cancelled. */
export type ServerStream<T> = AsyncIterable<T> & { cancel(): void };

/** Options accepted by every generated gRPC client. */
export interface ClientOptions {
  /** host:port of the gRPC server. */
  address: string;
  /** Channel credentials. Default: insecure (plaintext). */
  credentials?: grpc.ChannelCredentials;
  /** Metadata sent with every call (e.g. x-correlation-id, authorization). */
  metadata?: Record<string, string>;
  /** Default per-call deadline in milliseconds. */
  deadlineMs?: number;
  /** Absolute path of the .proto file. Default: ./${protoFile} next to this module. */
  protoPath?: string;
  /** Extra grpc-js channel options. */
  channelOptions?: grpc.ChannelOptions;
}

/** Per-call options. */
export interface CallOptions {
  metadata?: Record<string, string>;
  deadlineMs?: number;
}

/** Shared plumbing for the generated service clients. */
export class GrpcServiceClient {
  protected readonly client: grpc.Client & Record<string, (...args: unknown[]) => unknown>;
  private readonly baseMetadata: Record<string, string>;
  private readonly deadlineMs?: number;

  constructor(service: string, options: ClientOptions) {
    const definition = protoLoader.loadSync(options.protoPath ?? path.join(__dirname, ${JSON.stringify(protoFile)}), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const pkg = grpc.loadPackageDefinition(definition) as unknown as Record<string, unknown>;
    let node: unknown = pkg;
    for (const part of service.split('.')) node = (node as Record<string, unknown>)[part];
    if (typeof node !== 'function') throw new Error(\`gRPC service \${service} not found in the proto definition\`);
    const Ctor = node as new (address: string, creds: grpc.ChannelCredentials, opts?: grpc.ChannelOptions) => grpc.Client;
    this.client = new Ctor(
      options.address,
      options.credentials ?? grpc.credentials.createInsecure(),
      options.channelOptions
    ) as GrpcServiceClient['client'];
    this.baseMetadata = options.metadata ?? {};
    this.deadlineMs = options.deadlineMs;
  }

  private meta(call?: CallOptions): grpc.Metadata {
    const md = new grpc.Metadata();
    for (const [k, v] of Object.entries({ ...this.baseMetadata, ...(call?.metadata ?? {}) })) md.set(k, v);
    return md;
  }

  private callOptions(call?: CallOptions): grpc.CallOptions {
    const ms = call?.deadlineMs ?? this.deadlineMs;
    return ms === undefined ? {} : { deadline: Date.now() + ms };
  }

  protected unary<T>(method: string, request: unknown, call?: CallOptions): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      (this.client[method] as (...a: unknown[]) => void).call(
        this.client,
        request,
        this.meta(call),
        this.callOptions(call),
        (err: grpc.ServiceError | null, response: T) => (err ? reject(err) : resolve(response))
      );
    });
  }

  protected stream<T>(method: string, request: unknown, call?: CallOptions): ServerStream<T> {
    const readable = (this.client[method] as (...a: unknown[]) => grpc.ClientReadableStream<T>).call(
      this.client,
      request,
      this.meta(call),
      this.callOptions(call)
    );
    const iterable = readable as unknown as ServerStream<T>;
    iterable.cancel = () => readable.cancel();
    return iterable;
  }

  /** Close the underlying channel. */
  close(): void {
    this.client.close();
  }
}

${classes.join('\n\n')}
`;
}

// ---------------------------------------------------------------------------
// Package manifest
// ---------------------------------------------------------------------------

function manifest(contract: ServiceContract, opts: GenerateClientOptions): ClientFile[] {
  const pkg = {
    name: `${opts.serviceName}-client`,
    version: contract.version ?? '0.1.0',
    description: `Typed ${contract.protocol} client for ${contract.title} (generated by re-shell)`,
    main: 'dist/client.js',
    types: 'dist/client.d.ts',
    files: ['dist', ...(contract.protocol === 'grpc' ? ['*.proto'] : [])],
    scripts: { build: 'tsc -p tsconfig.json' },
    ...(contract.protocol === 'grpc'
      ? { dependencies: { '@grpc/grpc-js': '^1.14.4', '@grpc/proto-loader': '^0.7.15' } }
      : {}),
    devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
  };
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'CommonJS',
      moduleResolution: 'node',
      lib: ['ES2020', 'DOM'],
      strict: true,
      declaration: true,
      outDir: 'dist',
      rootDir: '.',
      skipLibCheck: true,
      esModuleInterop: true,
    },
    include: ['client.ts'],
  };
  return [
    { path: 'ts/package.json', content: JSON.stringify(pkg, null, 2) + '\n', kind: 'manifest' },
    { path: 'ts/tsconfig.json', content: JSON.stringify(tsconfig, null, 2) + '\n', kind: 'manifest' },
  ];
}

/**
 * Generate the TypeScript client package for a contract.
 *
 * @param protoFile - Basename of the .proto copied next to the client (gRPC only).
 */
export function generateTsClient(
  contract: ServiceContract,
  opts: GenerateClientOptions,
  protoFile = 'service.proto'
): ClientFile[] {
  const source =
    contract.protocol === 'rest'
      ? restClient(contract, opts)
      : contract.protocol === 'graphql'
        ? graphqlClient(contract, opts)
        : grpcClient(contract, opts, protoFile);
  const files: ClientFile[] = [{ path: 'ts/client.ts', content: source, kind: 'ts-client' }];
  files.push(...manifest(contract, opts));
  return files;
}
