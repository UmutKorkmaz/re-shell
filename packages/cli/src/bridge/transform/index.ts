// Data transformation across JSON / Protobuf / Avro / MessagePack, with
// backward-compatible schema evolution:
//   - Avro -> Avro uses Avro's writer/reader schema resolution (added fields need
//     defaults, removed fields are skipped, promotions allowed);
//   - Protobuf decoding is tolerant by construction (unknown fields are ignored,
//     missing ones take defaults), so old bytes decode with a newer .proto;
//   - migration rules (rename/add/remove/copy/convert) reshape the decoded value
//     before it is encoded in the target format.
// Canonical in-memory form: plain JS values; bytes are Buffers, 64-bit ints are
// strings (protobuf) or numbers (avro/JSON) and are coerced by the target schema.

import * as fs from 'fs';
import * as path from 'path';
import * as avro from 'avsc';
import { decode as msgpackDecode, encode as msgpackEncode } from '@msgpack/msgpack';
import * as protobuf from 'protobufjs';
import * as yaml from 'js-yaml';

import { loadProtoRoot } from '../spec/proto';

/** Supported data formats. */
export type DataFormat = 'json' | 'protobuf' | 'avro' | 'msgpack';

export const DATA_FORMATS: DataFormat[] = ['json', 'protobuf', 'avro', 'msgpack'];

/** Raised for any transformation failure (bad data, incompatible schemas, missing schema). */
export class BridgeTransformError extends Error {
  readonly code = 'BRIDGE_TRANSFORM_ERROR';
  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'BridgeTransformError';
  }
}

/** One side's schema: a .proto + message name, or an Avro schema. */
export interface SideSchema {
  /** `.proto` path (protobuf) or `.avsc`/`.json` path (avro). */
  file?: string;
  /** protobuf: fully-qualified or package-relative message name. */
  message?: string;
}

/** Migration rule (same vocabulary as the async contract). */
export type TransformRule =
  | { rename: { from: string; to: string } }
  | { add: { field: string; default: unknown } }
  | { remove: string }
  | { copy: { from: string; to: string } }
  | { convert: { field: string; to: 'string' | 'number' | 'integer' | 'boolean' } };

/** Inputs of {@link transform}. */
export interface TransformOptions {
  from: DataFormat;
  to: DataFormat;
  /** Raw input: JSON text (json) or bytes. */
  input: Buffer;
  fromSchema?: SideSchema;
  toSchema?: SideSchema;
  /** Applied to the decoded value before encoding. */
  rules?: TransformRule[];
  /** Pretty-print JSON output. */
  pretty?: boolean;
}

/** Output of {@link transform}. */
export interface TransformResult {
  from: DataFormat;
  to: DataFormat;
  /** Encoded output (text for json). */
  output: Buffer;
  /** The decoded, migrated value that was encoded. */
  value: unknown;
  /** What was done, in order. */
  steps: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !Buffer.isBuffer(v) && !(v instanceof Uint8Array);
}

// ---------------------------------------------------------------------------
// Protobuf
// ---------------------------------------------------------------------------

function loadProtoType(side: SideSchema | undefined, role: string): protobuf.Type {
  if (!side?.file || !side.message) {
    throw new BridgeTransformError(`protobuf ${role} needs a schema: pass --${role === 'source' ? 'from' : 'to'}-schema <file.proto> and --${role === 'source' ? 'from' : 'to'}-message <Message> (or --schema/--message)`);
  }
  const root = loadProtoRoot(path.resolve(side.file));
  const wanted = side.message.replace(/^\./, '');
  let found: protobuf.Type | undefined;
  try {
    found = root.lookupType(wanted);
  } catch {
    // package-relative or simple name: search all types
    const walk = (ns: protobuf.NamespaceBase): void => {
      for (const n of ns.nestedArray) {
        if (n instanceof protobuf.Type && (n.name === wanted || n.fullName.endsWith(`.${wanted}`))) found = found ?? n;
        if (n instanceof protobuf.Namespace) walk(n);
      }
    };
    walk(root);
  }
  if (!found) throw new BridgeTransformError(`message "${side.message}" not found in ${side.file}`);
  return found;
}

function protoDecode(type: protobuf.Type, bytes: Buffer): unknown {
  let message: protobuf.Message;
  try {
    message = type.decode(bytes);
  } catch (error: unknown) {
    throw new BridgeTransformError(`input is not a valid ${type.name} protobuf message: ${error instanceof Error ? error.message : String(error)}`);
  }
  return type.toObject(message, { longs: String, enums: String, bytes: Buffer, defaults: true, arrays: true, objects: true, oneofs: true });
}

