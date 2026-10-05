// Contract change classification (breaking / dangerous / non-breaking) over the
// shared IR, so it works identically for OpenAPI, .proto and GraphQL SDL.
//
// Perspective: "would an existing, already-generated client of BASE still work
// against a provider that now serves HEAD?". Types are compared by direction:
// models reachable from requests are *inputs* (the client writes them), models
// reachable from responses are *outputs* (the client reads them).

import { opKey } from './codegen/common';
import {
  findModel,
  type IRField,
  type IRGraphqlOperation,
  type IRModel,
  type IROperation,
  type IRRestOperation,
  type IRRpcOperation,
  type ServiceContract,
  type TypeRef,
} from './spec/ir';

/** How a change affects existing clients. */
export type ChangeSeverity = 'breaking' | 'dangerous' | 'non-breaking';

/** One classified difference. */
export interface ContractChange {
  severity: ChangeSeverity;
  /** Stable machine code, e.g. `OPERATION_REMOVED`. */
  code: string;
  /** Where: `GET /products`, `Order.total_cents`, `Query.stock(sku)`... */
  path: string;
  message: string;
}

/** Result of diffing two contracts. */
export interface ContractDiff {
  protocol: ServiceContract['protocol'];
  changes: ContractChange[];
  summary: { breaking: number; dangerous: number; nonBreaking: number };
  /** True when there are no breaking changes. */
  compatible: boolean;
}

const ORDER: Record<ChangeSeverity, number> = { breaking: 0, dangerous: 1, 'non-breaking': 2 };

function typeKey(ref: TypeRef): string {
  switch (ref.k) {
    case 'scalar':
      return ref.name;
    case 'ref':
      return ref.name;
    case 'list':
      return `[${typeKey(ref.of)}${ref.itemNullable ? '?' : ''}]`;
    case 'map':
      return `{${typeKey(ref.of)}}`;
  }
}

function fmtType(ref: TypeRef): string {
  return typeKey(ref);
}

const NUMERIC_RANK: Record<string, number> = { int: 1, long: 2, float: 3 };

/** True when `to` accepts every value `from` could hold (input-side widening). */
function numericWidening(from: TypeRef, to: TypeRef): boolean {
  return (
    from.k === 'scalar' &&
    to.k === 'scalar' &&
    from.name in NUMERIC_RANK &&
    to.name in NUMERIC_RANK &&
    NUMERIC_RANK[to.name] >= NUMERIC_RANK[from.name]
  );
}

interface Directions {
  input: Set<string>;
  output: Set<string>;
}

function collectRefs(ref: TypeRef, out: Set<string>): void {
  if (ref.k === 'ref') out.add(ref.name);
  else if (ref.k === 'list' || ref.k === 'map') collectRefs(ref.of, out);
}

function closure(contract: ServiceContract, seeds: Set<string>): Set<string> {
  const seen = new Set<string>();
  const queue = [...seeds];
  while (queue.length) {
    const name = queue.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const m = findModel(contract, name);
    if (!m) continue;
    const next = new Set<string>();
    if (m.kind === 'object') for (const f of m.fields) collectRefs(f.type, next);
    if (m.kind === 'union') for (const x of m.members) next.add(x);
    if (m.kind === 'object' && m.implementors) for (const x of m.implementors) next.add(x);
    for (const n of next) queue.push(n);
  }
  return seen;
}

function directions(contract: ServiceContract): Directions {
  const inSeeds = new Set<string>();
  const outSeeds = new Set<string>();
  for (const op of contract.operations) {
    if (op.protocol === 'rest') {
      for (const p of op.params) collectRefs(p.type, inSeeds);
      if (op.body) collectRefs(op.body.type, inSeeds);
      if (op.response) collectRefs(op.response.type, outSeeds);
    } else if (op.protocol === 'grpc') {
      collectRefs(op.request, inSeeds);
      collectRefs(op.response, outSeeds);
    } else {
      for (const a of op.args) collectRefs(a.type, inSeeds);
      collectRefs(op.returns, outSeeds);
    }
  }
  return { input: closure(contract, inSeeds), output: closure(contract, outSeeds) };
}

