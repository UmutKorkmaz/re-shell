import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main, parseArgs, type CliIo } from './cli.js';
import { loadKeyRing, loadServeConfig, loadWorkerToken, reloadKeyRing } from './config.js';
import { migrate, LATEST_SCHEMA_VERSION } from './db/migrations.js';
import { SqliteTenantStore } from './db/sqlite-store.js';
import { openDatabase } from './db/sqlite.js';
import { JwtSessionResolver, WorkerTokenVerifier } from './identity.js';
import { JwtKeyRing, generateSecret } from './jwt.js';
import { authenticate } from './auth.js';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-cli-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function io(env: Record<string, string | undefined> = {}): CliIo & { out: string; err: string } {
  const handle = {
    out: '',
    err: '',
    env,
    stdout: (t: string) => {
      handle.out += t;
    },
    stderr: (t: string) => {
      handle.err += t;
    },
  };
  return handle;
}

const SECRET = generateSecret();
const KEYS = JSON.stringify({ activeKid: 'k1', keys: { k1: SECRET } });

describe('parseArgs', () => {
  it('parses commands, valued flags, =-style flags and boolean flags', () => {
    const p = parseArgs(['issue-token', '--user', 'alice', '--ttl=60', '--raw', '--worker']);
    expect(p.command).toBe('issue-token');
    expect(p.flags.get('user')).toBe('alice');
    expect(p.flags.get('ttl')).toBe('60');
    expect(p.flags.get('raw')).toBe(true);
    expect(p.flags.get('worker')).toBe(true);
  });
});

describe('gen-key', () => {
  it('prints a key file that loadKeyRing accepts, as a JSON envelope or raw', async () => {
    const a = io();
    expect(await main(['gen-key', '--kid', 'prod-1'], a)).toBe(0);
    const env = JSON.parse(a.out);
    expect(env).toMatchObject({ ok: true, data: { keyFile: { activeKid: 'prod-1' } } });

    const b = io();
    expect(await main(['gen-key', '--raw'], b)).toBe(0);
    const keyFile = path.join(tmp, 'keys.json');
    fs.writeFileSync(keyFile, b.out);
    const ring = loadKeyRing({ CONTROL_PLANE_JWT_KEYS_FILE: keyFile });
    expect(ring.ok).toBe(true);
  });

  it('rejects an invalid key id', async () => {
    const a = io();
    expect(await main(['gen-key', '--kid', 'bad kid!'], a)).toBe(1);
    expect(JSON.parse(a.out)).toMatchObject({ ok: false, error: { code: 'CONFIG_ERROR' } });
  });
});

