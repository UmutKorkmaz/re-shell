// OpenAPI 3.x (yaml/json) -> ServiceContract IR.

import { BridgeSpecError } from './errors';
import {
  t,
  type ContractSource,
  type HttpMethod,
  type IRField,
  type IRModel,
  type IRObject,
  type IROperation,
  type IRParam,
  type IRRestOperation,
  type ServiceContract,
  type TypeRef,
} from './ir';
import { toCamel, toPascal, words } from '../naming';

type Json = Record<string, unknown>;

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function isObj(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface Ctx {
  doc: Json;
  models: Map<string, IRModel>;
  /** Component schemas that collapse to a plain type (no named model). */
  aliases: Map<string, { type: TypeRef; nullable: boolean }>;
  inProgress: Set<string>;
  warnings: string[];
}

interface Resolved {
  type: TypeRef;
  nullable: boolean;
}

/** Resolve a local `#/...` JSON pointer. */
function deref(ctx: Ctx, ref: string): Json {
  if (!ref.startsWith('#/')) {
    throw new BridgeSpecError(
      `Unsupported external $ref "${ref}" (bundle the spec into one file first)`
    );
  }
  let node: unknown = ctx.doc;
  for (const rawSeg of ref.slice(2).split('/')) {
    const seg = decodeURIComponent(rawSeg).replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObj(node) || !(seg in node)) {
      throw new BridgeSpecError(`Unresolvable $ref "${ref}"`);
    }
    node = node[seg];
  }
  if (!isObj(node)) throw new BridgeSpecError(`$ref "${ref}" does not point to an object`);
  return node;
}

function uniqueName(ctx: Ctx, base: string): string {
  let name = toPascal(base) || 'Model';
  let n = 2;
  while (ctx.models.has(name) || ctx.aliases.has(name)) {
    name = `${toPascal(base)}${n++}`;
  }
  return name;
}

function enumValueName(raw: unknown): string {
  return String(raw);
}

function isNullType(schema: unknown): boolean {
  return isObj(schema) && schema.type === 'null';
}

/** Collect properties + required names of a schema, flattening allOf. */
function flattenObject(
  ctx: Ctx,
  schema: Json,
  out: { props: Map<string, Json>; required: Set<string>; description?: string },
  seen = new Set<string>()
): void {
  if (typeof schema.$ref === 'string') {
    if (seen.has(schema.$ref)) return;
    seen.add(schema.$ref);
    flattenObject(ctx, deref(ctx, schema.$ref), out, seen);
    return;
  }
  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf) {
      if (isObj(part)) flattenObject(ctx, part, out, seen);
    }
  }
  if (isObj(schema.properties)) {
    for (const [k, v] of Object.entries(schema.properties)) {
      if (isObj(v)) out.props.set(k, v);
    }
  }
  if (Array.isArray(schema.required)) {
    for (const r of schema.required) out.required.add(String(r));
  }
  if (typeof schema.description === 'string' && !out.description) {
    out.description = schema.description;
  }
}

function buildObject(ctx: Ctx, name: string, schema: Json): IRObject {
  const flat = { props: new Map<string, Json>(), required: new Set<string>() } as {
    props: Map<string, Json>;
    required: Set<string>;
    description?: string;
  };
  flattenObject(ctx, schema, flat);
  const fields: IRField[] = [];
  for (const [propName, propSchema] of flat.props) {
    const r = schemaToType(ctx, propSchema, `${name}${toPascal(propName)}`);
    fields.push({
      name: propName,
      type: r.type,
      required: flat.required.has(propName),
      nullable: r.nullable || undefined,
      description: typeof propSchema.description === 'string' ? propSchema.description : undefined,
    });
  }
  return {
    kind: 'object',
    name,
    fields,
    description: flat.description ?? (typeof schema.description === 'string' ? schema.description : undefined),
  };
}

function hasObjectShape(schema: Json): boolean {
  return isObj(schema.properties) || (Array.isArray(schema.allOf) && schema.allOf.length > 0);
}

