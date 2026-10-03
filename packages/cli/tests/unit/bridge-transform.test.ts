import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runTransform } from '../../src/bridge/transform/command';
import { BridgeTransformError, DATA_FORMATS, applyRules, loadRules, sideSchema, transform, type DataFormat, type SideSchema } from '../../src/bridge/transform';

const FIX = path.join(__dirname, '..', 'fixtures', 'bridge-transform');
const f = (name: string): string => path.join(FIX, name);

const USER = {
  id: 'u-1',
  name: 'Ada',
  age: 36,
  legacy: 'old-value',
  tags: ['a', 'b'],
  balance: '1234567890123',
  role: 'ADMIN',
  avatar: Buffer.from([1, 2, 3, 250]).toString('base64'),
  address: { city: 'London', zip: 'N1' },
  labels: { k: 'v' },
};

const PROTO_V1: SideSchema = { file: f('user.v1.proto'), message: 'User' };
const PROTO_V2: SideSchema = { file: f('user.v2.proto'), message: 'User' };
const AVRO_V1: SideSchema = { file: f('user.v1.avsc') };
const AVRO_V2: SideSchema = { file: f('user.v2.avsc') };

function schemaFor(format: DataFormat, version: 1 | 2 = 1): SideSchema | undefined {
  if (format === 'protobuf') return version === 1 ? PROTO_V1 : PROTO_V2;
  if (format === 'avro') return version === 1 ? AVRO_V1 : AVRO_V2;
  return undefined;
}

const json = (v: unknown): Buffer => Buffer.from(JSON.stringify(v));
const parse = (b: Buffer): Record<string, unknown> => JSON.parse(b.toString('utf8'));

function convert(from: DataFormat, to: DataFormat, input: Buffer, version: 1 | 2 = 1) {
  return transform({ from, to, input, fromSchema: schemaFor(from, version), toSchema: schemaFor(to, version) });
}

/** 64-bit ints are strings in protobuf and numbers in Avro/JSON: compare through String(). */
function normalize(v: Record<string, unknown>): Record<string, unknown> {
  return { ...v, balance: String(v.balance) };
}

describe('transform: round trips across every pair of formats', () => {
  it.each(DATA_FORMATS.flatMap(a => DATA_FORMATS.filter(b => b !== a).map(b => [a, b] as const)))('%s -> %s -> json preserves the data', (a, b) => {
    // json -> a -> b -> json
    const viaA = convert('json', a, json(USER)).output;
    const viaB = convert(a, b, viaA).output;
    const back = parse(convert(b, 'json', viaB).output);
    const expected = normalize(USER);
    // protobuf adds default-valued fields only for fields that are unset; every field is set here
    expect(normalize(back)).toEqual(expected);
  });

  it('each binary format really is binary and decodes back to the same JSON', () => {
    for (const fmt of ['protobuf', 'avro', 'msgpack'] as const) {
      const out = convert('json', fmt, json(USER)).output;
      expect(() => JSON.parse(out.toString('utf8'))).toThrow();
      expect(normalize(parse(convert(fmt, 'json', out).output))).toEqual(normalize(USER));
    }
  });

  it('bytes are carried as base64 in JSON and survive protobuf / avro / msgpack', () => {
    for (const fmt of ['protobuf', 'avro', 'msgpack'] as const) {
      const out = convert('json', fmt, json(USER)).output;
      expect(parse(convert(fmt, 'json', out).output).avatar).toBe(USER.avatar);
    }
  });

  it('64-bit integers beyond 2^53 stay exact through protobuf (as strings)', () => {
    const big = { ...USER, balance: '9007199254740993' };
    const out = convert('json', 'protobuf', json(big)).output;
    expect(parse(convert('protobuf', 'json', out).output).balance).toBe('9007199254740993');
  });
});