const INT32 = new Set(['int32', 'uint32', 'sint32', 'fixed32', 'sfixed32']);
const INT64 = new Set(['int64', 'uint64', 'sint64', 'fixed64', 'sfixed64']);

function checkScalar(field: protobuf.Field, v: unknown, where: string, problems: string[]): void {
  const t = field.type;
  const resolved = field.resolvedType;
  if (resolved instanceof protobuf.Enum) {
    if (!((typeof v === 'string' && v in resolved.values) || (typeof v === 'number' && Object.values(resolved.values).includes(v)))) problems.push(`${where}: ${JSON.stringify(v)} is not a value of enum ${resolved.name}`);
    return;
  }
  if (resolved instanceof protobuf.Type) {
    if (!isObj(v)) problems.push(`${where}: expected an object for ${resolved.name}`);
    else checkMessage(resolved, v, where, problems, []);
    return;
  }
  const ok =
    t === 'string' ? typeof v === 'string'
    : t === 'bool' ? typeof v === 'boolean'
    : t === 'bytes' ? typeof v === 'string' || Buffer.isBuffer(v) || v instanceof Uint8Array
    : INT32.has(t) ? typeof v === 'number' && Number.isInteger(v)
    : INT64.has(t) ? (typeof v === 'number' && Number.isInteger(v)) || typeof v === 'bigint' || (typeof v === 'string' && /^-?\d+$/.test(v))
    : t === 'float' || t === 'double' ? typeof v === 'number'
    : true;
  if (!ok) problems.push(`${where}: expected ${t}, got ${Buffer.isBuffer(v) ? 'bytes' : typeof v === 'object' ? JSON.stringify(v) : `${typeof v} ${JSON.stringify(v)}`}`);
}

/** Strict structural check (protobufjs fromObject silently coerces garbage). Unknown keys are collected, not errors. */
function checkMessage(type: protobuf.Type, value: Record<string, unknown>, where: string, problems: string[], unknown: string[]): void {
  for (const [key, v] of Object.entries(value)) {
    const field = type.fields[key];
    const at = where ? `${where}.${key}` : key;
    if (!field) {
      unknown.push(at);
      continue;
    }
    if (v === null || v === undefined) continue;
    if (field instanceof protobuf.MapField) {
      if (!isObj(v)) problems.push(`${at}: expected a map object`);
      else for (const [mk, mv] of Object.entries(v)) checkScalar(field, mv, `${at}[${mk}]`, problems);
    } else if (field.repeated) {
      if (!Array.isArray(v)) problems.push(`${at}: expected an array`);
      else v.forEach((item, i) => checkScalar(field, item, `${at}[${i}]`, problems));
    } else {
      checkScalar(field, v, at, problems);
    }
  }
}

function dropUnknown(type: protobuf.Type, value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const field = type.fields[k];
    if (!field) continue;
    const nested = field.resolvedType instanceof protobuf.Type ? field.resolvedType : undefined;
    if (nested && isObj(v) && !(field instanceof protobuf.MapField)) out[k] = dropUnknown(nested, v);
    else if (nested && Array.isArray(v)) out[k] = v.map(i => (isObj(i) ? dropUnknown(nested, i) : i));
    else out[k] = v;
  }
  return out;
}

