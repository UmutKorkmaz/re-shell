// The async contract: a small YAML/JSON description of the messages a service
// publishes/consumes, their versions and how to migrate old payloads forward.
//
//   service: orders
//   messages:
//     OrderCreated:
//       channel: orders.created        # topic / stream (default: kebab/dot of the name)
//       currentVersion: 2
//       versions:
//         1: { fields: { orderId: string, amount: number } }
//         2:
//           fields: { orderId: string, total: number, currency: "enum(USD|EUR)" }
//           migrate:                    # how a v1 payload becomes v2
//             - rename: { from: amount, to: total }
//             - add: { field: currency, default: USD }
//
// Field types: string number integer boolean datetime any object, T[] arrays,
// a trailing ? for optional, enum(a|b). Migration rules: rename, add (default),
// remove, copy, convert (to string|number|integer|boolean).

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { BridgeSpecError } from '../spec/errors';
import { toPascal } from '../naming';

/** One migration step applied to a payload. */
export type MigrateRule =
  | { rename: { from: string; to: string } }
  | { add: { field: string; default: unknown } }
  | { remove: string }
  | { copy: { from: string; to: string } }
  | { convert: { field: string; to: 'string' | 'number' | 'integer' | 'boolean' } };

/** One schema version of a message. */
export interface AsyncVersion {
  version: number;
  fields: Record<string, string>;
  /** Rules turning the PREVIOUS version's payload into this one. */
  migrate: MigrateRule[];
}

/** A message type. */
export interface AsyncMessage {
  name: string;
  channel: string;
  currentVersion: number;
  versions: AsyncVersion[];
}

/** Parsed async contract. */
export interface AsyncContract {
  service: string;
  messages: AsyncMessage[];
  source: { path: string; sha256: string };
}

const SCALARS = new Set(['string', 'number', 'integer', 'boolean', 'datetime', 'any', 'object']);

/** Validate one field type string. */
export function checkFieldType(spec: string): string | undefined {
  let s = spec.trim();
  if (s.endsWith('?')) s = s.slice(0, -1);
  while (s.endsWith('[]')) s = s.slice(0, -2);
  if (SCALARS.has(s)) return undefined;
  if (/^enum\([A-Za-z0-9_.\-|]+\)$/.test(s)) return undefined;
  return `unknown field type "${spec}"`;
}

function base(spec: string): string {
  let s = spec.trim();
  if (s.endsWith('?')) s = s.slice(0, -1);
  return s;
}

function optional(spec: string): boolean {
  return spec.trim().endsWith('?');
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(message: string): never {
  throw new BridgeSpecError(message);
}

function parseRules(where: string, raw: unknown): MigrateRule[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) fail(`${where}: migrate must be a list of rules`);
  return raw.map((r, i) => {
    const at = `${where}.migrate[${i}]`;
    if (!isObj(r) || Object.keys(r).length !== 1) fail(`${at}: each rule has exactly one key (rename|add|remove|copy|convert)`);
    const [op, arg] = Object.entries(r)[0];
    switch (op) {
      case 'rename':
      case 'copy':
        if (!isObj(arg) || typeof arg.from !== 'string' || typeof arg.to !== 'string') fail(`${at}: ${op} needs { from, to }`);
        return { [op]: { from: arg.from, to: arg.to } } as MigrateRule;
      case 'add':
        if (!isObj(arg) || typeof arg.field !== 'string' || !('default' in arg)) fail(`${at}: add needs { field, default }`);
        return { add: { field: arg.field, default: arg.default } };
      case 'remove':
        if (typeof arg !== 'string') fail(`${at}: remove needs a field name`);
        return { remove: arg };
      case 'convert':
        if (!isObj(arg) || typeof arg.field !== 'string' || !['string', 'number', 'integer', 'boolean'].includes(String(arg.to))) {
          fail(`${at}: convert needs { field, to: string|number|integer|boolean }`);
        }
        return { convert: { field: arg.field, to: arg.to as 'string' } };
      default:
        return fail(`${at}: unknown rule "${op}"`);
    }
  });
}

/** Simulate migrate rules on a field-spec map; returns the resulting map. */
export function applyRulesToSchema(from: Record<string, string>, rules: MigrateRule[], target: Record<string, string>, where: string): Record<string, string> {
  const cur: Record<string, string> = { ...from };
  for (const rule of rules) {
    if ('rename' in rule) {
      if (!(rule.rename.from in cur)) fail(`${where}: rename source "${rule.rename.from}" does not exist`);
      cur[rule.rename.to] = cur[rule.rename.from];
      delete cur[rule.rename.from];
    } else if ('copy' in rule) {
      if (!(rule.copy.from in cur)) fail(`${where}: copy source "${rule.copy.from}" does not exist`);
      cur[rule.copy.to] = cur[rule.copy.from];
    } else if ('add' in rule) {
      const t = target[rule.add.field];
      if (t === undefined) fail(`${where}: add targets "${rule.add.field}", which is not a field of the new version`);
      cur[rule.add.field] = t;
    } else if ('remove' in rule) {
      if (!(rule.remove in cur)) fail(`${where}: remove target "${rule.remove}" does not exist`);
      delete cur[rule.remove];
    } else {
      const t = target[rule.convert.field];
      if (!(rule.convert.field in cur) || t === undefined) fail(`${where}: convert needs "${rule.convert.field}" in both versions`);
      cur[rule.convert.field] = t;
    }
  }
  return cur;
}

