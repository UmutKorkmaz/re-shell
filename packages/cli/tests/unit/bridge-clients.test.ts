import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

import { buildBridgeBundle, parseLanguages } from '../../src/bridge/generate';
import { loadContract } from '../../src/bridge/spec/discover';
import { verifyBundleFiles, type VerifyResult } from '../../src/bridge/verify';

const WS = path.join(__dirname, '..', 'fixtures', 'bridge-workspace', 'services');

function have(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
const HAS_PY = have('python3', ['--version']);
const HAS_MYPY = HAS_PY && have('python3', ['-m', 'mypy', '--version']);
const HAS_GO = have('go', ['version']);

function result(results: VerifyResult[], tool: RegExp): VerifyResult {
  const r = results.find(x => tool.test(x.tool));
  expect(r, `no verification result for ${tool}`).toBeDefined();
  return r as VerifyResult;
}

const CASES = [
  { name: 'REST (OpenAPI)', dir: 'catalog', spec: 'openapi.yaml', service: 'catalog' },
  { name: 'GraphQL (SDL)', dir: 'inventory', spec: 'schema.graphql', service: 'inventory' },
] as const;

describe.each(CASES)('bridge clients: $name', ({ dir, spec, service }) => {
  const contract = loadContract(path.join(WS, dir, spec));
  const bundle = buildBridgeBundle({ serviceName: service, contract });
  const results = verifyBundleFiles(bundle.files, bundle.languages);

  it('emits the contract copy plus a client package per language', () => {
    const paths = bundle.files.map(f => f.path);
    expect(paths).toContain(spec);
    expect(paths).toContain('ts/client.ts');
    expect(paths).toContain('ts/package.json');
    expect(paths).toContain(`python/${service}_client/client.py`);
    expect(paths).toContain('python/pyproject.toml');
    expect(paths).toContain('go/client.go');
    expect(paths).toContain('go/go.mod');
    expect(paths).toContain('.re-shell-bridge.json');
  });

  it('TypeScript client compiles under tsc --strict', () => {
    const r = result(results, /tsc/);
    expect(r.status, r.detail).toBe('passed');
  });

  it.skipIf(!HAS_PY)('Python client passes python3 -m py_compile', () => {
    const r = result(results, /py_compile/);
    expect(r.status, r.detail).toBe('passed');
  });

  it.skipIf(!HAS_MYPY)('Python client passes mypy --strict', () => {
    const r = result(results, /mypy/);
    expect(r.status, r.detail).toBe('passed');
  });

  it.skipIf(!HAS_GO)('Go client passes go build + go vet', () => {
    const r = result(results, /go build/);
    expect(r.status, r.detail).toBe('passed');
  });
});

describe('bridge clients: language selection', () => {
  it('parses --lang lists and rejects unknown languages', () => {
    expect(parseLanguages('ts,py')).toEqual(['ts', 'python']);
    expect(parseLanguages(undefined)).toEqual(['ts', 'python', 'go']);
    expect(() => parseLanguages('cobol')).toThrow(/Unsupported client language/);
  });

  it('only emits the requested languages', () => {
    const contract = loadContract(path.join(WS, 'catalog', 'openapi.yaml'));
    const bundle = buildBridgeBundle({ serviceName: 'catalog', contract, languages: ['go'] });
    expect(bundle.files.some(f => f.path.startsWith('ts/'))).toBe(false);
    expect(bundle.files.some(f => f.path.startsWith('python/'))).toBe(false);
    expect(bundle.files.some(f => f.path === 'go/client.go')).toBe(true);
  });
});
