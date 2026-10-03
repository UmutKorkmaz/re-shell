import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  parseParams,
  renderEvent,
  renderSnapshot,
  sanitizeForTerminal,
} from '../../src/commands/collab-session';
import { configFilePath, normalizeUrl, resolveTarget } from '../../src/utils/control-plane-config';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-config-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('control plane configuration', () => {
  it('prefers flags over environment over the config file', () => {
    const file = path.join(dir, 'control-plane.json');
    fs.writeFileSync(file, JSON.stringify({ url: 'https://file.example', tenant: 'from-file', token: 'file-token' }), { mode: 0o600 });
    const env = {
      RE_SHELL_CONTROL_PLANE_CONFIG: file,
      RE_SHELL_CONTROL_PLANE_URL: 'https://env.example',
      RE_SHELL_CONTROL_PLANE_TENANT: 'from-env',
    };
    const fromFile = resolveTarget({ flags: {}, env: { RE_SHELL_CONTROL_PLANE_CONFIG: file } });
    expect(fromFile).toMatchObject({ ok: true, target: { url: 'https://file.example', tenant: 'from-file', token: 'file-token' } });

    const fromEnv = resolveTarget({ flags: {}, env });
    expect(fromEnv).toMatchObject({ ok: true, target: { url: 'https://env.example', tenant: 'from-env', token: 'file-token' } });

    const fromFlags = resolveTarget({ flags: { url: 'https://flag.example/', tenant: 'from-flag', token: 'flag-token' }, env });
    expect(fromFlags).toMatchObject({ ok: true, target: { url: 'https://flag.example', tenant: 'from-flag', token: 'flag-token' } });
    if (fromFlags.ok) {
      expect(fromFlags.warnings.join(' ')).toMatch(/process list/);
    }
  });

  it('honours the CONTROL_PLANE_URL / _TENANT names the worker already uses', () => {
    const res = resolveTarget({
      flags: {},
      env: { CONTROL_PLANE_URL: 'https://cp.example', CONTROL_PLANE_TENANT: 'acme', RE_SHELL_CONTROL_PLANE_TOKEN: 't' },
      homedir: dir,
    });
    expect(res).toMatchObject({ ok: true, target: { url: 'https://cp.example', tenant: 'acme', token: 't' } });
  });

  it('reads the token from a file and rejects an empty or missing one', () => {
    const tokenFile = path.join(dir, 'token');
    fs.writeFileSync(tokenFile, '  abc.def.ghi \n');
    expect(resolveTarget({ flags: { url: 'https://x.example', tokenFile }, env: {}, homedir: dir })).toMatchObject({
      ok: true,
      target: { token: 'abc.def.ghi' },
    });
    fs.writeFileSync(tokenFile, '\n');
    expect(resolveTarget({ flags: { url: 'https://x.example', tokenFile }, env: {}, homedir: dir })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/empty/),
    });
    expect(
      resolveTarget({ flags: { url: 'https://x.example', tokenFile: path.join(dir, 'nope') }, env: {}, homedir: dir })
    ).toMatchObject({ ok: false, message: expect.stringMatching(/Cannot read the token file/) });
  });

  it('names what is missing', () => {
    const res = resolveTarget({ flags: {}, env: {}, homedir: dir });
    expect(res).toMatchObject({ ok: false, missing: ['url', 'token'] });
    if (!res.ok) {
      expect(res.message).toContain('RE_SHELL_CONTROL_PLANE_URL');
      expect(res.message).toContain(path.join(dir, '.re-shell', 'control-plane.json'));
    }
    expect(resolveTarget({ flags: { url: 'https://x.example' }, env: {}, homedir: dir })).toMatchObject({ missing: ['token'] });
  });

  it('warns about a world-readable config file that holds a token, and rejects a corrupt file', () => {
    const file = path.join(dir, 'control-plane.json');
    fs.writeFileSync(file, JSON.stringify({ url: 'https://x.example', token: 't' }), { mode: 0o644 });
    fs.chmodSync(file, 0o644);
    const res = resolveTarget({ flags: {}, env: { RE_SHELL_CONTROL_PLANE_CONFIG: file } });
    expect(res.ok).toBe(true);
    if (res.ok && process.platform !== 'win32') {
      expect(res.warnings.join(' ')).toMatch(/chmod 600/);
    }
    fs.writeFileSync(file, '{not json');
    expect(resolveTarget({ flags: {}, env: { RE_SHELL_CONTROL_PLANE_CONFIG: file } })).toMatchObject({ ok: false, message: expect.stringMatching(/not valid JSON/) });
    fs.writeFileSync(file, JSON.stringify({ url: 5 }));
    expect(resolveTarget({ flags: {}, env: { RE_SHELL_CONTROL_PLANE_CONFIG: file } })).toMatchObject({ ok: false });
  });

  it('validates URLs and warns about cleartext to a remote host', () => {
    expect(normalizeUrl('https://cp.example.com/')).toEqual({ url: 'https://cp.example.com' });
    expect(normalizeUrl('http://127.0.0.1:8787')).toEqual({ url: 'http://127.0.0.1:8787' });
    expect(normalizeUrl('http://localhost:1')).toEqual({ url: 'http://localhost:1' });
    expect(normalizeUrl('http://cp.example.com')).toMatchObject({ warning: expect.stringMatching(/cleartext/) });
    expect(normalizeUrl('ftp://x')).toMatchObject({ error: expect.stringMatching(/http/) });
    expect(normalizeUrl('https://user:pw@x.example')).toMatchObject({ error: expect.stringMatching(/credentials/) });
    expect(normalizeUrl('nope')).toMatchObject({ error: expect.stringMatching(/valid URL/) });
    expect(normalizeUrl('https://x.example/base/')).toEqual({ url: 'https://x.example/base' });
  });

  it('locates the config file', () => {
    expect(configFilePath({ RE_SHELL_CONTROL_PLANE_CONFIG: '/a/b.json' }, '/home/u')).toBe('/a/b.json');
    expect(configFilePath({ RE_SHELL_CONFIG_DIR: '/cfg' }, '/home/u')).toBe(path.join('/cfg', 'control-plane.json'));
    expect(configFilePath({}, '/home/u')).toBe(path.join('/home/u', '.re-shell', 'control-plane.json'));
  });
});

