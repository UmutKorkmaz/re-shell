// Universal mock server: REST (OpenAPI examples/schemas), GraphQL (SDL) and
// gRPC (.proto) from the same process, driven only by the services' own specs.
//
//   REST + GraphQL share one HTTP/1.1 port (GraphQL at /graphql).
//   gRPC needs HTTP/2, so it listens on its own port (default: HTTP port + 1).
//
// Introspection helpers: GET /__mock/health, GET|DELETE /__mock/requests.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { BridgeSpecError } from '../spec/errors';
import { loadContract } from '../spec/discover';
import type { BridgeProtocol, ServiceContract } from '../spec/ir';
import { createGraphqlMock, type GraphqlMock } from './graphql';
import { startGrpcMock, type GrpcMock } from './grpc';
import { createRestMock, type RestMock } from './rest';

/** One request served by the mock (for contract assertions). */
export interface RecordedRequest {
  protocol: BridgeProtocol;
  /** `GET /products/1`, `POST /graphql`, `acme.orders.OrderService/GetOrder`. */
  call: string;
  operation?: string;
  status?: number;
  body?: unknown;
  at: string;
}

/** Options of {@link startMockServer}. */
export interface MockServerOptions {
  /** Spec files: any mix of OpenAPI (yaml/json), .proto and GraphQL SDL. */
  specs: string[];
  /** HTTP port for REST + GraphQL (default 4010; 0 = ephemeral). */
  port?: number;
  /** gRPC port (default: HTTP port + 1, or ephemeral when the HTTP port is 0). */
  grpcPort?: number;
  host?: string;
}

/** A running mock server. */
export interface RunningMockServer {
  host: string;
  httpPort?: number;
  grpcPort?: number;
  protocols: BridgeProtocol[];
  baseUrl?: string;
  graphqlUrl?: string;
  grpcAddress?: string;
  specs: { path: string; protocol: BridgeProtocol; title: string; operations: number }[];
  requests: RecordedRequest[];
  close(): Promise<void>;
}

const MAX_BODY = 10 * 1024 * 1024;

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, headers: Record<string, string>, body: string): void {
  res.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
    ...headers,
  });
  res.end(body);
}

function openApiDoc(file: string): Record<string, unknown> {
  const text = fs.readFileSync(file, 'utf8');
  return (path.extname(file).toLowerCase() === '.json' ? JSON.parse(text) : yaml.load(text)) as Record<string, unknown>;
}

/**
 * Start the mock server.
 *
 * @throws BridgeSpecError when a spec cannot be loaded, or when there is
 *   nothing to serve.
 */
