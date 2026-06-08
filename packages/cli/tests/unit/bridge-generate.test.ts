import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {
  generateBridge,
  type BridgeArtifact,
  type GenerateBridgeResult,
} from '../../src/utils/bridge-generate';
import {
  runBridgeGenerate,
  typeCheckTsClient,
} from '../../src/commands/bridge-generate';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

async function inTmp(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-gen-'));
  await fs.copy(path.join(FIXTURES, 'k8s-workspace'), tmpDir);
  return tmpDir;
}

async function captureEnvelope<T = unknown>(fn: () => Promise<void>): Promise<T> {
  const chunks: string[] = [];
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(((chunk: string | Uint8Array) => {
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

function tsClient(result: GenerateBridgeResult): BridgeArtifact {
  const client = result.artifacts.find(a => a.kind === 'ts-client');
  expect(client).toBeDefined();
  return client as BridgeArtifact;
}

// Resolve the optional `graphql` lib once; tests below branch on its presence.
let graphqlLib: typeof import('graphql') | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  graphqlLib = require('graphql') as typeof import('graphql');
} catch {
  graphqlLib = undefined;
}

describe('bridge-generate: gRPC', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits a proto contract + TS client + Python scaffold', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'grpc', cwd: tmpDir, service: 'api' });
    const kinds = result.artifacts.map(a => a.kind).sort();
    expect(kinds).toContain('proto');
    expect(kinds).toContain('ts-client');
    expect(kinds).toContain('scaffold-stub');
    expect(kinds).toContain('scaffold-readme');
  });

  it('the .proto declares proto3 + a service block', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'grpc', cwd: tmpDir, service: 'api' });
    const proto = result.artifacts.find(a => a.kind === 'proto');
    expect(proto).toBeDefined();
    expect((proto as BridgeArtifact).content).toContain('syntax = "proto3"');
    expect((proto as BridgeArtifact).content).toMatch(/service\s+\w+\s*\{/);
    expect((proto as BridgeArtifact).content).toContain('rpc Check');
  });

  it('the emitted TS client type-checks (tsc)', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'grpc', cwd: tmpDir, service: 'api' });
    const check = typeCheckTsClient(result);
    expect(check.ran).toBe(true);
    expect(check.ok, check.detail).toBe(true);
  });

  it('the TS client is syntactically valid and exports a client class', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'grpc', cwd: tmpDir, service: 'api' });
    expect(tsClient(result).content).toMatch(/export class \w+GrpcClient/);
  });
});

describe('bridge-generate: REST', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits an OpenAPI contract + TS client + Python scaffold', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'rest', cwd: tmpDir, service: 'api' });
    const kinds = result.artifacts.map(a => a.kind);
    expect(kinds).toContain('openapi');
    expect(kinds).toContain('ts-client');
    expect(kinds).toContain('scaffold-stub');
  });

  it('the OpenAPI parses as JSON and has paths + components', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'rest', cwd: tmpDir, service: 'api' });
    const spec = result.artifacts.find(a => a.kind === 'openapi') as BridgeArtifact;
    const doc = JSON.parse(spec.content) as Record<string, unknown>;
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths as object).length).toBeGreaterThan(0);
    const components = doc.components as { schemas: Record<string, unknown> };
    expect(Object.keys(components.schemas).length).toBeGreaterThan(0);
  });

  it('the OpenAPI also parses as YAML (JSON is a YAML subset)', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'rest', cwd: tmpDir, service: 'api' });
    const spec = result.artifacts.find(a => a.kind === 'openapi') as BridgeArtifact;
    const doc = yaml.load(spec.content) as Record<string, unknown>;
    expect(doc).toHaveProperty('paths');
    expect(doc).toHaveProperty('components');
  });

  it('the emitted TS client type-checks (tsc)', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'rest', cwd: tmpDir, service: 'api' });
    const check = typeCheckTsClient(result);
    expect(check.ran).toBe(true);
    expect(check.ok, check.detail).toBe(true);
  });
});

