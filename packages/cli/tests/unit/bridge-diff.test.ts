import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import { diffContracts, type ContractDiff } from '../../src/bridge/diff';
import { runDiff } from '../../src/bridge/commands';
import { loadContract } from '../../src/bridge/spec/discover';

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-diff-'));
  process.exitCode = 0;
});
afterEach(async () => {
  process.exitCode = 0;
  await fs.remove(tmp);
});

let counter = 0;
function spec(ext: string, text: string): string {
  const file = path.join(tmp, `spec-${counter++}.${ext}`);
  fs.writeFileSync(file, text);
  return file;
}

function diff(ext: string, base: string, head: string): ContractDiff {
  return diffContracts(loadContract(spec(ext, base)), loadContract(spec(ext, head)));
}

function codes(d: ContractDiff, severity?: string): string[] {
  return d.changes.filter(c => !severity || c.severity === severity).map(c => c.code).sort();
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const OPENAPI_BASE = `
openapi: 3.0.3
info: { title: T, version: '1' }
paths:
  /items:
    get:
      operationId: listItems
      parameters:
        - { name: limit, in: query, schema: { type: integer } }
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Item' }
    post:
      operationId: createItem
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NewItem' }
      responses:
        '201':
          description: ok
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Item' }
  /items/{id}:
    delete:
      operationId: deleteItem
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        '204': { description: gone }
components:
  schemas:
    Color: { type: string, enum: [red, green] }
    Item:
      type: object
      required: [id, name]
      properties:
        id: { type: string }
        name: { type: string }
        color: { $ref: '#/components/schemas/Color' }
        note: { type: string }
    NewItem:
      type: object
      required: [name]
      properties:
        name: { type: string }
        note: { type: string }
`;

function openapi(mutate: (doc: Record<string, any>) => void): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require('js-yaml') as typeof import('js-yaml');
  const doc = yaml.load(OPENAPI_BASE) as Record<string, any>;
  mutate(doc);
  return yaml.dump(doc);
}

