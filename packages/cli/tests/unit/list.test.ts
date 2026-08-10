import { describe, it, expect, beforeEach, vi } from 'vitest';

// list.ts reads the filesystem relative to process.cwd() and resolves the apps
// dir via path.resolve(process.cwd(), 'apps'). vitest workers ban process.chdir,
// so instead of a real temp workspace we drive a virtual filesystem mock keyed
// by absolute paths under a fake project root, and spy process.cwd to return it.

const ROOT = '/mock-project';

const { vfs } = vi.hoisted(() => ({
  vfs: { dirs: new Set<string>(), files: new Map<string, string>() },
}));

vi.mock('fs-extra', () => ({
  existsSync: (p: string) => {
    const full = p.startsWith('/') ? p : `${ROOT}/${p}`;
    return vfs.dirs.has(full) || vfs.files.has(full);
  },
  readdirSync: (dir: string) => {
    const prefix = dir.endsWith('/') ? dir : dir + '/';
    const children = new Set<string>();
    for (const k of [...vfs.dirs, ...vfs.files.keys()]) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      if (rest && !rest.includes('/')) children.add(rest);
    }
    return [...children].map(name => ({
      name,
      isDirectory: () => vfs.dirs.has(prefix + name),
      isFile: () => vfs.files.has(prefix + name),
    }));
  },
  readFileSync: (p: string) => vfs.files.get(p) ?? '',
}));

vi.mock('../../src/utils/json-output', () => ({
  jsonSuccess: vi.fn(),
  jsonError: vi.fn(),
  enableJsonMode: vi.fn(() => () => {}),
}));

import { listMicrofrontends } from '../../src/commands/list';
import { jsonSuccess, jsonError } from '../../src/utils/json-output';

const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(ROOT);

beforeEach(() => {
  vfs.dirs.clear();
  vfs.files.clear();
  vi.clearAllMocks();
  cwdSpy.mockReturnValue(ROOT);
});

/** Mark the mock root as a Re-Shell project (package.json present). */
function makeRoot(): void {
  vfs.dirs.add(ROOT);
  vfs.files.set(`${ROOT}/package.json`, '{}');
  vfs.dirs.add(`${ROOT}/apps`);
}

/** Add an app under apps/ with an optional package.json payload. */
function addApp(name: string, pkg: Record<string, unknown> | null): void {
  const appDir = `${ROOT}/apps/${name}`;
  vfs.dirs.add(appDir);
  if (pkg !== null) {
    vfs.files.set(`${appDir}/package.json`, JSON.stringify(pkg));
  }
}

describe('listMicrofrontends — project detection', () => {
  it('throws when run outside a Re-Shell project (no package.json)', async () => {
    vfs.dirs.add(ROOT); // exists but no package.json, no apps/packages
    await expect(listMicrofrontends()).rejects.toThrow('Not in a Re-Shell project');
  });

  it('emits a JSON error instead of throwing in json mode', async () => {
    vfs.dirs.add(ROOT);
    await listMicrofrontends({ json: true });
    expect(jsonError).toHaveBeenCalledWith(
      'NOT_IN_RESHELL_PROJECT',
      expect.stringContaining('Not in a Re-Shell project'),
    );
  });

  it('throws "Apps directory not found" when the project has packages/ but no apps/', async () => {
    vfs.dirs.add(ROOT);
    vfs.files.set(`${ROOT}/package.json`, '{}');
    vfs.dirs.add(`${ROOT}/packages`); // recognized as a project, but no apps/
    await expect(listMicrofrontends()).rejects.toThrow('Apps directory not found');
  });
});

describe('listMicrofrontends — listing', () => {
  it('reports no microfrontends when apps/ is empty', async () => {
    makeRoot();
    await listMicrofrontends();
    expect(log.mock.calls.some(c => String(c[0]).includes('No microfrontends found'))).toBe(true);
  });

  it('excludes the shell application from the listing', async () => {
    makeRoot();
    addApp('shell', { name: 'shell', version: '1.0.0' });
    addApp('dashboard', { name: 'dashboard', version: '2.0.0' });
    await listMicrofrontends();
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('dashboard');
    expect(output).not.toMatch(/- shell\b/);
  });

  it('lists an app with version, team, and default route derived from package.json', async () => {
    makeRoot();
    addApp('dashboard', { name: 'dashboard', version: '2.1.3', author: 'platform-team' });
    await listMicrofrontends();
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('- dashboard');
    expect(output).toContain('Version: 2.1.3');
    expect(output).toContain('Team: platform-team');
    expect(output).toContain('Route: /dashboard');
  });

  it('uses the reshell.route override when present', async () => {
    makeRoot();
    addApp('dashboard', { name: 'dashboard', reshell: { route: '/home' } });
    await listMicrofrontends();
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Route: /home');
  });

  it('includes an app even when its package.json is missing', async () => {
    makeRoot();
    addApp('bare', null);
    await listMicrofrontends();
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('- bare');
    expect(output).toContain('Found 1 microfrontends');
  });

  it('skips an app whose package.json is malformed and logs an error', async () => {
    makeRoot();
    addApp('broken', null);
    vfs.files.set(`${ROOT}/apps/broken/package.json`, '{ not valid json');
    await listMicrofrontends();
    expect(err).toHaveBeenCalled();
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Found 0 microfrontends');
  });
});

describe('listMicrofrontends — JSON output', () => {
  it('emits a jsonSuccess envelope with the collected microfrontends', async () => {
    makeRoot();
    addApp('dashboard', { name: 'dashboard', version: '2.0.0', reshell: { route: '/d' } });
    await listMicrofrontends({ json: true });
    expect(jsonSuccess).toHaveBeenCalledTimes(1);
    const [payload] = vi.mocked(jsonSuccess).mock.calls[0];
    expect(payload.microfrontends).toHaveLength(1);
    expect(payload.microfrontends[0]).toMatchObject({
      name: 'dashboard',
      version: '2.0.0',
      route: '/d',
    });
    expect(payload.microfrontends[0].path).toContain('apps/dashboard');
  });

  it('emits a jsonSuccess with an empty array when no apps are found', async () => {
    makeRoot();
    await listMicrofrontends({ json: true });
    expect(jsonSuccess).toHaveBeenCalledWith([], expect.any(Array));
  });
});