class Collector {
  readonly changes: ContractChange[] = [];
  private readonly seen = new Set<string>();
  add(severity: ChangeSeverity, code: string, path: string, message: string): void {
    const key = `${severity}|${code}|${path}|${message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.changes.push({ severity, code, path, message });
  }
}

/** GraphQL input-position compatibility of printed types (`[String!]!`). */
function gqlInputCompatible(oldType: string, newType: string): boolean {
  const o = oldType.trim();
  const n = newType.trim();
  if (o.endsWith('!')) {
    const oInner = o.slice(0, -1);
    if (n.endsWith('!')) return gqlInputCompatible(oInner, n.slice(0, -1));
    return gqlInputCompatible(oInner, n); // non-null -> nullable: widening
  }
  if (n.endsWith('!')) return false; // nullable -> non-null: narrowing
  if (o.startsWith('[') && n.startsWith('[')) return gqlInputCompatible(o.slice(1, -1), n.slice(1, -1));
  return o === n;
}

function diffRest(base: IRRestOperation, head: IRRestOperation, c: Collector): void {
  const where = `${head.method} ${head.path}`;
  const bp = new Map(base.params.map(p => [`${p.in}:${p.name}`, p]));
  const hp = new Map(head.params.map(p => [`${p.in}:${p.name}`, p]));
  for (const [key, p] of bp) {
    const q = hp.get(key);
    if (!q) {
      c.add('dangerous', 'PARAMETER_REMOVED', `${where} ${p.in} ${p.name}`, `${p.in} parameter "${p.name}" was removed`);
      continue;
    }
    if (typeKey(p.type) !== typeKey(q.type) && !numericWidening(p.type, q.type)) {
      c.add('breaking', 'PARAMETER_TYPE_CHANGED', `${where} ${p.in} ${p.name}`, `${p.in} parameter "${p.name}" changed type ${fmtType(p.type)} -> ${fmtType(q.type)}`);
    }
    if (!p.required && q.required) {
      c.add('breaking', 'PARAMETER_NOW_REQUIRED', `${where} ${p.in} ${p.name}`, `${p.in} parameter "${p.name}" became required`);
    } else if (p.required && !q.required) {
      c.add('non-breaking', 'PARAMETER_NOW_OPTIONAL', `${where} ${p.in} ${p.name}`, `${p.in} parameter "${p.name}" became optional`);
    }
  }
  for (const [key, q] of hp) {
    if (bp.has(key)) continue;
    if (q.required) c.add('breaking', 'REQUIRED_PARAMETER_ADDED', `${where} ${q.in} ${q.name}`, `new required ${q.in} parameter "${q.name}"`);
    else c.add('non-breaking', 'OPTIONAL_PARAMETER_ADDED', `${where} ${q.in} ${q.name}`, `new optional ${q.in} parameter "${q.name}"`);
  }
  // body
  if (base.body && !head.body) {
    c.add('dangerous', 'REQUEST_BODY_REMOVED', where, 'request body is no longer accepted');
  } else if (!base.body && head.body) {
    if (head.body.required) c.add('breaking', 'REQUIRED_REQUEST_BODY_ADDED', where, 'a required request body was added');
    else c.add('non-breaking', 'OPTIONAL_REQUEST_BODY_ADDED', where, 'an optional request body was added');
  } else if (base.body && head.body) {
    if (typeKey(base.body.type) !== typeKey(head.body.type) && !numericWidening(base.body.type, head.body.type)) {
      c.add('breaking', 'REQUEST_BODY_TYPE_CHANGED', where, `request body changed type ${fmtType(base.body.type)} -> ${fmtType(head.body.type)}`);
    }
    if (!base.body.required && head.body.required) c.add('breaking', 'REQUEST_BODY_NOW_REQUIRED', where, 'request body became required');
    else if (base.body.required && !head.body.required) c.add('non-breaking', 'REQUEST_BODY_NOW_OPTIONAL', where, 'request body became optional');
  }
  // response
  if (base.response && !head.response) {
    c.add('breaking', 'RESPONSE_BODY_REMOVED', where, 'the success response no longer has a body');
  } else if (!base.response && head.response) {
    c.add('non-breaking', 'RESPONSE_BODY_ADDED', where, 'the success response now has a body');
  } else if (base.response && head.response && typeKey(base.response.type) !== typeKey(head.response.type)) {
    c.add('breaking', 'RESPONSE_TYPE_CHANGED', where, `response changed type ${fmtType(base.response.type)} -> ${fmtType(head.response.type)}`);
  }
  if (!base.deprecated && head.deprecated) c.add('non-breaking', 'OPERATION_DEPRECATED', where, 'operation was marked deprecated');
}

function diffRpc(base: IRRpcOperation, head: IRRpcOperation, c: Collector): void {
  const where = `${head.fqService}/${head.method}`;
  if (typeKey(base.request) !== typeKey(head.request)) {
    c.add('breaking', 'RPC_REQUEST_TYPE_CHANGED', where, `request type changed ${fmtType(base.request)} -> ${fmtType(head.request)}`);
  }
  if (typeKey(base.response) !== typeKey(head.response)) {
    c.add('breaking', 'RPC_RESPONSE_TYPE_CHANGED', where, `response type changed ${fmtType(base.response)} -> ${fmtType(head.response)}`);
  }
  if (base.clientStreaming !== head.clientStreaming || base.serverStreaming !== head.serverStreaming) {
    c.add('breaking', 'RPC_STREAMING_CHANGED', where, 'streaming mode changed');
  }
}

function diffGraphql(base: IRGraphqlOperation, head: IRGraphqlOperation, c: Collector): void {
  const where = `${head.operation === 'query' ? 'Query' : head.operation === 'mutation' ? 'Mutation' : 'Subscription'}.${head.field}`;
  const ba = new Map(base.args.map(a => [a.name, a]));
  const ha = new Map(head.args.map(a => [a.name, a]));
  for (const [name, a] of ba) {
    const b = ha.get(name);
    if (!b) {
      c.add('breaking', 'ARGUMENT_REMOVED', `${where}(${name})`, `argument "${name}" was removed`);
      continue;
    }
    const oldT = a.gqlType ?? typeKey(a.type);
    const newT = b.gqlType ?? typeKey(b.type);
    if (oldT !== newT) {
      if (gqlInputCompatible(oldT, newT)) {
        c.add('non-breaking', 'ARGUMENT_TYPE_WIDENED', `${where}(${name})`, `argument "${name}" type ${oldT} -> ${newT}`);
      } else {
        c.add('breaking', 'ARGUMENT_TYPE_CHANGED', `${where}(${name})`, `argument "${name}" type ${oldT} -> ${newT}`);
      }
    }
  }
  for (const [name, b] of ha) {
    if (ba.has(name)) continue;
    if (b.required) c.add('breaking', 'REQUIRED_ARGUMENT_ADDED', `${where}(${name})`, `new required argument "${name}"`);
    else c.add('non-breaking', 'OPTIONAL_ARGUMENT_ADDED', `${where}(${name})`, `new optional argument "${name}"`);
  }
  if (typeKey(base.returns) !== typeKey(head.returns)) {
    c.add('breaking', 'RETURN_TYPE_CHANGED', where, `return type ${fmtType(base.returns)} -> ${fmtType(head.returns)}`);
  } else if (!base.returnsNullable && head.returnsNullable) {
    c.add('breaking', 'RETURN_NOW_NULLABLE', where, 'return type became nullable');
  } else if (base.returnsNullable && !head.returnsNullable) {
    c.add('non-breaking', 'RETURN_NOW_NON_NULL', where, 'return type became non-null');
  }
}

function fieldKey(protocol: ServiceContract['protocol'], f: IRField): string {
  return protocol === 'grpc' && f.tag !== undefined ? `#${f.tag}` : f.name;
}

function diffModels(
  base: ServiceContract,
  head: ServiceContract,
  dirBase: Directions,
  dirHead: Directions,
  c: Collector
): void {
  const protocol = head.protocol;
  const bm = new Map(base.models.map(m => [m.name, m]));
  const hm = new Map(head.models.map(m => [m.name, m]));
  const isIn = (name: string): boolean => dirBase.input.has(name) || dirHead.input.has(name);
  const isOut = (name: string): boolean => dirBase.output.has(name) || dirHead.output.has(name);

  for (const [name, m] of bm) {
    const h = hm.get(name);
    const used = isIn(name) || isOut(name);
    if (!h) {
      // Whatever referenced the type (operation, field, argument, union member) is
      // reported by its own change; the removal itself cannot break a client.
      c.add('non-breaking', 'TYPE_REMOVED', name, `type "${name}" was removed${used ? ' (changes to what referenced it are reported separately)' : ' (not used by any operation)'}`);
      continue;
    }
    if (m.kind !== h.kind) {
      c.add(used ? 'breaking' : 'dangerous', 'TYPE_KIND_CHANGED', name, `type "${name}" changed kind ${m.kind} -> ${h.kind}`);
      continue;
    }
    // Unused models cannot break a client; cap severity at "dangerous".
    const cap = (s: ChangeSeverity): ChangeSeverity => (used || s !== 'breaking' ? s : 'dangerous');
    if (m.kind === 'object' && h.kind === 'object') diffObject(protocol, m, h, isIn(name), isOut(name), used, cap, c);
    else if (m.kind === 'enum' && h.kind === 'enum') diffEnum(m, h, isIn(name), isOut(name), used, cap, c);
    else if (m.kind === 'union' && h.kind === 'union') diffUnion(m, h, isIn(name), cap, c);
  }
  for (const [name] of hm) {
    if (!bm.has(name)) c.add('non-breaking', 'TYPE_ADDED', name, `type "${name}" was added`);
  }
}

function diffObject(
  protocol: ServiceContract['protocol'],
  base: Extract<IRModel, { kind: 'object' }>,
  head: Extract<IRModel, { kind: 'object' }>,
  asInput: boolean,
  asOutput: boolean,
  used: boolean,
  cap: (s: ChangeSeverity) => ChangeSeverity,
  c: Collector
): void {
  const input = asInput || (!asOutput && !used);
  const output = asOutput || (!asInput && !used);
  const bf = new Map(base.fields.map(f => [fieldKey(protocol, f), f]));
  const hf = new Map(head.fields.map(f => [fieldKey(protocol, f), f]));
  for (const [key, f] of bf) {
    const g = hf.get(key);
    const at = `${base.name}.${f.name}`;
    if (!g) {
      if (output) c.add(cap('breaking'), 'OUTPUT_FIELD_REMOVED', at, `field "${f.name}" was removed from "${base.name}"`);
      if (input) {
        c.add(cap(protocol === 'graphql' ? 'breaking' : 'dangerous'), 'INPUT_FIELD_REMOVED', at, `field "${f.name}" was removed from input "${base.name}"`);
      }
      continue;
    }
    if (protocol === 'grpc' && f.name !== g.name) {
      c.add(cap('dangerous'), 'FIELD_RENAMED', `${base.name}.${f.name}`, `field #${f.tag} renamed "${f.name}" -> "${g.name}" (wire-compatible, breaks JSON/source)`);
    }
    if (typeKey(f.type) !== typeKey(g.type)) {
      if (input && !output && numericWidening(f.type, g.type)) {
        c.add('non-breaking', 'INPUT_FIELD_WIDENED', at, `field "${f.name}" widened ${fmtType(f.type)} -> ${fmtType(g.type)}`);
      } else {
        c.add(cap('breaking'), 'FIELD_TYPE_CHANGED', at, `field "${f.name}" changed type ${fmtType(f.type)} -> ${fmtType(g.type)}`);
      }
    }
    const wasReq = f.required && !f.nullable;
    const isReq = g.required && !g.nullable;
    if (wasReq && !isReq) {
      if (output) c.add(cap('breaking'), 'OUTPUT_FIELD_NOW_OPTIONAL', at, `field "${f.name}" is no longer guaranteed present`);
      if (input) c.add('non-breaking', 'INPUT_FIELD_NOW_OPTIONAL', at, `field "${f.name}" became optional`);
    } else if (!wasReq && isReq) {
      if (input) c.add(cap('breaking'), 'INPUT_FIELD_NOW_REQUIRED', at, `field "${f.name}" became required`);
      if (output) c.add('non-breaking', 'OUTPUT_FIELD_NOW_REQUIRED', at, `field "${f.name}" is now always present`);
    }
  }
  for (const [key, g] of hf) {
    if (bf.has(key)) continue;
    const at = `${head.name}.${g.name}`;
    const requiredNow = g.required && !g.nullable;
    if (input && requiredNow && !(protocol === 'grpc')) {
      c.add(cap('breaking'), 'REQUIRED_INPUT_FIELD_ADDED', at, `new required field "${g.name}" in input "${head.name}"`);
    } else if (input && !output) {
      c.add('non-breaking', 'OPTIONAL_INPUT_FIELD_ADDED', at, `new optional field "${g.name}" in input "${head.name}"`);
    }
    if (output) c.add('non-breaking', 'OUTPUT_FIELD_ADDED', at, `new field "${g.name}" in "${head.name}"`);
  }
}

function diffEnum(
  base: Extract<IRModel, { kind: 'enum' }>,
  head: Extract<IRModel, { kind: 'enum' }>,
  asInput: boolean,
  asOutput: boolean,
  used: boolean,
  cap: (s: ChangeSeverity) => ChangeSeverity,
  c: Collector
): void {
  const bv = new Map(base.values.map(v => [v.name, v]));
  const hv = new Map(head.values.map(v => [v.name, v]));
  for (const [name, v] of bv) {
    const w = hv.get(name);
    if (!w) {
      c.add(asInput || !used ? cap('breaking') : 'non-breaking', 'ENUM_VALUE_REMOVED', `${base.name}.${name}`, `enum value "${name}" was removed`);
    } else if (v.number !== w.number) {
      c.add(cap('breaking'), 'ENUM_VALUE_NUMBER_CHANGED', `${base.name}.${name}`, `enum value "${name}" changed number ${v.number} -> ${w.number}`);
    }
  }
  for (const [name] of hv) {
    if (bv.has(name)) continue;
    c.add(asOutput || !used ? 'dangerous' : 'non-breaking', 'ENUM_VALUE_ADDED', `${head.name}.${name}`, `enum value "${name}" was added (clients may not handle it)`);
  }
}

function diffUnion(
  base: Extract<IRModel, { kind: 'union' }>,
  head: Extract<IRModel, { kind: 'union' }>,
  asInput: boolean,
  cap: (s: ChangeSeverity) => ChangeSeverity,
  c: Collector
): void {
  const b = new Set(base.members);
  const h = new Set(head.members);
  for (const m of b) {
    if (!h.has(m)) c.add(asInput ? cap('breaking') : 'non-breaking', 'UNION_MEMBER_REMOVED', `${base.name}.${m}`, `union "${base.name}" no longer includes "${m}"`);
  }
  for (const m of h) {
    if (!b.has(m)) c.add(asInput ? 'non-breaking' : 'dangerous', 'UNION_MEMBER_ADDED', `${head.name}.${m}`, `union "${head.name}" now includes "${m}" (clients may not handle it)`);
  }
}

/**
 * Classify the differences between a base and a head contract.
 * Both must use the same protocol.
 */
export function diffContracts(base: ServiceContract, head: ServiceContract): ContractDiff {
  const c = new Collector();
  if (base.protocol !== head.protocol) {
    c.add('breaking', 'PROTOCOL_CHANGED', '(contract)', `contract protocol changed ${base.protocol} -> ${head.protocol}`);
  } else {
    const bo = new Map<string, IROperation>(base.operations.map(o => [opKey(o), o]));
    const ho = new Map<string, IROperation>(head.operations.map(o => [opKey(o), o]));
    for (const [key, op] of bo) {
      const h = ho.get(key);
      if (!h) {
        c.add('breaking', 'OPERATION_REMOVED', key, `operation "${key}" was removed`);
        continue;
      }
      if (op.protocol === 'rest' && h.protocol === 'rest') diffRest(op, h, c);
      else if (op.protocol === 'grpc' && h.protocol === 'grpc') diffRpc(op, h, c);
      else if (op.protocol === 'graphql' && h.protocol === 'graphql') diffGraphql(op, h, c);
    }
    for (const [key] of ho) {
      if (!bo.has(key)) c.add('non-breaking', 'OPERATION_ADDED', key, `operation "${key}" was added`);
    }
    diffModels(base, head, directions(base), directions(head), c);
  }
  const changes = c.changes.sort(
    (a, b) => ORDER[a.severity] - ORDER[b.severity] || a.path.localeCompare(b.path) || a.code.localeCompare(b.code)
  );
  const summary = {
    breaking: changes.filter(x => x.severity === 'breaking').length,
    dangerous: changes.filter(x => x.severity === 'dangerous').length,
    nonBreaking: changes.filter(x => x.severity === 'non-breaking').length,
  };
  return { protocol: head.protocol, changes, summary, compatible: summary.breaking === 0 };
}