/** Register a named model for `schema` (component or hoisted inline). Returns the ref type. */
function registerNamed(ctx: Ctx, name: string, schema: Json): Resolved | undefined {
  // enum
  if (Array.isArray(schema.enum) && (schema.type === 'string' || schema.type === undefined) &&
      schema.enum.every(v => typeof v === 'string')) {
    ctx.models.set(name, {
      kind: 'enum',
      name,
      values: (schema.enum as unknown[]).map(v => ({ name: enumValueName(v) })),
      description: typeof schema.description === 'string' ? schema.description : undefined,
    });
    return { type: t.ref(name), nullable: schema.nullable === true };
  }
  // oneOf / anyOf of refs -> union
  const alt = (Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : undefined) as
    | unknown[]
    | undefined;
  if (alt && !hasObjectShape({ ...schema, allOf: undefined, type: undefined })) {
    const members = alt.filter(m => !isNullType(m));
    const hasNull = members.length !== alt.length;
    const refs = members.filter(m => isObj(m) && typeof m.$ref === 'string') as Json[];
    if (refs.length === members.length && members.length > 0) {
      if (members.length === 1) {
        const r = schemaToType(ctx, members[0] as Json, name);
        return { type: r.type, nullable: r.nullable || hasNull };
      }
      ctx.models.set(name, { kind: 'union', name, members: [], description: undefined });
      const names: string[] = [];
      for (const m of refs) {
        const r = schemaToType(ctx, m, name);
        if (r.type.k === 'ref') names.push(r.type.name);
      }
      ctx.models.set(name, {
        kind: 'union',
        name,
        members: names,
        description: typeof schema.description === 'string' ? schema.description : undefined,
      });
      return { type: t.ref(name), nullable: hasNull || schema.nullable === true };
    }
    return undefined;
  }
  if (isObj(schema.properties) || (Array.isArray(schema.allOf) && schema.allOf.length > 0)) {
    ctx.models.set(name, { kind: 'object', name, fields: [] });
    ctx.models.set(name, buildObject(ctx, name, schema));
    return { type: t.ref(name), nullable: schema.nullable === true };
  }
  return undefined;
}