describe('issue-token', () => {
  it('issues a verifiable user token and never prints the signing key', async () => {
    const a = io({ CONTROL_PLANE_JWT_KEYS: KEYS });
    expect(await main(['issue-token', '--user', 'alice', '--ttl', '600'], a)).toBe(0);
    const out = JSON.parse(a.out);
    expect(out.ok).toBe(true);
    expect(out.data).toMatchObject({ kind: 'user', userId: 'alice', kid: 'k1' });
    expect(a.out + a.err).not.toContain(SECRET);

    const ring = new JwtKeyRing({ k1: SECRET }, 'k1');
    const store = SqliteTenantStore.fromSnapshot(
      (() => {
        const db = openDatabase(':memory:');
        migrate(db);
        return db;
      })(),
      {}
    );
    const resolver = new JwtSessionResolver({ keyRing: ring }, store);
    expect(authenticate(resolver, out.data.token)).toMatchObject({ ok: true, data: { userId: 'alice' } });
  });

  it('--raw prints only the token', async () => {
    const a = io({ CONTROL_PLANE_JWT_KEYS: KEYS });
    expect(await main(['issue-token', '--user', 'alice', '--raw'], a)).toBe(0);
    expect(a.out.trim().split('.')).toHaveLength(3);
    expect(a.out.trim()).not.toContain('{');
  });

  it('bootstraps the first tenant admin in the database, idempotently', async () => {
    const dbPath = path.join(tmp, 'cp.db');
    const env = { CONTROL_PLANE_JWT_KEYS: KEYS, CONTROL_PLANE_DB: dbPath };
    const first = io(env);
    expect(await main(['issue-token', '--user', 'alice', '--tenant', 'acme', '--role', 'admin'], first)).toBe(0);
    expect(JSON.parse(first.out).data.bootstrap).toEqual({ tenantId: 'acme', tenantCreated: true, role: 'admin' });

    const second = io(env);
    expect(await main(['issue-token', '--user', 'alice', '--tenant', 'acme', '--role', 'admin'], second)).toBe(0);
    expect(JSON.parse(second.out).data.bootstrap.tenantCreated).toBe(false);

    const db = openDatabase(dbPath);
    const store = new SqliteTenantStore(db);
    expect(store.getMemberships('alice')).toEqual({ acme: 'admin' });
    expect(store.getTenant('acme')?.name).toBe('acme');
    db.close();
  });

  it('issues a worker token bound to one tenant', async () => {
    const a = io({ CONTROL_PLANE_JWT_KEYS: KEYS });
    expect(await main(['issue-token', '--worker', '--worker-id', 'w1', '--tenant', 'acme'], a)).toBe(0);
    const out = JSON.parse(a.out);
    const verifier = new WorkerTokenVerifier({ keyRing: new JwtKeyRing({ k1: SECRET }, 'k1') });
    expect(verifier.verify(out.data.token)).toMatchObject({ workerId: 'w1', tenantId: 'acme' });
  });

  it('fails with ok:false and a non-zero exit when keys are missing or ambiguous', async () => {
    const none = io({});
    expect(await main(['issue-token', '--user', 'alice'], none)).toBe(1);
    expect(JSON.parse(none.out)).toMatchObject({ ok: false, error: { code: 'CONFIG_ERROR' } });

    const keyFile = path.join(tmp, 'k.json');
    fs.writeFileSync(keyFile, KEYS);
    const both = io({ CONTROL_PLANE_JWT_KEYS: KEYS, CONTROL_PLANE_JWT_KEYS_FILE: keyFile });
    expect(await main(['issue-token', '--user', 'alice'], both)).toBe(1);
    expect(JSON.parse(both.out).error.message).toMatch(/only one/);
  });

  it('rejects secrets on the command line, bad arguments and weak keys', async () => {
    const env = { CONTROL_PLANE_JWT_KEYS: KEYS };
    for (const args of [
      ['issue-token', '--user', 'alice', '--token', 'abc'],
      ['issue-token'],
      ['issue-token', '--user', 'alice', '--ttl', 'soon'],
      ['issue-token', '--user', 'alice', '--ttl', '99999999999'],
      ['issue-token', '--user', 'alice', '--role', 'admin'],
      ['issue-token', '--user', 'alice', '--tenant', 'acme', '--role', 'root'],
      ['issue-token', '--worker', '--tenant', 'acme'],
      ['issue-token', '--worker', '--worker-id', '..', '--tenant', 'acme'],
    ]) {
      const a = io(env);
      expect(await main(args, a), args.join(' ')).toBe(1);
      expect(JSON.parse(a.out).ok).toBe(false);
    }
    const weak = io({ CONTROL_PLANE_JWT_KEYS: JSON.stringify({ keys: { k1: 'c2hvcnQ' } }) });
    expect(await main(['issue-token', '--user', 'alice'], weak)).toBe(1);
    expect(JSON.parse(weak.out).error.message).toMatch(/too short/);
  });
});