describe('bridge-generate: GraphQL', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits an SDL contract + TS client + Python scaffold', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'graphql', cwd: tmpDir, service: 'api' });
    const kinds = result.artifacts.map(a => a.kind);
    expect(kinds).toContain('graphql-sdl');
    expect(kinds).toContain('ts-client');
    expect(kinds).toContain('scaffold-stub');
  });

  it('the SDL is well-formed (graphql lib if present, else structural)', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'graphql', cwd: tmpDir, service: 'api' });
    const sdl = result.artifacts.find(a => a.kind === 'graphql-sdl') as BridgeArtifact;
    if (graphqlLib) {
      expect(() => graphqlLib!.buildSchema(sdl.content)).not.toThrow();
    } else {
      expect(sdl.content).toContain('type Query');
      expect(sdl.content).toMatch(/type \w+ \{/);
    }
  });

  it('the emitted TS client type-checks (tsc)', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'graphql', cwd: tmpDir, service: 'api' });
    const check = typeCheckTsClient(result);
    expect(check.ran).toBe(true);
    expect(check.ok, check.detail).toBe(true);
  });
});

describe('bridge-generate: write semantics + errors', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('dry-run writes nothing even when out is provided', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'bridge-out');
    const result = generateBridge({
      protocol: 'rest',
      cwd: tmpDir,
      service: 'api',
      out: outDir,
      dryRun: true,
    });
    expect(result.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--out (non-dry-run) writes one file per artifact', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'bridge-out');
    const result = generateBridge({
      protocol: 'grpc',
      cwd: tmpDir,
      service: 'api',
      out: outDir,
    });
    expect(result.written).toHaveLength(result.artifacts.length);
    for (const file of result.written) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('defaults to the first service when none is named', async () => {
    tmpDir = await inTmp();
    const result = generateBridge({ protocol: 'rest', cwd: tmpDir });
    expect(result.service).toBe('api');
  });

  it('throws on an unknown protocol', async () => {
    tmpDir = await inTmp();
    expect(() =>
      generateBridge({ protocol: 'soap' as 'rest', cwd: tmpDir })
    ).toThrow(/Unknown bridge protocol/);
  });

  it('throws when the named service is missing', async () => {
    tmpDir = await inTmp();
    expect(() =>
      generateBridge({ protocol: 'rest', cwd: tmpDir, service: 'nope' })
    ).toThrow(/not found/);
  });
});

describe('bridge-generate: command layer (envelopes + exit codes)', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('--json --rest emits an ok envelope with parseable artifacts + tsCheck', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{
      ok: boolean;
      data: {
        protocol: string;
        service: string;
        artifacts: BridgeArtifact[];
        written: string[];
        tsCheck: { ran: boolean; ok?: boolean };
      };
    }>(() => runBridgeGenerate({ protocol: 'rest', json: true, cwd: tmpDir, service: 'api' }));

    expect(env.ok).toBe(true);
    expect(env.data.protocol).toBe('rest');
    expect(env.data.service).toBe('api');
    const spec = env.data.artifacts.find(a => a.kind === 'openapi');
    expect(spec).toBeDefined();
    expect(() => JSON.parse((spec as BridgeArtifact).content)).not.toThrow();
    expect(env.data.tsCheck.ran).toBe(true);
    expect(env.data.tsCheck.ok).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('--json --dry-run writes nothing', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'out');
    const env = await captureEnvelope<{ ok: boolean; data: { written: string[] } }>(() =>
      runBridgeGenerate({
        protocol: 'graphql',
        json: true,
        dryRun: true,
        out: outDir,
        cwd: tmpDir,
        service: 'api',
      })
    );
    expect(env.ok).toBe(true);
    expect(env.data.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--json with no protocol emits BRIDGE_GENERATE_ERROR and exit 1', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{
      ok: boolean;
      error: { code: string; message: string };
    }>(() => runBridgeGenerate({ json: true, cwd: tmpDir }));
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('BRIDGE_GENERATE_ERROR');
    expect(process.exitCode).toBe(1);
  });

  it('--json with an unknown service emits BRIDGE_GENERATE_ERROR and exit 1', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{
      ok: boolean;
      error: { code: string };
    }>(() =>
      runBridgeGenerate({ protocol: 'grpc', json: true, cwd: tmpDir, service: 'ghost' })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('BRIDGE_GENERATE_ERROR');
    expect(process.exitCode).toBe(1);
  });
});