describe('bridge diff: OpenAPI', () => {
  it('identical contracts: no changes, compatible', () => {
    const d = diff('yaml', OPENAPI_BASE, OPENAPI_BASE);
    expect(d.changes).toEqual([]);
    expect(d.compatible).toBe(true);
  });

  it('removed operation is breaking; added operation is non-breaking', () => {
    const d = diff('yaml', OPENAPI_BASE, openapi(doc => {
      delete doc.paths['/items/{id}'].delete;
      doc.paths['/health'] = { get: { operationId: 'health', responses: { '200': { description: 'ok' } } } };
    }));
    expect(codes(d, 'breaking')).toEqual(['OPERATION_REMOVED']);
    expect(codes(d, 'non-breaking')).toEqual(['OPERATION_ADDED']);
    expect(d.compatible).toBe(false);
  });

  it('parameters: new required is breaking, new optional is fine, optional->required is breaking', () => {
    const d = diff('yaml', OPENAPI_BASE, openapi(doc => {
      doc.paths['/items'].get.parameters.push({ name: 'sort', in: 'query', required: true, schema: { type: 'string' } });
      doc.paths['/items'].get.parameters.push({ name: 'cursor', in: 'query', schema: { type: 'string' } });
      doc.paths['/items'].get.parameters[0].required = true;
    }));
    expect(codes(d, 'breaking')).toEqual(['PARAMETER_NOW_REQUIRED', 'REQUIRED_PARAMETER_ADDED']);
    expect(codes(d, 'non-breaking')).toEqual(['OPTIONAL_PARAMETER_ADDED']);
  });

  it('response fields: removal / optionalisation are breaking, addition is not', () => {
    const d = diff('yaml', OPENAPI_BASE, openapi(doc => {
      const item = doc.components.schemas.Item;
      delete item.properties.note;
      item.required = ['id']; // name no longer guaranteed
      item.properties.extra = { type: 'string' };
    }));
    expect(codes(d, 'breaking')).toEqual(['OUTPUT_FIELD_NOW_OPTIONAL', 'OUTPUT_FIELD_REMOVED']);
    expect(codes(d, 'non-breaking')).toContain('OUTPUT_FIELD_ADDED');
  });

  it('request fields: new required breaks, new optional does not, removal is dangerous', () => {
    const d = diff('yaml', OPENAPI_BASE, openapi(doc => {
      const n = doc.components.schemas.NewItem;
      n.properties.sku = { type: 'string' };
      n.required.push('sku');
      n.properties.tag = { type: 'string' };
      delete n.properties.note;
    }));
    expect(codes(d, 'breaking')).toEqual(['REQUIRED_INPUT_FIELD_ADDED']);
    expect(codes(d, 'dangerous')).toEqual(['INPUT_FIELD_REMOVED']);
    expect(codes(d, 'non-breaking')).toContain('OPTIONAL_INPUT_FIELD_ADDED');
  });

  it('field type change is breaking; numeric widening on a request field is not', () => {
    const d = diff('yaml', OPENAPI_BASE, openapi(doc => {
      doc.components.schemas.Item.properties.name = { type: 'integer' };
      doc.components.schemas.NewItem.properties.qty = { type: 'integer' };
    }));
    expect(codes(d, 'breaking')).toEqual(['FIELD_TYPE_CHANGED']);
    const widened = diff(
      'yaml',
      openapi(doc => { doc.components.schemas.NewItem.properties.qty = { type: 'integer' }; }),
      openapi(doc => { doc.components.schemas.NewItem.properties.qty = { type: 'number' }; })
    );
    expect(widened.compatible).toBe(true);
    expect(codes(widened)).toEqual(['INPUT_FIELD_WIDENED']);
  });

  it('enums: value added to a response enum is dangerous; value removed from a request enum is breaking', () => {
    const d = diff('yaml', OPENAPI_BASE, openapi(doc => {
      doc.components.schemas.Color.enum.push('blue');
    }));
    expect(codes(d)).toEqual(['ENUM_VALUE_ADDED']);
    expect(d.changes[0].severity).toBe('dangerous');
    expect(d.compatible).toBe(true);

    const inputEnum = (values: string[]): string =>
      openapi(doc => {
        doc.components.schemas.Color.enum = values;
        doc.components.schemas.NewItem.properties.color = { $ref: '#/components/schemas/Color' };
        delete doc.components.schemas.Item.properties.color;
      });
    const removed = diff('yaml', inputEnum(['red', 'green']), inputEnum(['red']));
    expect(codes(removed, 'breaking')).toEqual(['ENUM_VALUE_REMOVED']);
  });

  it('response body removed is breaking; a changed response type is breaking', () => {
    const d = diff('yaml', OPENAPI_BASE, openapi(doc => {
      doc.paths['/items'].post.responses['201'] = { description: 'ok' };
      doc.paths['/items'].get.responses['200'].content['application/json'].schema = { $ref: '#/components/schemas/NewItem' };
    }));
    expect(codes(d, 'breaking')).toEqual(['RESPONSE_BODY_REMOVED', 'RESPONSE_TYPE_CHANGED']);
  });
});

// ---------------------------------------------------------------------------
// proto
// ---------------------------------------------------------------------------

const PROTO_BASE = `
syntax = "proto3";
package demo;
service Svc {
  rpc Get (GetReq) returns (Thing);
  rpc Drop (GetReq) returns (Thing);
}
enum Kind { KIND_UNSPECIFIED = 0; A = 1; }
message GetReq { string id = 1; }
message Thing { string id = 1; string name = 2; int32 count = 3; Kind kind = 4; }
message Unused { string x = 1; }
`;