describe('other commands', () => {
  it('prints usage and exits 2 without a command, 2 for an unknown one', async () => {
    const none = io();
    expect(await main([], none)).toBe(2);
    expect(none.out).toContain('Usage: re-shell-control-plane');
    const unknown = io();
    expect(await main(['explode'], unknown)).toBe(2);
    expect(JSON.parse(unknown.out.split('\n')[0])).toMatchObject({ ok: false });
    const help = io();
    expect(await main(['help'], help)).toBe(0);
  });

  it('migrate creates the database at the latest schema version', async () => {
    const dbPath = path.join(tmp, 'm.db');
    const a = io({ CONTROL_PLANE_DB: dbPath });
    expect(await main(['migrate'], a)).toBe(0);
    expect(JSON.parse(a.out).data).toMatchObject({ version: LATEST_SCHEMA_VERSION, dbPath });
    const again = io({ CONTROL_PLANE_DB: dbPath });
    expect(await main(['migrate'], again)).toBe(0);
    expect(JSON.parse(again.out).data.applied).toEqual([]);
  });

  it('serve refuses to start without signing keys', async () => {
    const a = io({ CONTROL_PLANE_DB: path.join(tmp, 's.db') });
    expect(await main(['serve'], a)).toBe(1);
    expect(JSON.parse(a.out)).toMatchObject({ ok: false, error: { code: 'CONFIG_ERROR' } });
  });

  it('worker validates its configuration and refuses secrets as flags', async () => {
    const root = path.join(tmp, 'ws');
    fs.mkdirSync(root);
    const tokenFile = path.join(tmp, 'tok');
    fs.writeFileSync(tokenFile, 'abc.def.ghi\n');
    const base = ['worker', '--tenant', 'acme', '--workspace-root', root, '--url', 'http://127.0.0.1:1'];
    const cases: Array<[string[], Record<string, string>]> = [
      [['worker', '--workspace-root', root, '--url', 'http://x', '--token-file', tokenFile], {}], // no tenant
      [['worker', '--tenant', 'acme', '--workspace-root', path.join(tmp, 'missing'), '--url', 'http://x', '--token-file', tokenFile], {}],
      [['worker', '--tenant', 'acme', '--workspace-root', root, '--url', 'ftp://x', '--token-file', tokenFile], {}],
      [base, {}], // no token
      [[...base, '--token', 'abc'], {}],
      [[...base, '--token-file', path.join(tmp, 'nope')], {}],
      [[...base, '--token-file', tokenFile, '--concurrency', '0'], {}],
    ];
    for (const [args, env] of cases) {
      const a = io(env);
      expect(await main(args, a), args.join(' ')).toBe(1);
      expect(JSON.parse(a.out).ok).toBe(false);
    }
  });
});

