// .proto (proto2/proto3) -> ServiceContract IR, via protobufjs's parser.

import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';

import { BridgeSpecError } from './errors';
import {
  t,
  type ContractSource,
  type IRField,
  type IRModel,
  type IROperation,
  type ServiceContract,
  type TypeRef,
} from './ir';
import { toPascal } from '../naming';

const SCALARS: Record<string, TypeRef> = {
  double: t.scalar('float'),
  float: t.scalar('float'),
  int32: t.scalar('int'),
  uint32: t.scalar('int'),
  sint32: t.scalar('int'),
  fixed32: t.scalar('int'),
  sfixed32: t.scalar('int'),
  int64: t.scalar('long'),
  uint64: t.scalar('long'),
  sint64: t.scalar('long'),
  fixed64: t.scalar('long'),
  sfixed64: t.scalar('long'),
  bool: t.scalar('bool'),
  string: t.scalar('string'),
  bytes: t.scalar('bytes'),
};

/** Load a .proto file (resolving imports relative to it) into a resolved protobufjs Root. */
export function loadProtoRoot(file: string, includeDirs: string[] = []): protobuf.Root {
  const root = new protobuf.Root();
  const baseDir = path.dirname(file);
  const dirs = [baseDir, ...includeDirs];
  const original = root.resolvePath.bind(root);
  root.resolvePath = (origin: string, target: string): string => {
    if (path.isAbsolute(target) && fs.existsSync(target)) return target;
    for (const dir of dirs) {
      const candidate = path.resolve(dir, target);
      if (fs.existsSync(candidate)) return candidate;
    }
    return original(origin, target);
  };
  try {
    root.loadSync(file, { keepCase: true, alternateCommentMode: true });
    root.resolveAll();
  } catch (error: unknown) {
    throw new BridgeSpecError(
      `${file}: invalid .proto: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return root;
}

function collect(ns: protobuf.NamespaceBase, types: protobuf.Type[], enums: protobuf.Enum[], services: protobuf.Service[]): void {
  for (const obj of ns.nestedArray) {
    if (obj instanceof protobuf.Type) {
      types.push(obj);
      collect(obj, types, enums, services);
    } else if (obj instanceof protobuf.Enum) {
      enums.push(obj);
    } else if (obj instanceof protobuf.Service) {
      services.push(obj);
    } else if (obj instanceof protobuf.Namespace) {
      collect(obj, types, enums, services);
    }
  }
}

function normPath(p: string | null | undefined): string {
  return p ? path.resolve(p) : '';
}

/** Parse a .proto file into the shared IR. */
export function protoToContract(source: ContractSource, includeDirs: string[] = []): ServiceContract {
  const root = loadProtoRoot(source.path, includeDirs);
  const types: protobuf.Type[] = [];
  const enums: protobuf.Enum[] = [];
  const services: protobuf.Service[] = [];
  collect(root, types, enums, services);

  const mainFile = normPath(source.path);
  const ownServices = services.filter(s => normPath(s.filename) === mainFile);
  const ownTypes = types.filter(x => normPath(x.filename) === mainFile);
  const ownEnums = enums.filter(x => normPath(x.filename) === mainFile);

  // Package name = the namespace chain above the first declaration in the main file.
  let packageName = '';
  const anchor = ownServices[0] ?? ownTypes[0] ?? ownEnums[0];
  if (anchor) {
    const chain: string[] = [];
    let cur: protobuf.ReflectionObject | null = anchor.parent;
    while (cur && cur.name) {
      if (cur instanceof protobuf.Type) break;
      chain.unshift(cur.name);
      cur = cur.parent;
    }
    packageName = chain.join('.');
  }

  const nameOf = (fullName: string): string => {
    const fq = fullName.replace(/^\./, '');
    if (packageName && fq.startsWith(`${packageName}.`)) {
      return fq.slice(packageName.length + 1).split('.').map(toPascal).join('');
    }
    return fq.split('.').map(toPascal).join('');
  };

  const needed = new Map<string, protobuf.Type | protobuf.Enum>();
  const queue: (protobuf.Type | protobuf.Enum)[] = [...ownTypes, ...ownEnums];
  for (const m of queue) needed.set(m.fullName, m);
  const add = (m: protobuf.Type | protobuf.Enum | null): void => {
    if (m && !needed.has(m.fullName)) {
      needed.set(m.fullName, m);
      queue.push(m);
    }
  };
  for (const svc of ownServices) {
    for (const method of svc.methodsArray) {
      add(method.resolvedRequestType as protobuf.Type | null);
      add(method.resolvedResponseType as protobuf.Type | null);
    }
  }

  const models: IRModel[] = [];
  const done = new Set<string>();
  const fieldType = (field: protobuf.Field): TypeRef => {
    let base: TypeRef;
    if (field.type in SCALARS) {
      base = SCALARS[field.type];
    } else {
      const resolved = field.resolvedType as protobuf.Type | protobuf.Enum | null;
      if (!resolved) {
        throw new BridgeSpecError(`${source.path}: unresolved type "${field.type}" on field ${field.name}`);
      }
      add(resolved);
      base = t.ref(nameOf(resolved.fullName));
    }
    if (field instanceof protobuf.MapField) return t.map(base);
    return field.repeated ? t.list(base) : base;
  };

  for (let i = 0; i < queue.length; i++) {
    const m = queue[i];
    if (done.has(m.fullName)) continue;
    done.add(m.fullName);
    if (m instanceof protobuf.Enum) {
      models.push({
        kind: 'enum',
        name: nameOf(m.fullName),
        fqn: m.fullName.replace(/^\./, ''),
        values: Object.entries(m.values).map(([name, number]) => ({ name, number })),
        description: m.comment ?? undefined,
      });
      continue;
    }
    // Skip synthetic map-entry types (protobufjs models maps as MapField, not entry types).
    const fields: IRField[] = [];
    for (const f of m.fieldsArray) {
      const type = fieldType(f);
      const isMessage = f.resolvedType instanceof protobuf.Type;
      const proto3Optional = Boolean((f.options as Record<string, unknown> | undefined)?.proto3_optional);
      const inRealOneof = Boolean(f.partOf) && !proto3Optional;
      let required: boolean;
      if (f.repeated || f instanceof protobuf.MapField) required = true;
      else if (isMessage || inRealOneof || proto3Optional) required = false;
      else required = (f as unknown as { rule?: string }).rule !== 'optional';
      fields.push({
        name: f.name,
        type,
        required,
        nullable: required ? undefined : true,
        description: f.comment ?? undefined,
        tag: f.id,
        oneof: inRealOneof && f.partOf ? f.partOf.name : undefined,
      });
    }
    models.push({
      kind: 'object',
      name: nameOf(m.fullName),
      fqn: m.fullName.replace(/^\./, ''),
      fields,
      description: m.comment ?? undefined,
    });
  }

  const operations: IROperation[] = [];
  for (const svc of ownServices) {
    for (const method of svc.methodsArray) {
      const req = method.resolvedRequestType as protobuf.Type;
      const res = method.resolvedResponseType as protobuf.Type;
      operations.push({
        protocol: 'grpc',
        name: method.name.charAt(0).toLowerCase() + method.name.slice(1),
        service: svc.name,
        fqService: svc.fullName.replace(/^\./, ''),
        method: method.name,
        request: t.ref(nameOf(req.fullName)),
        response: t.ref(nameOf(res.fullName)),
        clientStreaming: Boolean(method.requestStream),
        serverStreaming: Boolean(method.responseStream),
        description: method.comment ?? undefined,
      });
    }
  }

  const warnings: string[] = [];
  if (ownServices.length === 0) {
    warnings.push(`${path.basename(source.path)} declares no "service" block; only message types were generated`);
  }

  models.sort((a, b) => a.name.localeCompare(b.name));
  return {
    protocol: 'grpc',
    title: ownServices.map(s => s.name).join(', ') || path.basename(source.path, '.proto'),
    packageName: packageName || undefined,
    models,
    operations,
    source,
    warnings,
    imports: root.files
      .map(f => path.resolve(f))
      .filter(f => f !== mainFile && fs.existsSync(f)),
  };
}
