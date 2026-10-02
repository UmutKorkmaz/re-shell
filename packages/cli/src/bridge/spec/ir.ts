// Protocol-neutral intermediate representation (IR) of a service contract.
//
// OpenAPI, .proto and GraphQL SDL are each parsed into this one model; the
// client generators (TS / Python / Go), the contract differ and the mock server
// all consume it, so every protocol gets every language/feature without N x M
// special cases.

/** Wire protocols the bridge understands. */
export type BridgeProtocol = 'grpc' | 'rest' | 'graphql';

/** Scalar kinds, deliberately coarse: per-language mapping lives in the generators. */
export type ScalarName =
  | 'string'
  | 'int'
  | 'long'
  | 'float'
  | 'bool'
  | 'bytes'
  | 'datetime'
  | 'any';

/** A reference to a type: scalar, named model, list or string-keyed map. */
export type TypeRef =
  | { k: 'scalar'; name: ScalarName }
  | { k: 'ref'; name: string }
  | { k: 'list'; of: TypeRef; itemNullable?: boolean }
  | { k: 'map'; of: TypeRef };

/** A field of an object model (or an argument of an operation). */
export interface IRField {
  /** Name exactly as it appears on the wire. */
  name: string;
  type: TypeRef;
  /** True when the field is always present (non-null / required). */
  required: boolean;
  /** True when an explicit null is a legal value. */
  nullable?: boolean;
  description?: string;
  /** proto field number. */
  tag?: number;
  /** GraphQL: printed type of an argument, e.g. `[String!]!` (used for variables). */
  gqlType?: string;
  /** GraphQL: the field needs arguments, so it is left out of generated selection sets. */
  noSelect?: boolean;
}

/** A message / object / input type. */
export interface IRObject {
  kind: 'object';
  name: string;
  fields: IRField[];
  description?: string;
  /** proto: fully-qualified message name, e.g. `acme.orders.Order`. */
  fqn?: string;
  /** GraphQL input object. */
  input?: boolean;
  /** GraphQL: interface implemented by concrete types listed in `implementors`. */
  isInterface?: boolean;
  implementors?: string[];
}

/** An enum. */
export interface IREnum {
  kind: 'enum';
  name: string;
  values: { name: string; number?: number }[];
  description?: string;
  fqn?: string;
}

/** A union of object models (GraphQL union / OpenAPI oneOf of refs). */
export interface IRUnion {
  kind: 'union';
  name: string;
  members: string[];
  description?: string;
}

/** Any named model. */
export type IRModel = IRObject | IREnum | IRUnion;

/** An OpenAPI parameter. */
export interface IRParam {
  name: string;
  in: 'path' | 'query' | 'header';
  type: TypeRef;
  required: boolean;
  description?: string;
}

/** HTTP verbs the REST generators handle. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** REST operation (one OpenAPI path + method). */
export interface IRRestOperation {
  protocol: 'rest';
  /** Identifier-safe camelCase name (operationId or synthesized). */
  name: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  params: IRParam[];
  body?: { type: TypeRef; required: boolean };
  /** Success response body; absent when the response has no body. */
  response?: { type: TypeRef };
}

/** gRPC method. */
export interface IRRpcOperation {
  protocol: 'grpc';
  name: string;
  /** Simple service name, e.g. `OrderService`. */
  service: string;
  /** Fully-qualified service name, e.g. `acme.orders.OrderService`. */
  fqService: string;
  /** RPC name as in the .proto (PascalCase). */
  method: string;
  request: TypeRef;
  response: TypeRef;
  clientStreaming: boolean;
  serverStreaming: boolean;
  description?: string;
}

/** GraphQL root field. */
export interface IRGraphqlOperation {
  protocol: 'graphql';
  name: string;
  operation: 'query' | 'mutation' | 'subscription';
  /** Root field name. */
  field: string;
  args: IRField[];
  returns: TypeRef;
  returnsNullable: boolean;
  description?: string;
}

/** Any operation. */
export type IROperation = IRRestOperation | IRRpcOperation | IRGraphqlOperation;

/** Where the contract came from. */
export interface ContractSource {
  /** Absolute path of the spec file. */
  path: string;
  format: 'openapi-json' | 'openapi-yaml' | 'proto' | 'graphql';
  /** sha256 hex of the spec bytes. */
  sha256: string;
}

/** A fully parsed service contract. */
export interface ServiceContract {
  protocol: BridgeProtocol;
  /** Human title (OpenAPI info.title / proto service / SDL). */
  title: string;
  version?: string;
  /** REST: first server URL. */
  baseUrl?: string;
  /** proto: package name. */
  packageName?: string;
  models: IRModel[];
  operations: IROperation[];
  source: ContractSource;
  /** Non-fatal problems found while parsing (unsupported constructs...). */
  warnings: string[];
  /** proto: absolute paths of local files the main .proto imports. */
  imports?: string[];
}

/** Look up a model by name. */
export function findModel(contract: ServiceContract, name: string): IRModel | undefined {
  return contract.models.find(m => m.name === name);
}

/** Convenience constructors. */
export const t = {
  scalar: (name: ScalarName): TypeRef => ({ k: 'scalar', name }),
  ref: (name: string): TypeRef => ({ k: 'ref', name }),
  list: (of: TypeRef, itemNullable?: boolean): TypeRef =>
    itemNullable ? { k: 'list', of, itemNullable } : { k: 'list', of },
  map: (of: TypeRef): TypeRef => ({ k: 'map', of }),
};