export async function startMockServer(options: MockServerOptions): Promise<RunningMockServer> {
  if (options.specs.length === 0) throw new BridgeSpecError('mock server needs at least one --spec (OpenAPI, .proto or GraphQL SDL)');
  const host = options.host ?? '127.0.0.1';
  const requests: RecordedRequest[] = [];
  const record = (r: Omit<RecordedRequest, 'at'>): void => {
    requests.push({ ...r, at: new Date().toISOString() });
    if (requests.length > 1000) requests.shift();
  };

  const contracts = options.specs.map(spec => loadContract(path.resolve(spec)));
  const restMocks: { name: string; mock: RestMock }[] = [];
  const gqlMocks: { name: string; mock: GraphqlMock }[] = [];
  const protoContracts: ServiceContract[] = [];
  for (const contract of contracts) {
    const name = path.basename(contract.source.path).replace(/\.[^.]+$/, '');
    if (contract.protocol === 'rest') restMocks.push({ name, mock: createRestMock(openApiDoc(contract.source.path)) });
    else if (contract.protocol === 'graphql') gqlMocks.push({ name, mock: createGraphqlMock(fs.readFileSync(contract.source.path, 'utf8'), contract.source.path) });
    else protoContracts.push(contract);
  }

  const protocols: BridgeProtocol[] = [];
  if (restMocks.length) protocols.push('rest');
  if (gqlMocks.length) protocols.push('graphql');
  if (protoContracts.length) protocols.push('grpc');

  let httpServer: http.Server | undefined;
  let httpPort: number | undefined;
  if (restMocks.length > 0 || gqlMocks.length > 0) {
    httpServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://mock');
        const pathname = url.pathname;
        const method = (req.method ?? 'GET').toUpperCase();
        if (method === 'OPTIONS') return send(res, 204, {}, '');

        if (pathname === '/__mock/health') {
          return send(res, 200, { 'content-type': 'application/json' }, JSON.stringify({ ok: true, protocols, specs: contracts.map(c => path.basename(c.source.path)) }));
        }
        if (pathname === '/__mock/requests') {
          if (method === 'DELETE') {
            requests.length = 0;
            return send(res, 204, {}, '');
          }
          return send(res, 200, { 'content-type': 'application/json' }, JSON.stringify(requests));
        }

        const body = method === 'GET' || method === 'HEAD' ? Buffer.alloc(0) : await readBody(req);

        // GraphQL: /graphql (first schema) and /graphql/<spec-name> (each schema).
        const gqlMatch = gqlMocks.find((g, i) => pathname === `/graphql/${g.name}` || (i === 0 && pathname === '/graphql'));
        if (gqlMatch) {
          let payload: { query?: unknown; variables?: unknown; operationName?: unknown };
          if (method === 'GET') {
            payload = {
              query: url.searchParams.get('query') ?? undefined,
              variables: url.searchParams.get('variables') ? JSON.parse(url.searchParams.get('variables') as string) : undefined,
              operationName: url.searchParams.get('operationName') ?? undefined,
            };
          } else {
            try {
              payload = JSON.parse(body.toString('utf8') || '{}');
            } catch {
              return send(res, 400, { 'content-type': 'application/json' }, JSON.stringify({ errors: [{ message: 'request body is not valid JSON' }] }));
            }
          }
          const reply = await gqlMatch.mock.run(payload);
          record({ protocol: 'graphql', call: `${method} ${pathname}`, operation: reply.operationName, status: reply.status, body: payload });
          return send(res, reply.status, { 'content-type': 'application/json', 'x-mock-server': 're-shell' }, JSON.stringify(reply.body));
        }

        for (const { mock } of restMocks) {
          const reply = mock.respond(method, pathname, url.searchParams, req.headers, body);
          if (!reply) continue;
          let parsed: unknown;
          if (body.length > 0) {
            try {
              parsed = JSON.parse(body.toString('utf8'));
            } catch {
              parsed = undefined;
            }
          }
          record({ protocol: 'rest', call: `${method} ${pathname}${url.search}`, operation: reply.operation, status: reply.status, body: parsed });
          return send(res, reply.status, reply.headers, reply.body);
        }
        record({ protocol: 'rest', call: `${method} ${pathname}`, status: 404 });
        return send(
          res,
          404,
          { 'content-type': 'application/json' },
          JSON.stringify({ error: 'no route in the loaded contracts matches this request', method, path: pathname })
        );
      } catch (error: unknown) {
        return send(res, 500, { 'content-type': 'application/json' }, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
    });
    httpPort = await new Promise<number>((resolve, reject) => {
      httpServer!.once('error', reject);
      httpServer!.listen(options.port ?? 4010, host, () => resolve((httpServer!.address() as { port: number }).port));
    });
  }

  let grpcMock: GrpcMock | undefined;
  if (protoContracts.length > 0) {
    const requested = options.grpcPort ?? (httpPort !== undefined && (options.port ?? 4010) !== 0 ? (options.port ?? 4010) + 1 : 0);
    try {
      grpcMock = await startGrpcMock(protoContracts, {
        host,
        port: requested,
        record: e => record({ protocol: 'grpc', call: `${e.service}/${e.method}`, operation: e.method, body: e.request }),
      });
    } catch (error: unknown) {
      if (httpServer) await new Promise<void>(r => httpServer!.close(() => r()));
      throw error;
    }
  }

  return {
    host,
    httpPort,
    grpcPort: grpcMock?.port,
    protocols,
    baseUrl: httpPort !== undefined ? `http://${host}:${httpPort}` : undefined,
    graphqlUrl: httpPort !== undefined && gqlMocks.length ? `http://${host}:${httpPort}/graphql` : undefined,
    grpcAddress: grpcMock ? `${host}:${grpcMock.port}` : undefined,
    specs: contracts.map(c => ({ path: c.source.path, protocol: c.protocol, title: c.title, operations: c.operations.length })),
    requests,
    close: async () => {
      await Promise.all([
        httpServer ? new Promise<void>(r => { httpServer!.closeAllConnections?.(); httpServer!.close(() => r()); }) : Promise.resolve(),
        grpcMock ? grpcMock.close() : Promise.resolve(),
      ]);
    },
  };
}
