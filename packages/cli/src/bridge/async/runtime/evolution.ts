// Schema evolution: versioned message definitions with upcasters, plus a small
// structural payload validator.
//
// A message evolves by bumping `currentVersion` and adding an upcaster that
// turns a version-N payload into version N+1. Consumers always see the current
// shape: older payloads are upcast through the chain, so producers and
// consumers can be deployed independently (backward compatibility).

/** Field type grammar: `string | number | integer | boolean | datetime | any | object`,
 * `T[]` for arrays, a trailing `?` for optional, `enum(a|b)` for enums, or a nested object of specs. */
export type FieldSpec = string | { [field: string]: FieldSpec };

/** Field name -> spec. */
export type FieldSchema = { [field: string]: FieldSpec };

/** A versioned message type. */
export interface MessageDefinition<T = unknown> {
  /** Message type name, e.g. `OrderCreated`. */
  type: string;
  /** Topic / stream the message is published on. */
  channel: string;
  /** Version producers stamp on new messages and consumers expect after upcasting. */
  currentVersion: number;
  /** Oldest version consumers still accept (default 1). */
  minVersion?: number;
  /** Structural schema of the CURRENT version. */
  schema: FieldSchema;
  /** upcasters[n] converts a version-n payload into version n+1. */
  upcasters: { [fromVersion: number]: (payload: any) => any };
  /** Phantom marker so `T` is part of the type. */
  readonly __payload?: T;
}

/** Thrown when a payload's version cannot be brought to the current version. */
export class SchemaVersionError extends Error {
  constructor(
    readonly messageType: string,
    readonly version: number,
    readonly currentVersion: number,
    reason: string
  ) {
    super(`${messageType} v${version} cannot be read (current v${currentVersion}): ${reason}`);
    this.name = 'SchemaVersionError';
  }
}

/** Thrown when a payload does not match the schema. */
export class ValidationError extends Error {
  constructor(readonly messageType: string, readonly problems: string[]) {
    super(`${messageType} payload is invalid: ${problems.join('; ')}`);
    this.name = 'ValidationError';
  }
}

/**
 * Declare a message type, checking at definition time that every supported
 * older version has an upcaster (so a missing migration fails at startup, not
 * on the first old message in production).
 */
export function defineMessage<T = unknown>(def: MessageDefinition<T>): MessageDefinition<T> {
  const min = def.minVersion ?? 1;
  if (!Number.isInteger(def.currentVersion) || def.currentVersion < 1) {
    throw new Error(`${def.type}: currentVersion must be a positive integer`);
  }
  if (min < 1 || min > def.currentVersion) throw new Error(`${def.type}: minVersion must be between 1 and currentVersion`);
  for (let v = min; v < def.currentVersion; v++) {
    if (typeof def.upcasters[v] !== 'function') {
      throw new Error(`${def.type}: no upcaster from v${v} to v${v + 1} (supported versions are v${min}..v${def.currentVersion})`);
    }
  }
  return def;
}

/**
 * Bring `payload` (produced at `fromVersion`) to the current version.
 *
 * @param options.acceptNewer - read messages from a NEWER producer as-is
 *   (forward compatibility: unknown fields are ignored). Default: reject.
 * @throws SchemaVersionError for versions older than `minVersion`, or newer
 *   than current unless `acceptNewer`.
 */
export function upcastPayload(
  def: MessageDefinition,
  payload: unknown,
  fromVersion: number,
  options: { acceptNewer?: boolean } = {}
): unknown {
  const min = def.minVersion ?? 1;
  if (fromVersion === def.currentVersion) return payload;
  if (fromVersion > def.currentVersion) {
    if (options.acceptNewer) return payload;
    throw new SchemaVersionError(def.type, fromVersion, def.currentVersion, 'produced by a newer schema; upgrade this consumer or enable acceptNewer');
  }
  if (fromVersion < min) {
    throw new SchemaVersionError(def.type, fromVersion, def.currentVersion, `older than the oldest supported version v${min}`);
  }
  let value = payload;
  for (let v = fromVersion; v < def.currentVersion; v++) {
    const up = def.upcasters[v];
    if (typeof up !== 'function') throw new SchemaVersionError(def.type, fromVersion, def.currentVersion, `missing upcaster v${v} -> v${v + 1}`);
    value = up(value);
  }
  return value;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkSpec(spec: FieldSpec, value: unknown, path: string, problems: string[]): void {
  if (typeof spec !== 'string') {
    if (!isPlainObject(value)) {
      problems.push(`${path} must be an object`);
      return;
    }
    checkObject(spec, value, path, problems);
    return;
  }
  let s = spec.trim();
  const optional = s.endsWith('?');
  if (optional) s = s.slice(0, -1);
  if (value === undefined || value === null) {
    if (!optional) problems.push(`${path} is required`);
    return;
  }
  if (s.endsWith('[]')) {
    if (!Array.isArray(value)) {
      problems.push(`${path} must be an array`);
      return;
    }
    value.forEach((item, i) => checkSpec(s.slice(0, -2), item, `${path}[${i}]`, problems));
    return;
  }
  const en = /^enum\((.*)\)$/.exec(s);
  if (en) {
    if (typeof value !== 'string' || !en[1].split('|').includes(value)) problems.push(`${path} must be one of ${en[1]}`);
    return;
  }
  switch (s) {
    case 'string':
      if (typeof value !== 'string') problems.push(`${path} must be a string`);
      break;
    case 'datetime':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) problems.push(`${path} must be an ISO-8601 datetime string`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`${path} must be a number`);
      break;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) problems.push(`${path} must be an integer`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') problems.push(`${path} must be a boolean`);
      break;
    case 'object':
      if (!isPlainObject(value)) problems.push(`${path} must be an object`);
      break;
    case 'any':
      break;
    default:
      problems.push(`${path}: unknown type "${s}" in schema`);
  }
}

function checkObject(schema: FieldSchema, value: Record<string, unknown>, path: string, problems: string[]): void {
  for (const [field, spec] of Object.entries(schema)) {
    checkSpec(spec, value[field], path ? `${path}.${field}` : field, problems);
  }
}

/** Validate `payload` against `schema`; returns the problems (empty when valid). Unknown fields are allowed. */
export function validatePayload(schema: FieldSchema, payload: unknown): string[] {
  const problems: string[] = [];
  if (!isPlainObject(payload)) return ['payload must be an object'];
  checkObject(schema, payload, '', problems);
  return problems;
}