describe('configuration loading', () => {
  it('applies defaults and reads tuning from the environment', () => {
    const r = loadServeConfig({ CONTROL_PLANE_JWT_KEYS: KEYS });
    expect(r).toMatchObject({ ok: true, data: { host: '127.0.0.1', port: 8787, trustProxy: false, hsts: false, corsOrigins: [] } });
    const tuned = loadServeConfig({
      CONTROL_PLANE_JWT_KEYS: KEYS,
      CONTROL_PLANE_HOST: '0.0.0.0',
      CONTROL_PLANE_PORT: '9000',
      CONTROL_PLANE_PLATFORM_ADMINS: 'root, ops ',
      CONTROL_PLANE_TRUST_PROXY: '1',
      CONTROL_PLANE_HSTS: 'true',
      CONTROL_PLANE_RATE_LIMIT_PER_MINUTE: '30',
      CONTROL_PLANE_MAX_QUEUED_PER_TENANT: '7',
      CONTROL_PLANE_LEASE_MS: '5000',
      CONTROL_PLANE_BODY_LIMIT_BYTES: '4096',
    });
    expect(tuned).toMatchObject({
      ok: true,
      data: {
        host: '0.0.0.0',
        port: 9000,
        platformAdmins: ['root', 'ops'],
        trustProxy: true,
        hsts: true,
        limits: { userPerMinute: 30, maxQueuedPerTenant: 7, leaseMs: 5000, bodyBytes: 4096 },
      },
    });
  });

  it('rejects wildcard or malformed CORS origins and out-of-range numbers', () => {
    const base = { CONTROL_PLANE_JWT_KEYS: KEYS };
    for (const origin of ['*', 'dash.example.com', 'https://dash.example.com/', 'https://a.com/path', 'javascript:alert(1)']) {
      const r = loadServeConfig({ ...base, CONTROL_PLANE_CORS_ORIGINS: origin });
      expect(r.ok, origin).toBe(false);
    }
    expect(loadServeConfig({ ...base, CONTROL_PLANE_CORS_ORIGINS: 'https://dash.example.com,http://localhost:5173' }).ok).toBe(true);
    for (const [name, value] of [['CONTROL_PLANE_PORT', '70000'], ['CONTROL_PLANE_PORT', 'abc'], ['CONTROL_PLANE_LEASE_MS', '5'], ['CONTROL_PLANE_BODY_LIMIT_BYTES', '-1']]) {
      expect(loadServeConfig({ ...base, [name]: value }).ok, `${name}=${value}`).toBe(false);
    }
  });

  it('reads keys from a file, honours the active-kid override, and rejects malformed key config', () => {
    const file = path.join(tmp, 'keys.json');
    fs.writeFileSync(file, JSON.stringify({ keys: { a: generateSecret(), b: generateSecret() } }));
    expect(loadKeyRing({ CONTROL_PLANE_JWT_KEYS_FILE: file }).ok).toBe(false); // two keys, no active one
    const ok = loadKeyRing({ CONTROL_PLANE_JWT_KEYS_FILE: file, CONTROL_PLANE_JWT_ACTIVE_KID: 'b' });
    expect(ok).toMatchObject({ ok: true });
    if (ok.ok) expect(ok.data.activeKid).toBe('b');
    expect(loadKeyRing({ CONTROL_PLANE_JWT_KEYS_FILE: path.join(tmp, 'missing.json') }).ok).toBe(false);
    expect(loadKeyRing({ CONTROL_PLANE_JWT_KEYS: 'not json' }).ok).toBe(false);
    expect(loadKeyRing({ CONTROL_PLANE_JWT_KEYS: '{"keys":{"a":"x"},"extra":1}' }).ok).toBe(false);
  });

  it('reloads rotated keys in place and keeps the old ones when the new config is bad', () => {
    const file = path.join(tmp, 'rot.json');
    const s1 = generateSecret();
    const s2 = generateSecret();
    fs.writeFileSync(file, JSON.stringify({ activeKid: 'k1', keys: { k1: s1 } }));
    const loaded = loadKeyRing({ CONTROL_PLANE_JWT_KEYS_FILE: file });
    if (!loaded.ok) throw new Error('precondition');
    const ring = loaded.data;
    expect(ring.kids).toEqual(['k1']);

    fs.writeFileSync(file, JSON.stringify({ activeKid: 'k2', keys: { k1: s1, k2: s2 } }));
    expect(reloadKeyRing(ring, { CONTROL_PLANE_JWT_KEYS_FILE: file })).toMatchObject({ ok: true });
    expect(ring.activeKid).toBe('k2');
    expect(ring.kids.sort()).toEqual(['k1', 'k2']);

    fs.writeFileSync(file, '{ broken');
    expect(reloadKeyRing(ring, { CONTROL_PLANE_JWT_KEYS_FILE: file }).ok).toBe(false);
    expect(ring.activeKid).toBe('k2');
    expect(ring.kids.sort()).toEqual(['k1', 'k2']);
  });

  it('loads worker tokens from a file or the environment, never both', () => {
    const file = path.join(tmp, 'tok');
    fs.writeFileSync(file, '  a.b.c \n');
    expect(loadWorkerToken({ CONTROL_PLANE_WORKER_TOKEN_FILE: file })).toMatchObject({ ok: true, data: 'a.b.c' });
    expect(loadWorkerToken({ CONTROL_PLANE_WORKER_TOKEN: 'x.y.z' })).toMatchObject({ ok: true, data: 'x.y.z' });
    expect(loadWorkerToken({ CONTROL_PLANE_WORKER_TOKEN: 'x.y.z', CONTROL_PLANE_WORKER_TOKEN_FILE: file }).ok).toBe(false);
    expect(loadWorkerToken({}).ok).toBe(false);
    fs.writeFileSync(file, '\n');
    expect(loadWorkerToken({ CONTROL_PLANE_WORKER_TOKEN_FILE: file }).ok).toBe(false);
  });
});
