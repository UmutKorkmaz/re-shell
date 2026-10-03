// GraphQL gateway generation: compose several services' SDLs into one schema.
//
//   federation  Apollo Federation 2 composition (@apollo/composition) -> supergraph.graphql
//               + an Apollo Gateway server. Composition is run for real; any
//               composition error fails the command with the error codes.
//   stitch      Schema stitching (@graphql-tools/stitch) -> a merged gateway
//               schema + a gateway server that delegates to the subgraphs over HTTP.
//               Conflicting root fields / field types are rejected up front.

import { composeServices } from '@apollo/composition';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { stitchSchemas } from '@graphql-tools/stitch';
import { GraphQLError, isObjectType, parse, printSchema, type GraphQLSchema } from 'graphql';

import type { ClientFile } from './codegen/common';
import { BridgeSpecError } from './spec/errors';
import { buildLenientSchema } from './spec/graphql';

/** One service taking part in the gateway. */
export interface Subgraph {
  name: string;
  sdl: string;
  /** HTTP endpoint of the service's GraphQL API. */
  url?: string;
  /** Where the SDL came from (for messages). */
  source?: string;
}

/** Thrown when composition / stitching fails. Carries structured errors. */
export class BridgeGatewayError extends Error {
  readonly code = 'BRIDGE_GATEWAY_ERROR';
  constructor(message: string, readonly errors: { code: string; message: string; subgraph?: string }[] = []) {
    super(message);
    this.name = 'BridgeGatewayError';
  }
}

/** Gateway modes. */
export type GatewayMode = 'federation' | 'stitch';

/** Result of composing subgraphs. */
export interface GatewayResult {
  mode: GatewayMode;
  subgraphs: { name: string; url?: string; types: number; rootFields: string[] }[];
  /** Federation: the composed supergraph SDL. */
  supergraphSdl?: string;
  /** Stitch: the merged gateway SDL clients see. */
  gatewaySdl: string;
  files: ClientFile[];
  warnings: string[];
}