/** Parse + validate an async contract file. @throws BridgeSpecError */
export function loadAsyncContract(file: string, serviceFallback?: string): AsyncContract {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error: unknown) {
    throw new BridgeSpecError(`cannot read async contract ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  let doc: unknown;
  try {
    doc = file.endsWith('.json') ? JSON.parse(text) : yaml.load(text);
  } catch (error: unknown) {
    throw new BridgeSpecError(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isObj(doc) || !isObj(doc.messages)) fail(`${file}: an async contract needs a "messages" map`);
  const service = typeof doc.service === 'string' ? doc.service : serviceFallback;
  if (!service) fail(`${file}: missing "service" (or pass --service)`);

  const messages: AsyncMessage[] = [];
  const channels = new Map<string, string>();
  for (const [name, raw] of Object.entries(doc.messages)) {
    const where = `messages.${name}`;
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`${where}: message names must be PascalCase identifiers`);
    if (!isObj(raw) || !isObj(raw.versions)) fail(`${where}: needs a "versions" map`);
    const channel = typeof raw.channel === 'string' ? raw.channel : name.replace(/([a-z0-9])([A-Z])/g, '$1.$2').toLowerCase();
    if (channels.has(channel)) fail(`${where}: channel "${channel}" is already used by ${channels.get(channel)}`);
    channels.set(channel, name);

    const versions: AsyncVersion[] = Object.entries(raw.versions)
      .map(([v, def]) => {
        const version = Number(v);
        if (!Number.isInteger(version) || version < 1) fail(`${where}: version keys must be positive integers (got "${v}")`);
        if (!isObj(def) || !isObj(def.fields)) fail(`${where}.versions.${v}: needs a "fields" map`);
        const fields: Record<string, string> = {};
        for (const [f, spec] of Object.entries(def.fields)) {
          if (typeof spec !== 'string') fail(`${where}.versions.${v}.fields.${f}: type must be a string`);
          const problem = checkFieldType(spec);
          if (problem) fail(`${where}.versions.${v}.fields.${f}: ${problem}`);
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f)) fail(`${where}.versions.${v}.fields.${f}: field names must be identifiers`);
          fields[f] = spec.trim();
        }
        return { version, fields, migrate: parseRules(`${where}.versions.${v}`, def.migrate) };
      })
      .sort((a, b) => a.version - b.version);
    if (versions.length === 0) fail(`${where}: no versions`);
    for (let i = 0; i < versions.length; i++) {
      if (versions[i].version !== versions[0].version + i) fail(`${where}: versions must be contiguous (found ${versions.map(v => v.version).join(', ')})`);
    }
    const current = typeof raw.currentVersion === 'number' ? raw.currentVersion : versions[versions.length - 1].version;
    if (current !== versions[versions.length - 1].version) fail(`${where}: currentVersion ${current} must be the highest declared version (${versions[versions.length - 1].version})`);

    // Every upgrade must be fully described: simulate the rules and compare with the next schema.
    for (let i = 1; i < versions.length; i++) {
      const prev = versions[i - 1];
      const next = versions[i];
      const at = `${where}.versions.${next.version}`;
      const result = applyRulesToSchema(prev.fields, next.migrate, next.fields, at);
      for (const [f, spec] of Object.entries(next.fields)) {
        if (!(f in result)) {
          if (optional(spec)) continue;
          fail(`${at}: field "${f}" is required but v${prev.version} has no source for it; add a migrate rule (rename/copy/add) for it`);
        }
        if (base(result[f]) !== base(spec) && !next.migrate.some(r => 'add' in r && r.add.field === f)) {
          fail(`${at}: field "${f}" changes type ${result[f]} -> ${spec}; add a convert rule`);
        }
        if (optional(result[f]) && !optional(spec)) {
          fail(`${at}: field "${f}" was optional in v${prev.version} but is required in v${next.version}; add a default with an add rule`);
        }
      }
      for (const rule of next.migrate) {
        if ('add' in rule) {
          const problem = valueProblem(next.fields[rule.add.field], rule.add.default);
          if (problem) fail(`${at}: add default for "${rule.add.field}" ${problem}`);
        }
      }
    }
    messages.push({ name, channel, currentVersion: current, versions });
  }
  return { service: service as string, messages, source: { path: file, sha256: crypto.createHash('sha256').update(text).digest('hex') } };
}

function valueProblem(spec: string, value: unknown): string | undefined {
  const s = base(spec);
  if (value === null) return optional(spec) ? undefined : 'cannot be null';
  if (s.endsWith('[]')) return Array.isArray(value) ? undefined : 'must be an array';
  const en = /^enum\((.*)\)$/.exec(s);
  if (en) return typeof value === 'string' && en[1].split('|').includes(value) ? undefined : `must be one of ${en[1]}`;
  switch (s) {
    case 'string':
    case 'datetime':
      return typeof value === 'string' ? undefined : 'must be a string';
    case 'number':
      return typeof value === 'number' ? undefined : 'must be a number';
    case 'integer':
      return Number.isInteger(value) ? undefined : 'must be an integer';
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'must be a boolean';
    case 'object':
      return isObj(value) ? undefined : 'must be an object';
    default:
      return undefined;
  }
}

/** PascalCase message name -> version type name, e.g. `OrderCreatedV2`. */
export function versionTypeName(message: string, version: number): string {
  return `${toPascal(message)}V${version}`;
}
