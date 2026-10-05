// Spec discovery + loading: find a service's own OpenAPI / .proto / GraphQL SDL
// and turn it into the shared contract IR.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { BridgeSpecError } from './errors';
import { graphqlToContract } from './graphql';
import type { BridgeProtocol, ContractSource, ServiceContract } from './ir';
import { openApiToContract } from './openapi';
import { protoToContract } from './proto';

/** Marker written next to generated bridge output so discovery never mistakes copies for the provider's own spec. */
export const BRIDGE_MARKER = '.re-shell-bridge.json';

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'target', 'vendor', '__pycache__', '.venv', 'venv',
  '.next', 'coverage', '.turbo',
]);

/** One spec file found in a service directory. */
export interface SpecCandidate {
  path: string;
  protocol: BridgeProtocol;
  format: ContractSource['format'];
}

/** Map a file path to the protocol/format it would represent, by extension only. */
export function formatFromExtension(file: string): { protocol: BridgeProtocol; format: ContractSource['format'] } | undefined {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.proto') return { protocol: 'grpc', format: 'proto' };
  if (ext === '.graphql' || ext === '.gql' || ext === '.graphqls') return { protocol: 'graphql', format: 'graphql' };
  if (ext === '.json') return { protocol: 'rest', format: 'openapi-json' };
  if (ext === '.yaml' || ext === '.yml') return { protocol: 'rest', format: 'openapi-yaml' };
  return undefined;
}

function looksLikeOpenApi(file: string): boolean {
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 65536);
    return /^\s*["']?(openapi|swagger)["']?\s*:/m.test(head);
  } catch {
    return false;
  }
}

function hasProtoService(file: string): boolean {
  try {
    return /^\s*service\s+\w+/m.test(fs.readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
}

function hasGraphqlRoot(file: string): boolean {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return /\b(type|extend\s+type)\s+(Query|Mutation|Subscription)\b|^\s*schema\s*(@\w+[^{]*)?\{/m.test(text);
  } catch {
    return false;
  }
}

function walk(dir: string, depth: number, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some(e => e.isFile() && e.name === BRIDGE_MARKER)) return;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth > 0 && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full, depth - 1, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

/**
 * Find every service spec under `dir` (depth <= 3), excluding build output and
 * generated bridge directories. OpenAPI documents are recognised by content,
 * `.proto` files that declare a `service` and GraphQL SDL that declares a root
 * type are preferred over message-only files.
 */
export function discoverSpecs(dir: string): SpecCandidate[] {
  const files: string[] = [];
  walk(dir, 3, files);
  files.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length || a.localeCompare(b));

  const openapi: SpecCandidate[] = [];
  const protoAll: string[] = [];
  const gqlAll: string[] = [];
  for (const file of files) {
    const fmt = formatFromExtension(file);
    if (!fmt) continue;
    if (fmt.protocol === 'rest') {
      if (looksLikeOpenApi(file)) openapi.push({ path: file, ...fmt });
    } else if (fmt.protocol === 'grpc') {
      protoAll.push(file);
    } else {
      gqlAll.push(file);
    }
  }
  const protoSvc = protoAll.filter(hasProtoService);
  const gqlRoot = gqlAll.filter(hasGraphqlRoot);
  const protos = protoSvc.length > 0 ? protoSvc : protoAll;
  const gqls = gqlRoot.length > 0 ? gqlRoot : gqlAll;
  return [
    ...openapi,
    ...protos.map(p => ({ path: p, protocol: 'grpc' as const, format: 'proto' as const })),
    ...gqls.map(p => ({ path: p, protocol: 'graphql' as const, format: 'graphql' as const })),
  ];
}

/**
 * Choose one spec among candidates.
 *
 * @throws BridgeSpecError when none match or the choice is ambiguous.
 */
export function selectSpec(candidates: SpecCandidate[], protocol?: BridgeProtocol, where = 'the service directory'): SpecCandidate {
  const matching = protocol ? candidates.filter(c => c.protocol === protocol) : candidates;
  if (matching.length === 0) {
    throw new BridgeSpecError(
      `No ${protocol ? `${protocol} ` : ''}spec found in ${where} (looked for OpenAPI yaml/json, .proto, GraphQL SDL). Pass --spec <file>.`
    );
  }
  if (matching.length > 1) {
    const list = matching.map(c => `${c.path} (${c.protocol})`).join(', ');
    throw new BridgeSpecError(
      `Multiple specs found in ${where}: ${list}. Pass --spec <file>${protocol ? '' : ' or --protocol <rest|grpc|graphql>'}.`
    );
  }
  return matching[0];
}

/**
 * Parse a spec file into the contract IR.
 *
 * @param file - Path to an OpenAPI (.yaml/.yml/.json), .proto or GraphQL SDL file.
 * @throws BridgeSpecError for a missing, unreadable, unparseable or unsupported file.
 */
export function loadContract(file: string, options: { includeDirs?: string[] } = {}): ServiceContract {
  const abs = path.resolve(file);
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(abs);
  } catch (error: unknown) {
    throw new BridgeSpecError(`Cannot read spec ${abs}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const fmt = formatFromExtension(abs);
  if (!fmt) {
    throw new BridgeSpecError(`${abs}: unsupported spec type (expected .yaml/.yml/.json OpenAPI, .proto or .graphql/.gql)`);
  }
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const source: ContractSource = { path: abs, format: fmt.format, sha256 };
  const text = bytes.toString('utf8');

  if (fmt.protocol === 'grpc') return protoToContract(source, options.includeDirs);
  if (fmt.protocol === 'graphql') return graphqlToContract(text, source);

  let doc: unknown;
  try {
    doc = fmt.format === 'openapi-json' ? JSON.parse(text) : yaml.load(text);
  } catch (error: unknown) {
    throw new BridgeSpecError(`${abs}: cannot parse ${fmt.format === 'openapi-json' ? 'JSON' : 'YAML'}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return openApiToContract(doc, source);
}

/** Load the spec for a service directory (or an explicit `--spec` path). */
export function resolveContract(options: {
  specPath?: string;
  serviceDir?: string;
  protocol?: BridgeProtocol;
}): ServiceContract {
  if (options.specPath) {
    const contract = loadContract(options.specPath);
    if (options.protocol && contract.protocol !== options.protocol) {
      throw new BridgeSpecError(
        `${options.specPath} is a ${contract.protocol} spec but --${options.protocol} was requested`
      );
    }
    return contract;
  }
  if (!options.serviceDir) throw new BridgeSpecError('No spec path or service directory provided');
  const found = discoverSpecs(options.serviceDir);
  const chosen = selectSpec(found, options.protocol, options.serviceDir);
  return loadContract(chosen.path);
}