describe('bridge diff: proto', () => {
  it('field removed from a response is breaking; new field / new rpc are not', () => {
    const d = diff('proto', PROTO_BASE, PROTO_BASE
      .replace('string name = 2; ', '')
      .replace('Kind kind = 4;', 'Kind kind = 4; string extra = 5;')
      .replace('rpc Drop (GetReq) returns (Thing);', 'rpc Drop (GetReq) returns (Thing); rpc List (GetReq) returns (Thing);'));
    expect(codes(d, 'breaking')).toEqual(['OUTPUT_FIELD_REMOVED']);
    expect(codes(d, 'non-breaking')).toEqual(['OPERATION_ADDED', 'OUTPUT_FIELD_ADDED']);
  });

  it('rpc removed, request/response type and streaming changes are breaking', () => {
    const d = diff('proto', PROTO_BASE, `
syntax = "proto3";
package demo;
service Svc {
  rpc Get (Thing) returns (stream Thing);
}
enum Kind { KIND_UNSPECIFIED = 0; A = 1; }
message GetReq { string id = 1; }
message Thing { string id = 1; string name = 2; int32 count = 3; Kind kind = 4; }
message Unused { string x = 1; }
`);
    expect(codes(d, 'breaking')).toEqual(['OPERATION_REMOVED', 'RPC_REQUEST_TYPE_CHANGED', 'RPC_STREAMING_CHANGED']);
  });

  it('field type change and field number reuse are breaking; a rename is dangerous', () => {
    const typeChanged = diff('proto', PROTO_BASE, PROTO_BASE.replace('int32 count = 3', 'string count = 3'));
    expect(codes(typeChanged, 'breaking')).toEqual(['FIELD_TYPE_CHANGED']);
    const renumbered = diff('proto', PROTO_BASE, PROTO_BASE.replace('int32 count = 3', 'int32 count = 9'));
    expect(codes(renumbered, 'breaking')).toContain('OUTPUT_FIELD_REMOVED'); // #3 vanished from the wire
    const renamed = diff('proto', PROTO_BASE, PROTO_BASE.replace('string name = 2', 'string title = 2'));
    expect(codes(renamed, 'dangerous')).toEqual(['FIELD_RENAMED']);
    expect(renamed.compatible).toBe(true);
  });

  it('enum value added is dangerous; unused message removal is not breaking', () => {
    const d = diff('proto', PROTO_BASE, PROTO_BASE.replace('A = 1;', 'A = 1; B = 2;').replace('message Unused { string x = 1; }', ''));
    expect(codes(d, 'dangerous')).toEqual(['ENUM_VALUE_ADDED']);
    expect(codes(d, 'non-breaking')).toEqual(['TYPE_REMOVED']);
    expect(d.compatible).toBe(true);
  });

  it('adding a field to a request message is compatible (proto3 defaults)', () => {
    const d = diff('proto', PROTO_BASE, PROTO_BASE.replace('message GetReq { string id = 1; }', 'message GetReq { string id = 1; string trace = 2; }'));
    expect(d.compatible).toBe(true);
    expect(codes(d, 'breaking')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GQL_BASE = `
enum Role { ADMIN USER }
type User { id: ID! name: String! email: String role: Role! }
union Result = User | Org
type Org { id: ID! }
input Filter { name: String }
type Query {
  user(id: ID!): User
  users(filter: Filter, first: Int): [User!]!
  find: Result
}
type Mutation { rename(id: ID!, name: String!): User! }
`;

describe('bridge diff: GraphQL', () => {
  it('removed field/arg/type are breaking, additions are not', () => {
    const d = diff('graphql', GQL_BASE, GQL_BASE
      .replace('email: String ', '')
      .replace('users(filter: Filter, first: Int)', 'users(first: Int, after: String)')
      .replace('type Mutation { rename(id: ID!, name: String!): User! }', 'type Mutation { rename(id: ID!, name: String!): User! ping: Boolean }'));
    expect(codes(d, 'breaking')).toEqual(['ARGUMENT_REMOVED', 'OUTPUT_FIELD_REMOVED']);
    expect(codes(d, 'non-breaking')).toEqual(['OPERATION_ADDED', 'OPTIONAL_ARGUMENT_ADDED']);
  });

  it('new required argument and required input field are breaking', () => {
    const d = diff('graphql', GQL_BASE, GQL_BASE
      .replace('user(id: ID!)', 'user(id: ID!, tenant: ID!)')
      .replace('input Filter { name: String }', 'input Filter { name: String org: ID! }'));
    expect(codes(d, 'breaking')).toEqual(['REQUIRED_ARGUMENT_ADDED', 'REQUIRED_INPUT_FIELD_ADDED']);
  });

  it('nullability: non-null -> nullable return is breaking; nullable -> non-null is fine; argument widening is fine', () => {
    const d = diff('graphql', GQL_BASE, GQL_BASE
      .replace('users(filter: Filter, first: Int): [User!]!', 'users(filter: Filter, first: Int): [User!]')
      .replace('user(id: ID!): User', 'user(id: ID!): User!')
      .replace('rename(id: ID!, name: String!)', 'rename(id: ID!, name: String)'));
    expect(codes(d, 'breaking')).toEqual(['RETURN_NOW_NULLABLE']);
    expect(codes(d, 'non-breaking')).toEqual(['ARGUMENT_TYPE_WIDENED', 'RETURN_NOW_NON_NULL']);
    const narrowed = diff('graphql', GQL_BASE, GQL_BASE.replace('users(filter: Filter, first: Int)', 'users(filter: Filter, first: Int!)'));
    expect(codes(narrowed, 'breaking')).toEqual(['ARGUMENT_TYPE_CHANGED']);
  });

  it('enum value and union member additions are dangerous (clients may not handle them)', () => {
    const d = diff('graphql', GQL_BASE, GQL_BASE.replace('ADMIN USER', 'ADMIN USER GUEST').replace('union Result = User | Org', 'union Result = User | Org | Team').replace('type Org { id: ID! }', 'type Org { id: ID! } type Team { id: ID! }'));
    expect(codes(d, 'dangerous')).toEqual(['ENUM_VALUE_ADDED', 'UNION_MEMBER_ADDED']);
    expect(d.compatible).toBe(true);
  });

  it('removing a type (and its union membership) is reported as non-breaking for outputs', () => {
    const d = diff('graphql', GQL_BASE, GQL_BASE.replace('type Org { id: ID! }', '').replace('union Result = User | Org', 'union Result = User'));
    expect(codes(d, 'breaking')).toEqual([]); // union member removal is non-breaking for outputs
    expect(codes(d, 'non-breaking')).toEqual(expect.arrayContaining(['TYPE_REMOVED', 'UNION_MEMBER_REMOVED']));
  });
});

// ---------------------------------------------------------------------------
// protocol mismatch + command layer
// ---------------------------------------------------------------------------

async function captureEnvelope<T = unknown>(fn: () => Promise<void>): Promise<T> {
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

describe('bridge diff: command layer', () => {
  it('protocol change is breaking', () => {
    const d = diffContracts(loadContract(spec('proto', PROTO_BASE)), loadContract(spec('graphql', GQL_BASE)));
    expect(codes(d, 'breaking')).toEqual(['PROTOCOL_CHANGED']);
  });

  it('--json: compatible diff exits 0; breaking diff still emits an ok envelope but exits 1', async () => {
    const base = spec('yaml', OPENAPI_BASE);
    const additive = spec('yaml', openapi(doc => { doc.components.schemas.Item.properties.extra = { type: 'string' }; }));
    const okEnv = await captureEnvelope<{ ok: boolean; data: { pass: boolean; compatible: boolean; summary: { breaking: number } } }>(() =>
      runDiff({ base, head: additive, json: true })
    );
    expect(okEnv.ok).toBe(true);
    expect(okEnv.data.pass).toBe(true);
    expect(process.exitCode).toBe(0);

    const breaking = spec('yaml', openapi(doc => { delete doc.paths['/items/{id}'].delete; }));
    const bad = await captureEnvelope<{ ok: boolean; data: { pass: boolean; compatible: boolean; summary: { breaking: number }; changes: { code: string }[] } }>(() =>
      runDiff({ base, head: breaking, json: true })
    );
    expect(bad.ok).toBe(true);
    expect(bad.data.compatible).toBe(false);
    expect(bad.data.summary.breaking).toBe(1);
    expect(bad.data.changes[0].code).toBe('OPERATION_REMOVED');
    expect(process.exitCode).toBe(1);
  });

  it('--strict also fails on dangerous changes', async () => {
    const base = spec('yaml', OPENAPI_BASE);
    const head = spec('yaml', openapi(doc => { doc.components.schemas.Color.enum.push('blue'); }));
    const lax = await captureEnvelope<{ data: { pass: boolean } }>(() => runDiff({ base, head, json: true }));
    expect(lax.data.pass).toBe(true);
    expect(process.exitCode).toBe(0);
    const strict = await captureEnvelope<{ data: { pass: boolean; strict: boolean } }>(() => runDiff({ base, head, json: true, strict: true }));
    expect(strict.data.pass).toBe(false);
    expect(strict.data.strict).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('unreadable or non-spec input is BRIDGE_SPEC_ERROR with exit 1', async () => {
    const env = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
      runDiff({ base: path.join(tmp, 'nope.yaml'), head: spec('yaml', OPENAPI_BASE), json: true })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('BRIDGE_SPEC_ERROR');
    expect(process.exitCode).toBe(1);
  });
});
