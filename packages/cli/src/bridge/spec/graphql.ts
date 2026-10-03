// GraphQL SDL -> ServiceContract IR, via graphql-js.

import {
  Kind,
  buildASTSchema,
  extendSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  parse,
  type DefinitionNode,
  type DocumentNode,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLSchema,
} from 'graphql';

import { BridgeSpecError } from './errors';
import {
  t,
  type ContractSource,
  type IRField,
  type IRModel,
  type IROperation,
  type ServiceContract,
  type TypeRef,
} from './ir';
import { toCamel } from '../naming';

const EXTENSION_TO_DEFINITION: Record<string, Kind> = {
  [Kind.OBJECT_TYPE_EXTENSION]: Kind.OBJECT_TYPE_DEFINITION,
  [Kind.INTERFACE_TYPE_EXTENSION]: Kind.INTERFACE_TYPE_DEFINITION,
  [Kind.INPUT_OBJECT_TYPE_EXTENSION]: Kind.INPUT_OBJECT_TYPE_DEFINITION,
  [Kind.ENUM_TYPE_EXTENSION]: Kind.ENUM_TYPE_DEFINITION,
  [Kind.UNION_TYPE_EXTENSION]: Kind.UNION_TYPE_DEFINITION,
  [Kind.SCALAR_TYPE_EXTENSION]: Kind.SCALAR_TYPE_DEFINITION,
};

/**
 * Build a schema from SDL tolerantly: unknown directives (federation `@key`,
 * `@link`...) are accepted, and `extend type X` with no base `type X` is
 * promoted to a definition (Federation 1 subgraph style).
 */