function composeFederation(subgraphs: Subgraph[]): { supergraphSdl: string; hints: string[] } {
  let result;
  try {
    result = composeServices(
      subgraphs.map(s => ({ name: s.name, url: s.url, typeDefs: parse(s.sdl) }))
    );
  } catch (error: unknown) {
    throw new BridgeGatewayError(
      `Apollo Federation composition could not run: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (result.errors && result.errors.length > 0) {
    const errors = result.errors.map((e: GraphQLError) => ({
      code: String((e.extensions as { code?: string } | undefined)?.code ?? 'COMPOSITION_ERROR'),
      message: e.message,
    }));
    throw new BridgeGatewayError(
      `Apollo Federation composition failed with ${errors.length} error(s): ${errors.map(e => `[${e.code}] ${e.message}`).join(' | ')}`,
      errors
    );
  }
  return { supergraphSdl: result.supergraphSdl as string, hints: (result.hints ?? []).map(h => String(h.toString())) };
}

function rootFields(schema: GraphQLSchema): string[] {
  const out: string[] = [];
  for (const [label, type] of [['Query', schema.getQueryType()], ['Mutation', schema.getMutationType()], ['Subscription', schema.getSubscriptionType()]] as const) {
    if (!type) continue;
    for (const f of Object.keys(type.getFields())) if (!f.startsWith('_')) out.push(`${label}.${f}`);
  }
  return out;
}

/** Detect ambiguities stitching would otherwise resolve silently (last one wins). */
function stitchConflicts(subgraphs: Subgraph[], schemas: Map<string, GraphQLSchema>): { code: string; message: string; subgraph?: string }[] {
  const errors: { code: string; message: string; subgraph?: string }[] = [];
  const rootOwner = new Map<string, string>();
  const fieldType = new Map<string, { type: string; subgraph: string }>();
  for (const s of subgraphs) {
    const schema = schemas.get(s.name)!;
    const roots = new Set([schema.getQueryType()?.name, schema.getMutationType()?.name, schema.getSubscriptionType()?.name].filter(Boolean) as string[]);
    for (const type of Object.values(schema.getTypeMap())) {
      if (type.name.startsWith('__') || type.name.startsWith('_') || !isObjectType(type)) continue;
      const isRoot = roots.has(type.name);
      const typeKey = isRoot ? (type.name === schema.getQueryType()?.name ? 'Query' : type.name === schema.getMutationType()?.name ? 'Mutation' : 'Subscription') : type.name;
      for (const f of Object.values(type.getFields())) {
        if (f.name.startsWith('_')) continue;
        const key = `${typeKey}.${f.name}`;
        if (isRoot) {
          const owner = rootOwner.get(key);
          if (owner && owner !== s.name) {
            errors.push({ code: 'STITCH_ROOT_FIELD_CONFLICT', message: `${key} is defined by both "${owner}" and "${s.name}"; stitching cannot route it`, subgraph: s.name });
          } else {
            rootOwner.set(key, s.name);
          }
        } else {
          const seen = fieldType.get(key);
          if (seen && seen.type !== String(f.type)) {
            errors.push({ code: 'STITCH_FIELD_TYPE_CONFLICT', message: `${key} is ${seen.type} in "${seen.subgraph}" but ${String(f.type)} in "${s.name}"`, subgraph: s.name });
          } else if (!seen) {
            fieldType.set(key, { type: String(f.type), subgraph: s.name });
          }
        }
      }
    }
  }
  return errors;
}

/**
 * Build the stitched gateway schema for the subgraphs. When every subgraph has a
 * URL, delegation executors are attached (a runnable gateway); otherwise only
 * the schema shape is produced.
 */
export function stitchSubgraphs(subgraphs: Subgraph[], options: { executors?: boolean } = {}): GraphQLSchema {
  const schemas = new Map<string, GraphQLSchema>();
  for (const s of subgraphs) schemas.set(s.name, buildLenientSchema(s.sdl, s.source ?? s.name));
  const conflicts = stitchConflicts(subgraphs, schemas);
  if (conflicts.length > 0) {
    throw new BridgeGatewayError(
      `Schema stitching found ${conflicts.length} conflict(s): ${conflicts.map(c => c.message).join('; ')}`,
      conflicts
    );
  }
  return stitchSchemas({
    subschemas: subgraphs.map(s => ({
      schema: schemas.get(s.name)!,
      ...(options.executors && s.url ? { executor: buildHTTPExecutor({ endpoint: s.url }) } : {}),
    })),
  });
}

function stitchGatewaySource(): string {
  return `// Code generated by re-shell service bridge gateway (stitch). DO NOT EDIT.
// Schema-stitching gateway: one GraphQL endpoint over every subgraph in subgraphs.json.
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { buildASTSchema, execute, parse, validate, type GraphQLSchema } from 'graphql';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { stitchSchemas } from '@graphql-tools/stitch';

interface Subgraph {
  name: string;
  /** SDL file, relative to this directory. */
  sdl: string;
  /** Default endpoint; override with <NAME>_URL (e.g. INVENTORY_URL). */
  url: string;
}

const subgraphs = JSON.parse(fs.readFileSync(path.join(__dirname, 'subgraphs.json'), 'utf8')) as Subgraph[];

export function buildGateway(): GraphQLSchema {
  return stitchSchemas({
    subschemas: subgraphs.map(s => {
      const envKey = s.name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_URL';
      const sdl = fs.readFileSync(path.join(__dirname, s.sdl), 'utf8');
      return {
        schema: buildASTSchema(parse(sdl), { assumeValidSDL: true }),
        executor: buildHTTPExecutor({ endpoint: process.env[envKey] ?? s.url }),
      };
    }),
  });
}

export function startGateway(port = Number(process.env.PORT ?? 4000)): http.Server {
  const schema = buildGateway();
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || !(req.url ?? '').startsWith('/graphql')) {
      res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'POST /graphql' }));
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c as Buffer));
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
          query?: string;
          variables?: Record<string, unknown>;
          operationName?: string;
        };
        const document = parse(body.query ?? '');
        const errors = validate(schema, document);
        const result = errors.length
          ? { errors }
          : await execute({ schema, document, variableValues: body.variables, operationName: body.operationName });
        res.writeHead(errors.length ? 400 : 200, { 'content-type': 'application/json' }).end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ errors: [{ message: String(error) }] }));
      }
    });
  });
  server.listen(port);
  return server;
}

if (require.main === module) {
  const server = startGateway();
  server.on('listening', () => console.log('stitching gateway listening on :' + (server.address() as { port: number }).port));
}
`;
}

function federationGatewaySource(): string {
  return `// Code generated by re-shell service bridge gateway (federation). DO NOT EDIT.
// Apollo Gateway over the composed supergraph.graphql. Every subgraph must implement
// the Apollo Federation subgraph spec (_service / _entities) for entity resolution.
import { readFileSync } from 'fs';
import * as path from 'path';
import { ApolloGateway } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const supergraphSdl = readFileSync(path.join(__dirname, '..', 'supergraph.graphql'), 'utf8');

