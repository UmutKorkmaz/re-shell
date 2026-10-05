// gRPC mock: a real @grpc/grpc-js server for every service in a .proto, whose
// handlers fabricate responses from the declared message types.

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

import { findModel, type IRObject, type IRRpcOperation, type ServiceContract, type TypeRef } from '../spec/ir';

type Obj = Record<string, unknown>;

/** Called for each served RPC (request log). */
export type GrpcRecorder = (entry: { service: string; method: string; request: unknown; metadata: Record<string, string> }) => void;

const MAX_DEPTH = 4;

function scalarValue(name: string, field: string): unknown {
  switch (name) {
    case 'string':
    case 'datetime':
      return field;
    case 'int':
      return 1;
    case 'long':
      return '1'; // proto-loader is configured with longs: String
    case 'float':
      return 1.5;
    case 'bool':
      return true;
    case 'bytes':
      return Buffer.from('mock');
    default:
      return null;
  }
}

/** Fabricate a message of `type`, echoing same-named scalar fields from `request`. */
export function buildMessage(contract: ServiceContract, type: TypeRef, request: Obj | undefined, depth = 0, stack: string[] = []): Obj {
  if (type.k !== 'ref') return {};
  const model = findModel(contract, type.name);
  if (!model || model.kind !== 'object') return {};
  const out: Obj = {};
  const seenOneof = new Set<string>();
  for (const f of (model as IRObject).fields) {
    if (f.oneof) {
      if (seenOneof.has(f.oneof)) continue;
      seenOneof.add(f.oneof);
    }
    const echoed = request && f.name in request && request[f.name] !== undefined && f.type.k === 'scalar' ? request[f.name] : undefined;
    out[f.name] = fieldValue(contract, f.type, f.name, echoed, depth, [...stack, type.name]);
  }
  return out;
}

function fieldValue(contract: ServiceContract, type: TypeRef, name: string, echoed: unknown, depth: number, stack: string[]): unknown {
  switch (type.k) {
    case 'scalar':
      return echoed !== undefined && echoed !== '' && echoed !== 0 ? echoed : scalarValue(type.name, name);
    case 'list':
      return [fieldValue(contract, type.of, name, undefined, depth + 1, stack)];
    case 'map':
      return { key: fieldValue(contract, type.of, name, undefined, depth + 1, stack) };
    case 'ref': {
      const m = findModel(contract, type.name);
      if (!m) return null;
      if (m.kind === 'enum') {
        // Prefer the first non-zero value so the response is visibly "set".
        const v = m.values.find(x => x.number !== 0) ?? m.values[0];
        return v?.name ?? null;
      }
      if (m.kind === 'object') {
        if (depth >= MAX_DEPTH || stack.includes(type.name)) return null;
        return buildMessage(contract, type, undefined, depth + 1, stack);
      }
      return null;
    }
  }
}

/** A running gRPC mock. */
export interface GrpcMock {
  port: number;
  services: string[];
  close(): Promise<void>;
}

function metaToObject(md: grpc.Metadata): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(md.getMap())) out[k] = String(v);
  return out;
}

/**
 * Start a gRPC server for the given proto contracts.
 *
 * @param port - Port to bind (0 = ephemeral).
 */
export async function startGrpcMock(
  contracts: ServiceContract[],
  options: { host: string; port: number; record?: GrpcRecorder }
): Promise<GrpcMock> {
  const server = new grpc.Server();
  const services: string[] = [];

  for (const contract of contracts) {
    const def = protoLoader.loadSync(contract.source.path, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [path.dirname(contract.source.path)],
    });
    const pkg = grpc.loadPackageDefinition(def) as unknown as Record<string, unknown>;
    const byService = new Map<string, IRRpcOperation[]>();
    for (const op of contract.operations) {
      if (op.protocol === 'grpc') byService.set(op.fqService, [...(byService.get(op.fqService) ?? []), op]);
    }
    for (const [fq, ops] of byService) {
      let node: unknown = pkg;
      for (const part of fq.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
      const ctor = node as { service?: grpc.ServiceDefinition } | undefined;
      if (!ctor?.service) throw new Error(`gRPC service ${fq} could not be loaded from ${contract.source.path}`);
      const handlers: Record<string, grpc.UntypedHandleCall> = {};
      for (const op of ops) {
        const reply = (request: Obj | undefined): Obj => buildMessage(contract, op.response, request);
        const log = (request: unknown, md: grpc.Metadata): void =>
          options.record?.({ service: fq, method: op.method, request, metadata: metaToObject(md) });
        if (!op.clientStreaming && !op.serverStreaming) {
          handlers[op.method] = ((call: grpc.ServerUnaryCall<Obj, Obj>, cb: grpc.sendUnaryData<Obj>) => {
            log(call.request, call.metadata);
            cb(null, reply(call.request));
          }) as grpc.UntypedHandleCall;
        } else if (!op.clientStreaming && op.serverStreaming) {
          handlers[op.method] = ((call: grpc.ServerWritableStream<Obj, Obj>) => {
            log(call.request, call.metadata);
            for (let i = 0; i < 3; i++) call.write(reply(call.request));
            call.end();
          }) as grpc.UntypedHandleCall;
        } else if (op.clientStreaming && !op.serverStreaming) {
          handlers[op.method] = ((call: grpc.ServerReadableStream<Obj, Obj>, cb: grpc.sendUnaryData<Obj>) => {
            const seen: Obj[] = [];
            call.on('data', (m: Obj) => seen.push(m));
            call.on('end', () => {
              log(seen, call.metadata);
              cb(null, reply(seen[seen.length - 1]));
            });
          }) as grpc.UntypedHandleCall;
        } else {
          handlers[op.method] = ((call: grpc.ServerDuplexStream<Obj, Obj>) => {
            call.on('data', (m: Obj) => {
              log(m, call.metadata);
              call.write(reply(m));
            });
            call.on('end', () => call.end());
          }) as grpc.UntypedHandleCall;
        }
      }
      server.addService(ctor.service, handlers);
      services.push(fq);
    }
  }

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(`${options.host}:${options.port}`, grpc.ServerCredentials.createInsecure(), (err, bound) =>
      err ? reject(err) : resolve(bound)
    );
  });

  return {
    port,
    services,
    close: () =>
      new Promise<void>(resolve => {
        server.tryShutdown(() => resolve());
        // tryShutdown waits for open streams; force after a short grace period.
        setTimeout(() => {
          server.forceShutdown();
          resolve();
        }, 1500).unref();
      }),
  };
}
