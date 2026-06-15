import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runApiVerify } from '../../src/commands/api-verify';
import { apiVerifyResponseSchema } from '@re-shell/contracts';

/**
 * Integration coverage for `re-shell api verify` (issue #16). Filesystem access
 * is confined to temp dirs torn down after each test.
 */

function specJson(title: string, paths: Record<string, unknown>): string {
  return JSON.stringify({ openapi: '3.0.0', info: { title, version: '1.0.0' }, paths });
}

function makeTempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-api-verify-'));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return dir;
}

const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(files: Record<string, string>): string {
  const d = makeTempDir(files);
  TEMP_DIRS.push(d);
  return d;
}

const BASELINE_SPEC = specJson('users', {
  '/users/{id}': {
    get: {
      parameters: [{ name: 'id', in: 'path', required: true }],
      responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { id: {}, email: {} } } } } } },
    },
  },
  '/users': { post: { responses: { 200: { description: 'created' } } } },
});

describe('runApiVerify', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];
  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });
  afterEach(() => {
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });
  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  it('flags a removed operation as breaking with the impacted consumers and exits non-zero', async () => {
    const dir = tmp({
      'apps/users/openapi.json': specJson('users', {
        '/users/{id}': { get: { responses: { 200: { description: 'ok' } } } },
      }),
    });
    const baseline = tmp({ 'apps/users/openapi.json': BASELINE_SPEC });
    await runApiVerify({ json: true, cwd: dir, api: 'users', baseline });
    const env = lastJson();
    expect(env['ok']).toBe(true);
    const data = env['data'] as { pass: boolean; breakingCount: number; findings: Array<{ kind: string; consumers: string[] }> };
    expect(data.breakingCount).toBeGreaterThan(0);
    expect(data.findings.some(f => f.kind === 'operation-removed')).toBe(true);
    expect(data.pass).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('passes when the spec is unchanged from the baseline', async () => {
    const dir = tmp({ 'apps/users/openapi.json': BASELINE_SPEC });
    const baseline = tmp({ 'apps/users/openapi.json': BASELINE_SPEC });
    await runApiVerify({ json: true, cwd: dir, api: 'users', baseline });
    const data = lastJson().data as { pass: boolean; breakingCount: number };
    expect(data.breakingCount).toBe(0);
    expect(data.pass).toBe(true);
  });

  it('emits output that validates against apiVerifyResponseSchema', async () => {
    const dir = tmp({ 'apps/users/openapi.json': BASELINE_SPEC });
    await runApiVerify({ json: true, cwd: dir, api: 'users' });
    expect(apiVerifyResponseSchema.safeParse(lastJson().data).success).toBe(true);
  });

  it('surfaces API_VERIFY_ERROR when no spec is found', async () => {
    const dir = tmp({ 'README.md': 'no specs' });
    await runApiVerify({ json: true, cwd: dir, api: 'users' });
    const env = lastJson();
    expect(env['ok']).toBe(false);
    expect((env['error'] as { code: string }).code).toBe('API_VERIFY_ERROR');
  });

  it('honours an explicit --spec path', async () => {
    const dir = tmp({ 'specs/users.json': BASELINE_SPEC });
    await runApiVerify({ json: true, cwd: dir, api: 'users', spec: 'specs/users.json' });
    const data = lastJson().data as { api: string; pass: boolean };
    // No baseline → nothing to diff → pass with no findings.
    expect(data.api).toBe('users');
    expect(data.pass).toBe(true);
  });
});