async function main(): Promise<void> {
  const server = new ApolloServer({ gateway: new ApolloGateway({ supergraphSdl }) });
  const { url } = await startStandaloneServer(server, { listen: { port: Number(process.env.PORT ?? 4000) } });
  console.log('federation gateway ready at ' + url);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
`;
}

function describeSubgraph(s: Subgraph): GatewayResult['subgraphs'][number] {
  const schema = buildLenientSchema(s.sdl, s.source ?? s.name);
  const types = Object.values(schema.getTypeMap()).filter(t => !t.name.startsWith('__') && !t.name.startsWith('_')).length;
  return { name: s.name, url: s.url, types, rootFields: rootFields(schema) };
}

/**
 * Compose subgraphs into a gateway.
 *
 * @throws BridgeGatewayError on composition / stitching conflicts;
 *   BridgeSpecError for invalid SDL; plain Error for fewer than two subgraphs.
 */
export function generateGateway(subgraphs: Subgraph[], mode: GatewayMode): GatewayResult {
  if (subgraphs.length < 2) {
    throw new BridgeGatewayError(`a gateway composes at least two GraphQL services (got ${subgraphs.length})`);
  }
  const names = new Set<string>();
  for (const s of subgraphs) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(s.name)) throw new BridgeGatewayError(`invalid subgraph name "${s.name}"`);
    if (names.has(s.name)) throw new BridgeGatewayError(`duplicate subgraph name "${s.name}"`);
    names.add(s.name);
    buildLenientSchema(s.sdl, s.source ?? s.name); // BridgeSpecError for invalid SDL
  }

  const warnings: string[] = [];
  for (const s of subgraphs) {
    if (!s.url) warnings.push(`subgraph "${s.name}" has no URL; set one before running the gateway`);
  }
  const files: ClientFile[] = [];
  let supergraphSdl: string | undefined;
  let gatewaySdl: string;

  if (mode === 'federation') {
    const composed = composeFederation(subgraphs);
    supergraphSdl = composed.supergraphSdl;
    for (const h of composed.hints) warnings.push(`composition hint: ${h}`);
    gatewaySdl = supergraphSdl;
    files.push({ path: 'supergraph.graphql', content: supergraphSdl, kind: 'graphql-sdl' });
    for (const s of subgraphs) files.push({ path: `gateway/subgraphs/${s.name}.graphql`, content: s.sdl, kind: 'graphql-sdl' });
    files.push({ path: 'gateway/index.ts', content: federationGatewaySource(), kind: 'ts-client' });
    files.push({
      path: 'gateway/package.json',
      content:
        JSON.stringify(
          {
            name: 'graphql-gateway',
            private: true,
            main: 'index.js',
            scripts: { build: 'tsc index.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck', start: 'node index.js' },
            dependencies: { '@apollo/gateway': '^2.9.0', '@apollo/server': '^4.11.0', graphql: '^16.9.0' },
            devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
          },
          null,
          2
        ) + '\n',
      kind: 'manifest',
    });
    files.push({
      path: 'gateway/subgraphs.json',
      content: JSON.stringify(subgraphs.map(s => ({ name: s.name, url: s.url ?? null, sdl: `subgraphs/${s.name}.graphql` })), null, 2) + '\n',
      kind: 'support',
    });
  } else {
    const schema = stitchSubgraphs(subgraphs);
    gatewaySdl = printSchema(schema);
    files.push({ path: 'gateway.graphql', content: gatewaySdl + '\n', kind: 'graphql-sdl' });
    for (const s of subgraphs) files.push({ path: `gateway/subgraphs/${s.name}.graphql`, content: s.sdl, kind: 'graphql-sdl' });
    files.push({
      path: 'gateway/subgraphs.json',
      content: JSON.stringify(subgraphs.map(s => ({ name: s.name, url: s.url ?? `http://localhost:4001/graphql`, sdl: `subgraphs/${s.name}.graphql` })), null, 2) + '\n',
      kind: 'support',
    });
    files.push({ path: 'gateway/index.ts', content: stitchGatewaySource(), kind: 'ts-client' });
    files.push({
      path: 'gateway/package.json',
      content:
        JSON.stringify(
          {
            name: 'graphql-gateway',
            private: true,
            main: 'index.js',
            scripts: { build: 'tsc index.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck', start: 'node index.js' },
            dependencies: { '@graphql-tools/executor-http': '^3.0.0', '@graphql-tools/stitch': '^10.0.0', graphql: '^16.9.0' },
            devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
          },
          null,
          2
        ) + '\n',
      kind: 'manifest',
    });
  }

  files.push({
    path: 'README.md',
    content: [
      `# GraphQL gateway (${mode})`,
      '',
      `Composes ${subgraphs.length} GraphQL services: ${subgraphs.map(s => s.name).join(', ')}.`,
      '',
      mode === 'federation'
        ? '`supergraph.graphql` was composed with Apollo Federation 2 (`@apollo/composition`). Run `gateway/` with `npm i && npm run build && npm start`; every subgraph must implement the federation subgraph spec.'
        : '`gateway.graphql` is the stitched schema clients see. Run `gateway/` with `npm i && npm run build && npm start`; set `<NAME>_URL` env vars (e.g. `INVENTORY_URL`) or edit `gateway/subgraphs.json` to point at the services.',
      '',
    ].join('\n'),
    kind: 'readme',
  });

  return {
    mode,
    subgraphs: subgraphs.map(describeSubgraph),
    supergraphSdl,
    gatewaySdl,
    files,
    warnings,
  };
}

export { BridgeSpecError };