function protoEncode(type: protobuf.Type, value: unknown, steps: string[]): Buffer {
  if (!isObj(value)) throw new BridgeTransformError(`a ${type.name} message must be built from an object`);
  const problems: string[] = [];
  const unknown: string[] = [];
  checkMessage(type, value, '', problems, unknown);
  if (problems.length > 0) throw new BridgeTransformError(`value does not fit ${type.name}: ${problems.slice(0, 5).join('; ')}`, { problems });
  if (unknown.length > 0) steps.push(`dropped fields unknown to ${type.name}: ${unknown.join(', ')}`);
  try {
    return Buffer.from(type.encode(type.fromObject(dropUnknown(type, value))).finish());
  } catch (error: unknown) {
    throw new BridgeTransformError(`value does not fit ${type.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Avro
// ---------------------------------------------------------------------------

function loadAvroType(side: SideSchema | undefined, role: string): avro.Type {
  if (!side?.file) throw new BridgeTransformError(`avro ${role} needs a schema: pass --${role === 'source' ? 'from' : 'to'}-schema <file.avsc> (or --schema)`);
  let schema: unknown;
  try {
    schema = JSON.parse(fs.readFileSync(path.resolve(side.file), 'utf8'));
  } catch (error: unknown) {
    throw new BridgeTransformError(`cannot read Avro schema ${side.file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return avro.Type.forSchema(schema as avro.Schema, { wrapUnions: false });
  } catch (error: unknown) {
    throw new BridgeTransformError(`invalid Avro schema ${side.file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Coerce a JSON-ish value toward an Avro type (numeric strings, base64 bytes, nested). */
function coerceForAvro(type: avro.Type, value: unknown): unknown {
  const t = type as unknown as {
    typeName: string;
    fields?: { name: string; type: avro.Type; aliases?: string[] }[];
    itemsType?: avro.Type;
    valuesType?: avro.Type;
    types?: avro.Type[];
  };
  switch (t.typeName) {
    case 'long':
    case 'int':
    case 'float':
    case 'double':
      return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : typeof value === 'bigint' ? Number(value) : value;
    case 'bytes':
    case 'fixed':
      return typeof value === 'string' ? Buffer.from(value, 'base64') : value;
    case 'record':
    case 'error': {
      if (!isObj(value)) return value;
      const out: Record<string, unknown> = {};
      for (const f of t.fields ?? []) {
        if (f.name in value) out[f.name] = coerceForAvro(f.type, value[f.name]);
      }
      return out;
    }
    case 'array':
      return Array.isArray(value) ? value.map(v => coerceForAvro(t.itemsType as avro.Type, v)) : value;
    case 'map':
      return isObj(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, coerceForAvro(t.valuesType as avro.Type, v)])) : value;
    case 'union:unwrapped':
    case 'union:wrapped':
    case 'union': {
      if (value === null || value === undefined) return value;
      for (const member of t.types ?? []) {
        const coerced = coerceForAvro(member, value);
        if (member.isValid(coerced)) return coerced;
      }
      return value;
    }
    default:
      return value;
  }
}

/** Avro value -> JSON-compatible canonical value (Buffers kept; unions are unwrapped already). */
function avroToCanonical(value: unknown): unknown {
  return value;
}

function avroEncode(type: avro.Type, value: unknown): Buffer {
  const coerced = coerceForAvro(type, value);
  const errors: string[] = [];
  if (!type.isValid(coerced, { errorHook: (p, v) => errors.push(`${p.join('.') || '(root)'}: ${JSON.stringify(v)}`) })) {
    throw new BridgeTransformError(`value does not fit the Avro schema (${errors.slice(0, 3).join('; ') || 'invalid'})`, { errors });
  }
  return type.toBuffer(coerced);
}

// ---------------------------------------------------------------------------
// JSON bytes <-> base64, canonical conversions
// ---------------------------------------------------------------------------

/** Replace Buffers/Uint8Arrays by base64 strings (for JSON output). */
export function bytesToBase64(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(bytesToBase64);
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bytesToBase64(v)]));
  return value;
}

// ---------------------------------------------------------------------------
// Migration rules
// ---------------------------------------------------------------------------

/** Parse a rules file (YAML/JSON): either a list of rules or `{ rules: [...] }`. */
export function loadRules(file: string): TransformRule[] {
  let doc: unknown;
  try {
    doc = yaml.load(fs.readFileSync(file, 'utf8'));
  } catch (error: unknown) {
    throw new BridgeTransformError(`cannot read migration rules ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const list = Array.isArray(doc) ? doc : isObj(doc) && Array.isArray(doc.rules) ? doc.rules : undefined;
  if (!list) throw new BridgeTransformError(`${file}: expected a list of rules or { rules: [...] }`);
  return list.map((r, i) => {
    if (!isObj(r) || Object.keys(r).length !== 1) throw new BridgeTransformError(`${file}: rule ${i} must have exactly one key (rename|add|remove|copy|convert)`);
    const [op] = Object.keys(r);
    if (!['rename', 'add', 'remove', 'copy', 'convert'].includes(op)) throw new BridgeTransformError(`${file}: rule ${i} has unknown operation "${op}"`);
    return r as unknown as TransformRule;
  });
}

/** Apply migration rules to a decoded value (returns a new object). */
export function applyRules(value: unknown, rules: TransformRule[]): unknown {
  if (rules.length === 0) return value;
  if (!isObj(value)) throw new BridgeTransformError('migration rules apply to objects only');
  const out: Record<string, unknown> = { ...value };
  for (const rule of rules) {
    if ('rename' in rule) {
      if (!(rule.rename.from in out)) throw new BridgeTransformError(`rename: field "${rule.rename.from}" is missing from the input`);
      out[rule.rename.to] = out[rule.rename.from];
      delete out[rule.rename.from];
    } else if ('copy' in rule) {
      if (!(rule.copy.from in out)) throw new BridgeTransformError(`copy: field "${rule.copy.from}" is missing from the input`);
      out[rule.copy.to] = out[rule.copy.from];
    } else if ('add' in rule) {
      if (out[rule.add.field] === undefined || out[rule.add.field] === null) out[rule.add.field] = rule.add.default;
    } else if ('remove' in rule) {
      delete out[rule.remove];
    } else {
      const f = rule.convert.field;
      if (out[f] === undefined || out[f] === null) continue;
      switch (rule.convert.to) {
        case 'string':
          out[f] = String(out[f]);
          break;
        case 'number':
          out[f] = Number(out[f]);
          break;
        case 'integer':
          out[f] = Math.trunc(Number(out[f]));
          break;
        case 'boolean':
          out[f] = Boolean(out[f]);
          break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The transform
// ---------------------------------------------------------------------------

/** Resolve one `--schema`/`--from-schema` argument pair. */
export function sideSchema(file: string | undefined, message: string | undefined): SideSchema | undefined {
  return file || message ? { file, message } : undefined;
}

/**
 * Convert `input` from one format to another.
 *
 * @throws BridgeTransformError for undecodable input, a missing/invalid schema,
 *   a value that does not fit the target schema, or incompatible Avro schemas.
 */
export function transform(options: TransformOptions): TransformResult {
  const { from, to } = options;
  if (!DATA_FORMATS.includes(from) || !DATA_FORMATS.includes(to)) {
    throw new BridgeTransformError(`formats must be one of ${DATA_FORMATS.join(', ')} (got ${from} -> ${to})`);
  }
  const steps: string[] = [];
  const rules = options.rules ?? [];

  // Avro -> Avro: writer/reader schema resolution (the standards-based evolution path).
  if (from === 'avro' && to === 'avro' && options.fromSchema?.file && options.toSchema?.file) {
    const writer = loadAvroType(options.fromSchema, 'source');
    const reader = loadAvroType(options.toSchema, 'target');
    let resolver: ReturnType<avro.Type['createResolver']>;
    try {
      resolver = reader.createResolver(writer);
    } catch (error: unknown) {
      throw new BridgeTransformError(`Avro schemas are not compatible (reader cannot read writer's data): ${error instanceof Error ? error.message : String(error)}`);
    }
    let value: unknown;
    try {
      value = reader.fromBuffer(options.input, resolver, true);
    } catch (error: unknown) {
      throw new BridgeTransformError(`input is not valid Avro for the source schema: ${error instanceof Error ? error.message : String(error)}`);
    }
    steps.push('decoded with the writer schema and resolved to the reader schema (Avro schema resolution)');
    if (rules.length) {
      value = applyRules(value, rules);
      steps.push(`applied ${rules.length} migration rule(s)`);
    }
    steps.push('encoded as avro');
    return { from, to, value: avroToCanonical(value), output: avroEncode(reader, value), steps };
  }

  // 1. decode
  let value: unknown;
  switch (from) {
    case 'json':
      try {
        value = JSON.parse(options.input.toString('utf8'));
      } catch (error: unknown) {
        throw new BridgeTransformError(`input is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
      steps.push('parsed JSON');
      break;
    case 'msgpack':
      try {
        value = msgpackDecode(options.input);
      } catch (error: unknown) {
        throw new BridgeTransformError(`input is not valid MessagePack: ${error instanceof Error ? error.message : String(error)}`);
      }
      steps.push('decoded MessagePack');
      break;
    case 'protobuf': {
      const type = loadProtoType(options.fromSchema, 'source');
      value = protoDecode(type, options.input);
      steps.push(`decoded protobuf ${type.fullName.replace(/^\./, '')}`);
      break;
    }
    case 'avro': {
      const type = loadAvroType(options.fromSchema, 'source');
      try {
        value = type.fromBuffer(options.input, undefined, true);
      } catch (error: unknown) {
        throw new BridgeTransformError(`input is not valid Avro for the source schema: ${error instanceof Error ? error.message : String(error)}`);
      }
      steps.push('decoded avro');
      break;
    }
  }

  // 2. migrate
  if (rules.length) {
    value = applyRules(value, rules);
    steps.push(`applied ${rules.length} migration rule(s)`);
  }

  // 3. encode
  let output: Buffer;
  switch (to) {
    case 'json':
      output = Buffer.from(JSON.stringify(bytesToBase64(value), null, options.pretty ? 2 : undefined) + '\n', 'utf8');
      steps.push('encoded JSON (bytes as base64, 64-bit integers as strings)');
      break;
    case 'msgpack':
      output = Buffer.from(msgpackEncode(typeof value === 'bigint' ? value.toString() : value));
      steps.push('encoded MessagePack');
      break;
    case 'protobuf': {
      const type = loadProtoType(options.toSchema, 'target');
      output = protoEncode(type, value, steps);
      steps.push(`encoded protobuf ${type.fullName.replace(/^\./, '')}`);
      break;
    }
    case 'avro': {
      const type = loadAvroType(options.toSchema, 'target');
      output = avroEncode(type, value);
      steps.push('encoded avro');
      break;
    }
  }
  return { from, to, value, output, steps };
}