export function buildLenientSchema(sdl: string, label = 'schema'): GraphQLSchema {
  let doc: DocumentNode;
  try {
    doc = parse(sdl);
  } catch (error: unknown) {
    throw new BridgeSpecError(
      `${label}: invalid GraphQL SDL: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const base: DefinitionNode[] = [];
  const ext: DefinitionNode[] = [];
  const baseNames = new Set<string>();
  for (const def of doc.definitions) {
    if ('name' in def && def.name && !(def.kind in EXTENSION_TO_DEFINITION) && (def.kind as string) !== Kind.SCHEMA_EXTENSION) {
      baseNames.add(def.name.value);
    }
  }
  for (const def of doc.definitions) {
    if ((def.kind as string) === Kind.SCHEMA_EXTENSION) continue;
    if (def.kind in EXTENSION_TO_DEFINITION && 'name' in def && def.name) {
      if (!baseNames.has(def.name.value)) {
        base.push({ ...def, kind: EXTENSION_TO_DEFINITION[def.kind] } as unknown as DefinitionNode);
        baseNames.add(def.name.value);
      } else {
        ext.push(def);
      }
    } else {
      base.push(def);
    }
  }
  try {
    let schema = buildASTSchema({ kind: Kind.DOCUMENT, definitions: base }, { assumeValidSDL: true });
    if (ext.length > 0) {
      schema = extendSchema(schema, { kind: Kind.DOCUMENT, definitions: ext }, { assumeValidSDL: true });
    }
    return schema;
  } catch (error: unknown) {
    throw new BridgeSpecError(
      `${label}: cannot build GraphQL schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

const SCALAR_MAP: Record<string, TypeRef> = {
  String: t.scalar('string'),
  ID: t.scalar('string'),
  Int: t.scalar('int'),
  Float: t.scalar('float'),
  Boolean: t.scalar('bool'),
  DateTime: t.scalar('datetime'),
  Date: t.scalar('datetime'),
  Time: t.scalar('datetime'),
  Timestamp: t.scalar('datetime'),
  BigInt: t.scalar('long'),
  Long: t.scalar('long'),
};

function isFederationNoise(name: string): boolean {
  return name.startsWith('_') || name.includes('__');
}

function toTypeRef(type: GraphQLInputType | GraphQLOutputType): { ref: TypeRef; nullable: boolean } {
  let nullable = true;
  let cur = type;
  if (isNonNullType(cur)) {
    nullable = false;
    cur = cur.ofType;
  }
  if (isListType(cur)) {
    const inner = toTypeRef(cur.ofType as GraphQLOutputType);
    return { ref: t.list(inner.ref, inner.nullable), nullable };
  }
  const named = getNamedType(cur) as GraphQLNamedType;
  if (isScalarType(named)) return { ref: SCALAR_MAP[named.name] ?? t.scalar('any'), nullable };
  return { ref: t.ref(named.name), nullable };
}

function fieldNeedsArgs(field: GraphQLField<unknown, unknown>): boolean {
  return field.args.some(a => isNonNullType(a.type) && a.defaultValue === undefined);
}

/** Convert an already-built schema into the IR. */
export function schemaToContract(schema: GraphQLSchema, source: ContractSource): ServiceContract {
  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();
  const rootNames = new Set(
    [queryType, mutationType, subscriptionType].filter(Boolean).map(x => (x as GraphQLNamedType).name)
  );

  const models: IRModel[] = [];
  for (const type of Object.values(schema.getTypeMap())) {
    if (type.name.startsWith('__') || isFederationNoise(type.name)) continue;
    if (isScalarType(type)) continue;
    if (rootNames.has(type.name)) continue;
    if (isEnumType(type)) {
      models.push({
        kind: 'enum',
        name: type.name,
        values: type.getValues().map(v => ({ name: v.name })),
        description: type.description ?? undefined,
      });
    } else if (isUnionType(type)) {
      models.push({
        kind: 'union',
        name: type.name,
        members: type.getTypes().map(m => m.name),
        description: type.description ?? undefined,
      });
    } else if (isInputObjectType(type)) {
      const fields: IRField[] = Object.values(type.getFields()).map(f => {
        const r = toTypeRef(f.type);
        return {
          name: f.name,
          type: r.ref,
          required: !r.nullable && f.defaultValue === undefined,
          nullable: r.nullable || undefined,
          description: f.description ?? undefined,
          gqlType: String(f.type),
        };
      });
      models.push({ kind: 'object', name: type.name, fields, input: true, description: type.description ?? undefined });
    } else if (isObjectType(type) || isInterfaceType(type)) {
      const fields: IRField[] = Object.values(type.getFields())
        .filter(f => !isFederationNoise(f.name))
        .map(f => {
          const r = toTypeRef(f.type);
          const needsArgs = fieldNeedsArgs(f);
          return {
            name: f.name,
            type: r.ref,
            // Fields that need arguments are never selected by the generated
            // documents, so clients must treat them as absent.
            required: !r.nullable && !needsArgs,
            nullable: r.nullable || undefined,
            description: f.description ?? undefined,
            noSelect: needsArgs || undefined,
          };
        });
      models.push({
        kind: 'object',
        name: type.name,
        fields,
        description: type.description ?? undefined,
        ...(isInterfaceType(type)
          ? {
              isInterface: true,
              implementors: schema.getPossibleTypes(type).map(x => x.name),
            }
          : {}),
      });
    }
  }
  models.sort((a, b) => a.name.localeCompare(b.name));

  const operations: IROperation[] = [];
  const usedNames = new Set<string>();
  const addRoot = (
    rootType: ReturnType<GraphQLSchema['getQueryType']>,
    operation: 'query' | 'mutation' | 'subscription'
  ): void => {
    if (!rootType) return;
    for (const f of Object.values(rootType.getFields())) {
      if (isFederationNoise(f.name)) continue;
      let name = toCamel(f.name);
      if (usedNames.has(name)) name = `${name}${operation[0].toUpperCase()}${operation.slice(1)}`;
      usedNames.add(name);
      const r = toTypeRef(f.type);
      operations.push({
        protocol: 'graphql',
        name,
        operation,
        field: f.name,
        args: f.args.map(a => {
          const ar = toTypeRef(a.type);
          return {
            name: a.name,
            type: ar.ref,
            required: !ar.nullable && a.defaultValue === undefined,
            nullable: ar.nullable || undefined,
            description: a.description ?? undefined,
            gqlType: String(a.type),
          };
        }),
        returns: r.ref,
        returnsNullable: r.nullable,
        description: f.description ?? undefined,
      });
    }
  };
  addRoot(queryType, 'query');
  addRoot(mutationType, 'mutation');
  addRoot(subscriptionType, 'subscription');

  const warnings: string[] = [];
  if (!queryType && !mutationType && !subscriptionType) {
    warnings.push('SDL defines no Query/Mutation/Subscription root; only types were generated');
  }
  if (subscriptionType) {
    warnings.push('Subscription operations are listed in the contract but clients only generate query/mutation methods');
  }

  return {
    protocol: 'graphql',
    title: queryType ? 'GraphQL API' : 'GraphQL types',
    models,
    operations,
    source,
    warnings,
  };
}

/** Parse GraphQL SDL text into the IR. */
export function graphqlToContract(sdl: string, source: ContractSource): ServiceContract {
  return schemaToContract(buildLenientSchema(sdl, source.path), source);
}