/** Convert a schema node to a TypeRef, hoisting inline objects/enums to named models. */
function schemaToType(ctx: Ctx, schema: unknown, hint: string): Resolved {
  if (!isObj(schema)) return { type: t.scalar('any'), nullable: false };

  if (typeof schema.$ref === 'string') {
    const ref = schema.$ref;
    const m = ref.match(/^#\/components\/schemas\/([^/]+)$/);
    if (m) {
      const compName = decodeURIComponent(m[1]);
      const modelName = toPascal(compName);
      if (ctx.models.has(modelName) || ctx.inProgress.has(modelName)) {
        return { type: t.ref(modelName), nullable: false };
      }
      const alias = ctx.aliases.get(compName);
      if (alias) return alias;
      const target = deref(ctx, ref);
      ctx.inProgress.add(modelName);
      const named = registerNamed(ctx, modelName, target);
      ctx.inProgress.delete(modelName);
      if (named) return { type: named.type, nullable: named.nullable };
      const plain = schemaToType(ctx, target, modelName);
      ctx.aliases.set(compName, plain);
      return plain;
    }
    return schemaToType(ctx, deref(ctx, ref), hint);
  }

  // type: ['string', 'null'] (OpenAPI 3.1)
  let nullable = schema.nullable === true;
  let type = schema.type;
  if (Array.isArray(type)) {
    const nonNull = type.filter(x => x !== 'null');
    if (nonNull.length !== type.length) nullable = true;
    type = nonNull.length === 1 ? nonNull[0] : undefined;
  }

  // Named hoisting for inline enums / objects / unions.
  const needsModel =
    (Array.isArray(schema.enum) && schema.enum.every(v => typeof v === 'string') && schema.enum.length > 0) ||
    isObj(schema.properties) ||
    (Array.isArray(schema.allOf) && schema.allOf.length > 0) ||
    Array.isArray(schema.oneOf) ||
    Array.isArray(schema.anyOf);
  if (needsModel) {
    // allOf with a single $ref and no extras is just that ref.
    if (
      Array.isArray(schema.allOf) &&
      schema.allOf.length === 1 &&
      isObj(schema.allOf[0]) &&
      !isObj(schema.properties)
    ) {
      const r = schemaToType(ctx, schema.allOf[0], hint);
      return { type: r.type, nullable: r.nullable || nullable };
    }
    const alt = (Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : undefined) as
      | unknown[]
      | undefined;
    if (alt) {
      const nonNull = alt.filter(m => !isNullType(m));
      if (nonNull.length === 1) {
        const r = schemaToType(ctx, nonNull[0], hint);
        return { type: r.type, nullable: r.nullable || nullable || nonNull.length !== alt.length };
      }
    }
    const name = uniqueName(ctx, hint);
    ctx.inProgress.add(name);
    const named = registerNamed(ctx, name, schema);
    ctx.inProgress.delete(name);
    if (named) return { type: named.type, nullable: named.nullable || nullable };
    return { type: t.scalar('any'), nullable };
  }

  switch (type) {
    case 'string': {
      const fmt = schema.format;
      if (fmt === 'date-time' || fmt === 'date') return { type: t.scalar('datetime'), nullable };
      if (fmt === 'byte' || fmt === 'binary') return { type: t.scalar('bytes'), nullable };
      return { type: t.scalar('string'), nullable };
    }
    case 'integer':
      return { type: t.scalar(schema.format === 'int64' ? 'long' : 'int'), nullable };
    case 'number':
      return { type: t.scalar('float'), nullable };
    case 'boolean':
      return { type: t.scalar('bool'), nullable };
    case 'array': {
      const item = schemaToType(ctx, schema.items, `${hint}Item`);
      return { type: t.list(item.type, item.nullable), nullable };
    }
    case 'object':
    default: {
      if (type === 'object' || isObj(schema.additionalProperties)) {
        const ap = schema.additionalProperties;
        if (isObj(ap)) {
          const v = schemaToType(ctx, ap, `${hint}Value`);
          return { type: t.map(v.type), nullable };
        }
        return { type: t.map(t.scalar('any')), nullable };
      }
      return { type: t.scalar('any'), nullable };
    }
  }
}

function pickJsonContent(content: unknown): { schema: unknown; kind: 'json' | 'text' | 'binary' } | undefined {
  if (!isObj(content)) return undefined;
  const keys = Object.keys(content);
  const jsonKey =
    keys.find(k => k === 'application/json') ??
    keys.find(k => /json/i.test(k)) ??
    keys.find(k => k === '*/*');
  if (jsonKey) {
    const media = content[jsonKey];
    return { schema: isObj(media) ? media.schema : undefined, kind: 'json' };
  }
  const textKey = keys.find(k => k.startsWith('text/'));
  if (textKey) return { schema: { type: 'string' }, kind: 'text' };
  const binKey = keys.find(k => k === 'application/octet-stream');
  if (binKey) return { schema: { type: 'string', format: 'binary' }, kind: 'binary' };
  return undefined;
}

function operationNameFor(method: string, route: string, operationId: unknown): string {
  if (typeof operationId === 'string' && operationId.trim()) {
    return toCamel(operationId);
  }
  const pathWords = route
    .split('/')
    .filter(Boolean)
    .map(seg => {
      const p = seg.match(/^\{(.+)\}$/);
      return p ? `By${toPascal(p[1])}` : toPascal(seg);
    })
    .join('');
  return toCamel(`${method.toLowerCase()}${pathWords || 'Root'}`);
}

/**
 * Convert an OpenAPI 3.x document into the shared IR.
 *
 * @throws BridgeSpecError for Swagger 2.0, non-OpenAPI documents or external `$ref`s.
 */
export function openApiToContract(raw: unknown, source: ContractSource): ServiceContract {
  if (!isObj(raw)) throw new BridgeSpecError(`${source.path}: not an OpenAPI document (expected an object)`);
  if (typeof raw.swagger === 'string') {
    throw new BridgeSpecError(
      `${source.path}: Swagger ${raw.swagger} is not supported; convert it to OpenAPI 3.x first`
    );
  }
  if (typeof raw.openapi !== 'string' || !raw.openapi.startsWith('3.')) {
    throw new BridgeSpecError(`${source.path}: missing or unsupported "openapi" version (need 3.x)`);
  }
  if (!isObj(raw.paths)) {
    throw new BridgeSpecError(`${source.path}: OpenAPI document has no "paths"`);
  }

  const ctx: Ctx = {
    doc: raw,
    models: new Map(),
    aliases: new Map(),
    inProgress: new Set(),
    warnings: [],
  };

  // Register all component schemas first so they exist even if unreferenced.
  const components = isObj(raw.components) ? raw.components : {};
  if (isObj(components.schemas)) {
    for (const name of Object.keys(components.schemas)) {
      schemaToType(ctx, { $ref: `#/components/schemas/${name}` }, name);
    }
  }

  const operations: IROperation[] = [];
  const usedOpNames = new Set<string>();

  for (const [route, pathItemRaw] of Object.entries(raw.paths)) {
    let pathItem = pathItemRaw as unknown;
    if (isObj(pathItem) && typeof pathItem.$ref === 'string') pathItem = deref(ctx, pathItem.$ref);
    if (!isObj(pathItem)) continue;
    const pathParams = Array.isArray(pathItem.parameters) ? (pathItem.parameters as unknown[]) : [];

    for (const method of HTTP_METHODS) {
      const opRaw = pathItem[method.toLowerCase()];
      if (!isObj(opRaw)) continue;

      let opName = operationNameFor(method, route, opRaw.operationId);
      if (usedOpNames.has(opName)) {
        let n = 2;
        while (usedOpNames.has(`${opName}${n}`)) n++;
        opName = `${opName}${n}`;
      }

      // Parameters: path-level first, operation-level overrides by (in,name).
      const paramMap = new Map<string, IRParam>();
      const opParams = Array.isArray(opRaw.parameters) ? (opRaw.parameters as unknown[]) : [];
      let skip: string | undefined;
      for (const pRaw of [...pathParams, ...opParams]) {
        let p = pRaw;
        if (isObj(p) && typeof p.$ref === 'string') p = deref(ctx, p.$ref);
        if (!isObj(p) || typeof p.name !== 'string') continue;
        const loc = p.in;
        if (loc !== 'path' && loc !== 'query' && loc !== 'header') {
          if (loc === 'cookie') ctx.warnings.push(`${method} ${route}: cookie parameter "${p.name}" ignored`);
          continue;
        }
        const r = schemaToType(ctx, p.schema, `${toPascal(opName)}${toPascal(p.name)}`);
        paramMap.set(`${loc}:${p.name}`, {
          name: p.name,
          in: loc,
          type: r.type,
          required: loc === 'path' ? true : p.required === true,
          description: typeof p.description === 'string' ? p.description : undefined,
        });
      }
      // Path placeholders without a declared parameter default to required strings.
      for (const m of route.matchAll(/\{([^}]+)\}/g)) {
        if (!paramMap.has(`path:${m[1]}`)) {
          paramMap.set(`path:${m[1]}`, { name: m[1], in: 'path', type: t.scalar('string'), required: true });
        }
      }

      // Request body.
      let body: IRRestOperation['body'];
      let requestBody = opRaw.requestBody as unknown;
      if (isObj(requestBody) && typeof requestBody.$ref === 'string') requestBody = deref(ctx, requestBody.$ref);
      if (isObj(requestBody)) {
        const picked = pickJsonContent(requestBody.content);
        if (!picked || picked.kind !== 'json') {
          skip = `request body content type(s) ${isObj(requestBody.content) ? Object.keys(requestBody.content).join(', ') : '(none)'} not supported (only JSON)`;
        } else {
          const r = schemaToType(ctx, picked.schema, `${toPascal(opName)}Request`);
          body = { type: r.type, required: requestBody.required === true };
        }
      }

      // Success response.
      let response: IRRestOperation['response'];
      if (isObj(opRaw.responses)) {
        const codes = Object.keys(opRaw.responses);
        const success = codes
          .filter(c => /^2\d\d$/.test(c))
          .sort()[0];
        const chosen = success ?? (codes.includes('default') ? 'default' : undefined);
        if (chosen) {
          let resp = opRaw.responses[chosen] as unknown;
          if (isObj(resp) && typeof resp.$ref === 'string') resp = deref(ctx, resp.$ref);
          if (isObj(resp) && isObj(resp.content) && Object.keys(resp.content).length > 0) {
            const picked = pickJsonContent(resp.content);
            if (!picked) {
              skip = skip ?? `response content type(s) ${Object.keys(resp.content).join(', ')} not supported`;
            } else if (picked.kind === 'json') {
              const r = schemaToType(ctx, picked.schema, `${toPascal(opName)}Response`);
              response = { type: r.type };
            } else {
              response = { type: schemaToType(ctx, picked.schema, `${toPascal(opName)}Response`).type };
            }
          }
        }
      }

      if (skip) {
        ctx.warnings.push(`${method} ${route} (${opName}): skipped, ${skip}`);
        continue;
      }
      usedOpNames.add(opName);
      operations.push({
        protocol: 'rest',
        name: opName,
        method,
        path: route,
        summary: typeof opRaw.summary === 'string' ? opRaw.summary : undefined,
        description: typeof opRaw.description === 'string' ? opRaw.description : undefined,
        deprecated: opRaw.deprecated === true || undefined,
        params: [...paramMap.values()],
        body,
        response,
      });
    }
  }

  // Base URL from the first server (variables substituted by their defaults).
  let baseUrl: string | undefined;
  if (Array.isArray(raw.servers) && isObj(raw.servers[0]) && typeof raw.servers[0].url === 'string') {
    const server = raw.servers[0];
    let url = String(server.url);
    if (isObj(server.variables)) {
      for (const [k, v] of Object.entries(server.variables)) {
        if (isObj(v) && v.default !== undefined) url = url.replace(`{${k}}`, String(v.default));
      }
    }
    baseUrl = url.replace(/\/+$/, '');
  }

  const info = isObj(raw.info) ? raw.info : {};
  return {
    protocol: 'rest',
    title: typeof info.title === 'string' ? info.title : words(source.path).join(' '),
    version: typeof info.version === 'string' ? info.version : undefined,
    baseUrl,
    models: [...ctx.models.values()],
    operations,
    source,
    warnings: ctx.warnings,
  };
}