describe('transform: schema evolution (added / removed optional fields)', () => {
  it('protobuf: bytes written with v1 decode with v2 (removed field ignored, added field defaulted)', () => {
    const v1 = convert('json', 'protobuf', json(USER), 1).output;
    const read = transform({ from: 'protobuf', to: 'json', input: v1, fromSchema: PROTO_V2 });
    const value = parse(read.output);
    expect(value.legacy).toBeUndefined(); // field 4 is unknown to v2
    expect(value.email).toBe(''); // new field takes its default
    expect(value).toEqual(expect.objectContaining({ id: 'u-1', name: 'Ada', age: 36, tags: ['a', 'b'], role: 'ADMIN' }));
  });

  it('protobuf: bytes written with v2 decode with v1 (new field ignored, removed field defaulted)', () => {
    const v2 = transform({ from: 'json', to: 'protobuf', input: json({ ...USER, legacy: undefined, email: 'ada@example.com' }), toSchema: PROTO_V2 }).output;
    const value = parse(transform({ from: 'protobuf', to: 'json', input: v2, fromSchema: PROTO_V1 }).output);
    expect(value.legacy).toBe('');
    expect(value.email).toBeUndefined();
    expect(value.name).toBe('Ada');
  });

  it('protobuf -> protobuf upgrades old bytes to the new schema, dropping fields the new schema no longer has', () => {
    const v1 = convert('json', 'protobuf', json(USER), 1).output;
    const upgraded = transform({ from: 'protobuf', to: 'protobuf', input: v1, fromSchema: PROTO_V1, toSchema: PROTO_V2 });
    const value = parse(transform({ from: 'protobuf', to: 'json', input: upgraded.output, fromSchema: PROTO_V2 }).output);
    expect(value).toEqual(expect.objectContaining({ id: 'u-1', email: '' }));
    expect(upgraded.steps.some(s => /dropped fields unknown to User: legacy/.test(s))).toBe(true);
  });

  it('avro: v1 data is read with the v2 reader schema (removed field skipped, added fields take their defaults)', () => {
    const v1 = convert('json', 'avro', json(USER), 1).output;
    const r = transform({ from: 'avro', to: 'avro', input: v1, fromSchema: AVRO_V1, toSchema: AVRO_V2 });
    expect(r.steps[0]).toMatch(/Avro schema resolution/);
    const value = parse(transform({ from: 'avro', to: 'json', input: r.output, fromSchema: AVRO_V2 }).output);
    expect(value.legacy).toBeUndefined();
    expect(value.email).toBeNull();
    expect(value.nickname).toBe('');
    expect(value.name).toBe('Ada');
  });

  it('avro: v2 data is read with the v1 reader schema (the removed field has a default, so it is compatible)', () => {
    const v2 = transform({ from: 'json', to: 'avro', input: json({ ...USER, legacy: undefined, email: 'e@x.io', nickname: 'ada' }), toSchema: AVRO_V2 }).output;
    const r = transform({ from: 'avro', to: 'avro', input: v2, fromSchema: AVRO_V2, toSchema: AVRO_V1 });
    const value = parse(transform({ from: 'avro', to: 'json', input: r.output, fromSchema: AVRO_V1 }).output);
    expect(value.legacy).toBeNull();
    expect(value.email).toBeUndefined();
  });

  it('avro: an incompatible reader schema (new required field, no default) fails explicitly', () => {
    const v1 = convert('json', 'avro', json(USER), 1).output;
    expect(() => transform({ from: 'avro', to: 'avro', input: v1, fromSchema: AVRO_V1, toSchema: { file: f('user.v3-incompatible.avsc') } })).toThrow(/not compatible/);
  });

  it('json -> avro/protobuf with a missing optional field and an extra unknown field', () => {
    const { legacy: _l, ...withoutLegacy } = USER;
    const avroOut = transform({ from: 'json', to: 'avro', input: json(withoutLegacy), toSchema: AVRO_V1 });
    expect(parse(transform({ from: 'avro', to: 'json', input: avroOut.output, fromSchema: AVRO_V1 }).output).legacy).toBeNull();
    const protoOut = transform({ from: 'json', to: 'protobuf', input: json({ ...USER, extra: 1 }), toSchema: PROTO_V1 });
    expect(protoOut.steps.some(s => /dropped fields unknown to User: extra/.test(s))).toBe(true);
  });
});

