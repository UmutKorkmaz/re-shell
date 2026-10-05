// Deterministic example data from OpenAPI schemas (used by the REST mock).

type Json = Record<string, unknown>;

function isObj(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolve a local `#/...` pointer inside `doc`. */
export function derefPointer(doc: Json, ref: string): Json | undefined {
  if (!ref.startsWith('#/')) return undefined;
  let node: unknown = doc;
  for (const raw of ref.slice(2).split('/')) {
    const seg = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObj(node) || !(seg in node)) return undefined;
    node = node[seg];
  }
  return isObj(node) ? node : undefined;
}

/** Options for {@link synthesize}. */
export interface SynthOptions {
  /** Maximum object nesting. */
  maxDepth?: number;
}

/**
 * Produce an example value for `schema`. Uses `example` / `default` / first
 * `enum` value when present, otherwise a type-based placeholder. Recursive
 * `$ref`s are cut (optional recursive properties are omitted).
 */
export function synthesize(doc: Json, schema: unknown, options: SynthOptions = {}, stack: string[] = [], depth = 0): unknown {
  const maxDepth = options.maxDepth ?? 6;
  if (!isObj(schema)) return null;

  if (typeof schema.$ref === 'string') {
    if (stack.includes(schema.$ref)) return undefined;
    const target = derefPointer(doc, schema.$ref);
    if (!target) return null;
    return synthesize(doc, target, options, [...stack, schema.$ref], depth);
  }
  if ('example' in schema) return schema.example;
  if ('default' in schema && schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  if (Array.isArray(schema.allOf)) {
    const merged: Json = {};
    let scalar: unknown;
    for (const part of schema.allOf) {
      const v = synthesize(doc, part, options, stack, depth);
      if (isObj(v)) Object.assign(merged, v);
      else if (v !== undefined) scalar = v;
    }
    if (isObj(schema.properties)) Object.assign(merged, synthesize(doc, { ...schema, allOf: undefined }, options, stack, depth) as Json);
    return Object.keys(merged).length > 0 || scalar === undefined ? merged : scalar;
  }
  const alt = Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : undefined;
  if (alt && alt.length > 0) {
    const first = alt.find(a => !(isObj(a) && a.type === 'null')) ?? alt[0];
    return synthesize(doc, first, options, stack, depth);
  }

  let type = schema.type;
  if (Array.isArray(type)) type = type.find(t => t !== 'null') ?? type[0];
  if (type === undefined) {
    if (isObj(schema.properties)) type = 'object';
    else if (schema.items !== undefined) type = 'array';
  }

  switch (type) {
    case 'string': {
      switch (schema.format) {
        case 'date-time':
          return '2024-01-01T00:00:00Z';
        case 'date':
          return '2024-01-01';
        case 'uuid':
          return '00000000-0000-4000-8000-000000000000';
        case 'email':
          return 'user@example.com';
        case 'uri':
        case 'url':
          return 'https://example.com';
        case 'byte':
          return Buffer.from('mock').toString('base64');
        default: {
          const min = typeof schema.minLength === 'number' ? schema.minLength : 0;
          return 'string'.padEnd(min, 'x');
        }
      }
    }
    case 'integer': {
      const min = typeof schema.minimum === 'number' ? Math.ceil(schema.minimum) : 1;
      const max = typeof schema.maximum === 'number' ? Math.floor(schema.maximum) : undefined;
      return max !== undefined && min > max ? max : min;
    }
    case 'number': {
      const min = typeof schema.minimum === 'number' ? schema.minimum : 1.5;
      const max = typeof schema.maximum === 'number' ? schema.maximum : undefined;
      return max !== undefined && min > max ? max : min;
    }
    case 'boolean':
      return true;
    case 'array': {
      const count = typeof schema.minItems === 'number' ? Math.max(1, schema.minItems) : 1;
      if (depth >= maxDepth) return [];
      const item = synthesize(doc, schema.items, options, stack, depth + 1);
      return item === undefined ? [] : Array.from({ length: count }, () => item);
    }
    case 'object': {
      const out: Json = {};
      const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
      if (isObj(schema.properties)) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          if (depth >= maxDepth && !required.has(key)) continue;
          const v = synthesize(doc, prop, options, stack, depth + 1);
          if (v === undefined) continue; // recursive optional property
          out[key] = v;
        }
      } else if (isObj(schema.additionalProperties)) {
        const v = synthesize(doc, schema.additionalProperties, options, stack, depth + 1);
        if (v !== undefined) out.key = v;
      }
      return out;
    }
    default:
      return null;
  }
}