describe('--param parsing', () => {
  it('collects key=value pairs and JSON params', () => {
    expect(parseParams(['language=typescript', 'framework=a=b'], undefined)).toEqual({
      ok: true,
      params: { language: 'typescript', framework: 'a=b' },
    });
    expect(parseParams(['type=all'], '{"cwd":"/x"}')).toEqual({ ok: true, params: { cwd: '/x', type: 'all' } });
    expect(parseParams(undefined, undefined)).toEqual({ ok: true, params: {} });
  });

  it('rejects malformed input and prototype-polluting keys', () => {
    expect(parseParams(['novalue'], undefined)).toMatchObject({ ok: false });
    expect(parseParams(['=x'], undefined)).toMatchObject({ ok: false });
    expect(parseParams([], '[1]')).toMatchObject({ ok: false });
    expect(parseParams([], '{bad')).toMatchObject({ ok: false });
    expect(parseParams(['__proto__=x'], undefined)).toMatchObject({ ok: false });
    expect(parseParams(['constructor=x'], undefined)).toMatchObject({ ok: false });
  });
});

describe('rendering', () => {
  const snapshot = {
    seq: 9,
    session: {
      id: 's-1',
      tenantId: 'acme',
      workspaceId: 'demo',
      title: 'Pairing',
      ownerId: 'alice',
      driverId: 'bob',
      status: 'active',
      createdAt: Date.now() - 120_000,
      endedAt: null,
    },
    participants: [
      { userId: 'alice', role: 'viewer', joinedAt: 1 },
      { userId: 'bob', role: 'driver', joinedAt: 2 },
    ],
    runs: [
      {
        jobId: 'j1',
        commandId: 'workspace.summary',
        params: {},
        requestedBy: 'bob',
        status: 'failed',
        exitCode: 1,
        errorCode: null,
        queuedAt: 1,
        startedAt: 2,
        finishedAt: 3,
        output: [{ seq: 1, stream: 'stdout', data: 'line one\n\u001b[31mred\u001b[0m\n' }],
      },
    ],
    currentJobId: null,
    docs: [{ id: 'notes', title: 'Notes', kind: 'notes', rev: 4, content: 'abc' }],
    online: ['bob'],
    rtc: { iceServers: [] },
  } as unknown as Parameters<typeof renderSnapshot>[0];

  it('renders participants, console output (sanitized) and documents', () => {
    const text = renderSnapshot(snapshot);
    expect(text).toContain('Session s-1 [active]  Pairing');
    expect(text).toContain('driver bob');
    expect(text).toMatch(/bob\s+driver\s+online/);
    expect(text).toMatch(/alice\s+viewer/);
    expect(text).toContain('#1 workspace.summary by bob: failed (exit 1)');
    expect(text).toContain('    line one');
    expect(text).toContain('    red');
    expect(text).not.toContain('\u001b');
    expect(text).toContain('notes  (notes, rev 4, 3 chars)');
  });

  it('renders live events as short lines', () => {
    const e = (type: string, data: Record<string, unknown>) => ({ seq: 1, ts: 0, actor: 'x', type, data }) as never;
    expect(renderEvent(e('participant.joined', { userId: 'bob' }))).toBe('* bob joined');
    expect(renderEvent(e('control.handover', { from: 'a', to: 'b', by: 'a' }))).toBe('* b is now driving (was a)');
    expect(renderEvent(e('command.queued', { jobId: 'j', commandId: 'doctor', params: {}, requestedBy: 'a' }))).toBe('$ doctor  (by a)');
    expect(renderEvent(e('command.output', { jobId: 'j', chunkSeq: 1, stream: 'stdout', data: 'hi\u001b[2J' }))).toBe('hi');
    expect(renderEvent(e('command.finished', { jobId: 'j', status: 'failed', exitCode: 2, errorCode: null }))).toBe('-- failed (exit 2)');
    expect(renderEvent(e('command.started', { jobId: 'j' }))).toBeNull();
    expect(renderEvent(e('doc.op', { docId: 'notes' }))).toBeNull();
  });

  it('sanitizes hostile output', () => {
    expect(sanitizeForTerminal('a\u001b[1Ab\u001b]8;;http://x\u0007link\u001b]8;;\u0007c')).toBe('ablinkc');
  });
});