describe('transform: backward-compatible migration rules', () => {
  const oldDoc = { id: 'u-1', fullName: 'Ada L', age: '36', score: 7, obsolete: true };

  it('rename / add / remove / copy / convert reshape the value before encoding', () => {
    const rules = [
      { rename: { from: 'fullName', to: 'name' } },
      { convert: { field: 'age', to: 'integer' as const } },
      { copy: { from: 'score', to: 'rank' } },
      { remove: 'obsolete' },
      { add: { field: 'tags', default: [] } },
    ];
    expect(applyRules(oldDoc, rules)).toEqual({ id: 'u-1', name: 'Ada L', age: 36, score: 7, rank: 7, tags: [] });
    // add never overwrites an existing value
    expect(applyRules({ a: 1 }, [{ add: { field: 'a', default: 2 } }])).toEqual({ a: 1 });
  });

  it('migrates an old JSON shape into the current protobuf / avro schema', () => {
    const rules = [{ rename: { from: 'fullName', to: 'name' } }, { convert: { field: 'age', to: 'integer' as const } }, { remove: 'obsolete' }, { remove: 'score' }, { add: { field: 'balance', default: '0' } }, { add: { field: 'role', default: 'USER' } }, { add: { field: 'avatar', default: '' } }, { add: { field: 'tags', default: [] } }, { add: { field: 'labels', default: {} } }];
    for (const fmt of ['protobuf', 'avro'] as const) {
      const out = transform({ from: 'json', to: fmt, input: json(oldDoc), toSchema: schemaFor(fmt), rules });
      const back = parse(transform({ from: fmt, to: 'json', input: out.output, fromSchema: schemaFor(fmt) }).output);
      expect(back).toEqual(expect.objectContaining({ id: 'u-1', name: 'Ada L', age: 36, role: 'USER' }));
      expect(out.steps).toContain('applied 9 migration rule(s)');
    }
  });

  it('fails when a rule cannot apply (missing source field) instead of guessing', () => {
    expect(() => applyRules({ a: 1 }, [{ rename: { from: 'zzz', to: 'b' } }])).toThrow(BridgeTransformError);
    expect(() => applyRules({ a: 1 }, [{ copy: { from: 'zzz', to: 'b' } }])).toThrow(/missing from the input/);
    expect(() => applyRules([1, 2], [{ remove: 'x' }])).toThrow(/objects only/);
  });

  it('loads rules from YAML/JSON and rejects malformed rule files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-rules-'));
    const ok = path.join(dir, 'rules.yaml');
    fs.writeFileSync(ok, 'rules:\n  - rename: { from: a, to: b }\n  - add: { field: c, default: 1 }\n');
    expect(loadRules(ok)).toEqual([{ rename: { from: 'a', to: 'b' } }, { add: { field: 'c', default: 1 } }]);
    const bad = path.join(dir, 'bad.yaml');
    fs.writeFileSync(bad, '- explode: 1\n');
    expect(() => loadRules(bad)).toThrow(/unknown operation "explode"/);
    fs.writeFileSync(bad, 'nothing: here\n');
    expect(() => loadRules(bad)).toThrow(/expected a list of rules/);
    expect(() => loadRules(path.join(dir, 'missing.yaml'))).toThrow(/cannot read migration rules/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('transform: failures are explicit', () => {
  it('rejects undecodable input for every source format', () => {
    expect(() => transform({ from: 'json', to: 'msgpack', input: Buffer.from('{nope') })).toThrow(/not valid JSON/);
    expect(() => transform({ from: 'msgpack', to: 'json', input: Buffer.from([0xc1]) })).toThrow(/not valid MessagePack/);
    expect(() => transform({ from: 'protobuf', to: 'json', input: Buffer.from([0xff, 0xff, 0xff]), fromSchema: PROTO_V1 })).toThrow(/not a valid User protobuf/);
    expect(() => transform({ from: 'avro', to: 'json', input: Buffer.from([0x01]), fromSchema: AVRO_V1 })).toThrow(/not valid Avro/);
  });

  it('rejects values that do not fit the target schema (no silent coercion)', () => {
    expect(() => transform({ from: 'json', to: 'protobuf', input: json({ ...USER, age: 'old' }), toSchema: PROTO_V1 })).toThrow(/age: expected int32/);
    expect(() => transform({ from: 'json', to: 'protobuf', input: json({ ...USER, role: 'ROOT' }), toSchema: PROTO_V1 })).toThrow(/not a value of enum Role/);
    expect(() => transform({ from: 'json', to: 'protobuf', input: json({ ...USER, address: { city: 5 } }), toSchema: PROTO_V1 })).toThrow(/address.city: expected string/);
    expect(() => transform({ from: 'json', to: 'avro', input: json({ ...USER, age: 'x' }), toSchema: AVRO_V1 })).toThrow(/does not fit the Avro schema/);
    expect(() => transform({ from: 'json', to: 'avro', input: json({ id: 'x' }), toSchema: AVRO_V1 })).toThrow(BridgeTransformError);
  });

  it('requires schemas for protobuf/avro and validates formats and message names', () => {
    expect(() => transform({ from: 'json', to: 'protobuf', input: json(USER) })).toThrow(/needs a schema/);
    expect(() => transform({ from: 'json', to: 'avro', input: json(USER) })).toThrow(/needs a schema/);
    expect(() => transform({ from: 'json', to: 'protobuf', input: json(USER), toSchema: { file: f('user.v1.proto'), message: 'Nope' } })).toThrow(/message "Nope" not found/);
    expect(() => transform({ from: 'yaml' as DataFormat, to: 'json', input: json(USER) })).toThrow(/formats must be one of/);
    expect(() => transform({ from: 'json', to: 'avro', input: json(USER), toSchema: { file: '/nope.avsc' } })).toThrow(/cannot read Avro schema/);
    expect(sideSchema(undefined, undefined)).toBeUndefined();
  });

  it('the message can be named relative to the package or fully qualified', () => {
    for (const message of ['User', 'demo.User', '.demo.User']) {
      const out = transform({ from: 'json', to: 'protobuf', input: json(USER), toSchema: { file: f('user.v1.proto'), message } });
      expect(out.output.length).toBeGreaterThan(10);
    }
  });
});

describe('transform: command layer', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-tcmd-'));
    process.exitCode = 0;
  });
  afterEach(() => {
    process.exitCode = 0;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function capture<T = unknown>(fn: () => Promise<void>): Promise<T> {
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stdout.write);
    try {
      await fn();
    } finally {
      spy.mockRestore();
    }
    return JSON.parse(chunks.join('').trim()) as T;
  }

  it('--json: json -> msgpack writes bytes (base64 in the envelope), and msgpack -> json reads them back from a file', async () => {
    const out = path.join(dir, 'u.msgpack');
    const first = await capture<{ ok: boolean; data: { bytes: number; outputBase64: string; written: string } }>(() =>
      runTransform({ from: 'json', to: 'msgpack', data: JSON.stringify(USER), out, json: true })
    );
    expect(first.ok).toBe(true);
    expect(fs.readFileSync(out).toString('base64')).toBe(first.data.outputBase64);
    const second = await capture<{ ok: boolean; data: { output: string } }>(() => runTransform({ from: 'msgpack', to: 'json', input: out, json: true }));
    expect(JSON.parse(second.data.output)).toEqual(USER);
  });

  it('accepts base64 input and protobuf schemas on the command line', async () => {
    const bytes = convert('json', 'protobuf', json(USER)).output;
    const env = await capture<{ ok: boolean; data: { output: string; steps: string[] } }>(() =>
      runTransform({ from: 'protobuf', to: 'json', data: bytes.toString('base64'), inputEncoding: 'base64', schema: f('user.v1.proto'), message: 'User', json: true })
    );
    expect(env.ok).toBe(true);
    expect(JSON.parse(env.data.output).name).toBe('Ada');
    expect(env.data.steps[0]).toBe('decoded protobuf demo.User');
  });

  it('failures are BRIDGE_TRANSFORM_ERROR with exit 1', async () => {
    const env = await capture<{ ok: boolean; error: { code: string; message: string } }>(() =>
      runTransform({ from: 'json', to: 'avro', data: '{"id":1}', schema: f('user.v1.avsc'), json: true })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('BRIDGE_TRANSFORM_ERROR');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    const bad = await capture<{ ok: boolean; error: { message: string } }>(() => runTransform({ from: 'json', to: 'yaml', data: '{}', json: true }));
    expect(bad.error.message).toMatch(/--from and --to must each be one of/);
    process.exitCode = 0;
    const noInput = await capture<{ ok: boolean; error: { message: string } }>(() => runTransform({ from: 'json', to: 'msgpack', json: true }));
    expect(noInput.error.message).toMatch(/give the input/);
  });

  it('--migrate applies a rules file', async () => {
    const rules = path.join(dir, 'rules.yaml');
    fs.writeFileSync(rules, '- rename: { from: fullName, to: name }\n- remove: junk\n');
    const env = await capture<{ ok: boolean; data: { output: string } }>(() =>
      runTransform({ from: 'json', to: 'json', data: '{"fullName":"Ada","junk":1}', migrate: rules, json: true })
    );
    expect(JSON.parse(env.data.output)).toEqual({ name: 'Ada' });
  });
});
