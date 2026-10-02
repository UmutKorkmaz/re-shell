// GraphQL mock: execute any query against a schema built from the SDL, with
// resolvers that fabricate deterministic data from the declared types.

import {
  execute,
  getNamedType,
  isAbstractType,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  parse,
  validate,
  type GraphQLObjectType,
  type GraphQLOutputType,
  type GraphQLSchema,
} from 'graphql';

import { buildLenientSchema } from '../spec/graphql';

/** Result of one GraphQL request. */
export interface GraphqlReply {
  status: number;
  body: unknown;
  operationName?: string;
}

const SCALARS: Record<string, (field: string) => unknown> = {
  String: field => field,
  ID: () => '1',
  Int: () => 42,
  Float: () => 3.14,
  Boolean: () => true,
  DateTime: () => '2024-01-01T00:00:00Z',
  Date: () => '2024-01-01',
};

interface MockSource {
  __mockArgs?: Record<string, unknown>;
  [key: string]: unknown;
}

function scalarFor(typeName: string, fieldName: string, args: Record<string, unknown> | undefined): unknown {
  // Echo an argument with the same name (e.g. `sku`) so mutations look plausible.
  if (args && fieldName in args && typeof args[fieldName] !== 'object') return args[fieldName];
  const make = SCALARS[typeName];
  return make ? make(fieldName) : null;
}

function mockValue(type: GraphQLOutputType, fieldName: string, source: MockSource | undefined): unknown {
  const inner = isNonNullType(type) ? type.ofType : type;
  if (isListType(inner)) {
    return [mockValue(inner.ofType as GraphQLOutputType, fieldName, source), mockValue(inner.ofType as GraphQLOutputType, fieldName, source)];
  }
  const named = getNamedType(inner);
  if (isScalarType(named)) return scalarFor(named.name, fieldName, source?.__mockArgs);
  if (isEnumType(named)) {
    const values = named.getValues();
    return values[0]?.value ?? null;
  }
  // object / interface / union: a marker object whose fields resolve lazily.
  return { __mockArgs: source?.__mockArgs };
}

/** A mock GraphQL endpoint for one SDL. */
export interface GraphqlMock {
  schema: GraphQLSchema;
  /** Run a GraphQL request body (`{query, variables, operationName}`). */
  run(payload: { query?: unknown; variables?: unknown; operationName?: unknown }): Promise<GraphqlReply>;
}

/** Build a mock from SDL text. */
export function createGraphqlMock(sdl: string, label = 'schema'): GraphqlMock {
  const schema = buildLenientSchema(sdl, label);

  const run: GraphqlMock['run'] = async payload => {
    if (typeof payload.query !== 'string' || payload.query.trim() === '') {
      return { status: 400, body: { errors: [{ message: 'Must provide a query string.' }] } };
    }
    let document;
    try {
      document = parse(payload.query);
    } catch (error: unknown) {
      return { status: 400, body: { errors: [{ message: error instanceof Error ? error.message : String(error) }] } };
    }
    const operationName = typeof payload.operationName === 'string' ? payload.operationName : undefined;
    const errors = validate(schema, document);
    if (errors.length > 0) {
      return { status: 400, body: { errors: errors.map(e => ({ message: e.message, locations: e.locations })) }, operationName };
    }
    const result = await execute({
      schema,
      document,
      operationName,
      variableValues: typeof payload.variables === 'object' && payload.variables !== null ? (payload.variables as Record<string, unknown>) : undefined,
      rootValue: {},
      fieldResolver: (source: MockSource | undefined, args, _ctx, info) => {
        // Root fields remember their arguments for echoing; nested ones inherit them.
        const value = mockValue(info.returnType, info.fieldName, { ...source, __mockArgs: Object.keys(args).length ? { ...(source?.__mockArgs ?? {}), ...flatten(args) } : source?.__mockArgs });
        return value;
      },
      typeResolver: (_value, _ctx, _info, abstractType) => {
        if (!isAbstractType(abstractType)) return undefined;
        const possible = schema.getPossibleTypes(abstractType) as readonly GraphQLObjectType[];
        return possible.find(isObjectType)?.name;
      },
    });
    return { status: 200, body: result, operationName };
  };

  return { schema, run };
}

function flatten(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>));
    else out[k] = v;
  }
  return out;
}
