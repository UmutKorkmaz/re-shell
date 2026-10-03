import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  childEnvironment,
  containCwd,
  resolveCliInvocation,
  resolveWorkspaceDir,
} from './containment.js';

let root: string;
let outside: string;

beforeEach(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-contain-'));
  root = path.join(base, 'root');
  outside = path.join(base, 'outside');
  fs.mkdirSync(path.join(root, 'ws', 'apps', 'web'), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  fs.writeFileSync(path.join(root, 'plain-file'), 'not a dir');
  fs.symlinkSync(outside, path.join(root, 'link-out'));
  fs.symlinkSync(outside, path.join(root, 'ws', 'escape'));
});
afterEach(() => {
  fs.rmSync(path.dirname(root), { recursive: true, force: true });
});

describe('resolveWorkspaceDir', () => {
  it('maps a workspace id to a real directory inside the root', () => {
    const r = resolveWorkspaceDir(root, 'ws');
    expect(r).toEqual({ ok: true, dir: fs.realpathSync(path.join(root, 'ws')) });
  });

  it('refuses dot segments, separators, NUL and empty ids', () => {
    for (const id of ['', '.', '..', '../outside', 'ws/apps', 'a\\b', 'ws\0x']) {
      expect(resolveWorkspaceDir(root, id).ok, JSON.stringify(id)).toBe(false);
    }
  });

  it('refuses a missing workspace, a file, and a symlink that leaves the root', () => {
    expect(resolveWorkspaceDir(root, 'nope')).toMatchObject({ ok: false });
    expect(resolveWorkspaceDir(root, 'plain-file')).toMatchObject({ ok: false });
    const viaLink = resolveWorkspaceDir(root, 'link-out');
    expect(viaLink).toMatchObject({ ok: false });
    expect((viaLink as { reason: string }).reason).toMatch(/outside/);
  });
});

describe('containCwd', () => {
  const ws = () => fs.realpathSync(path.join(root, 'ws'));

  it('defaults to the workspace directory itself', () => {
    expect(containCwd(undefined, path.join(root, 'ws'))).toBe(ws());
  });

  it('allows relative and absolute paths inside the workspace', () => {
    expect(containCwd('apps/web', path.join(root, 'ws'))).toBe(path.join(ws(), 'apps', 'web'));
    expect(containCwd(path.join(ws(), 'apps'), path.join(root, 'ws'))).toBe(path.join(ws(), 'apps'));
    expect(containCwd('apps/../apps/web', path.join(root, 'ws'))).toBe(path.join(ws(), 'apps', 'web'));
  });

  it('rejects traversal, absolute escapes and symlink escapes', () => {
    const base = path.join(root, 'ws');
    expect(containCwd('..', base)).toBeNull();
    expect(containCwd('../../outside', base)).toBeNull();
    expect(containCwd(outside, base)).toBeNull();
    expect(containCwd('/', base)).toBeNull();
    expect(containCwd('escape', base)).toBeNull();
    expect(containCwd('escape/secret.txt', base)).toBeNull();
    expect(containCwd('apps/../../root-sibling', base)).toBeNull();
  });
});

describe('resolveCliInvocation', () => {
  it('runs a JS entry under the current Node and a bare name directly', () => {
    expect(resolveCliInvocation('/opt/re-shell/dist/index.js')).toEqual([process.execPath, '/opt/re-shell/dist/index.js']);
    expect(resolveCliInvocation('dist/cli.mjs')).toEqual([process.execPath, 'dist/cli.mjs']);
    expect(resolveCliInvocation('re-shell')).toEqual(['re-shell']);
  });
});

describe('childEnvironment', () => {
  it('passes a small allow-list and never the control-plane credentials', () => {
    const env = childEnvironment({
      PATH: '/usr/bin',
      HOME: '/home/x',
      CONTROL_PLANE_WORKER_TOKEN: 'secret-token',
      CONTROL_PLANE_JWT_KEYS: '{"k":"s"}',
      AWS_SECRET_ACCESS_KEY: 'nope',
      NODE_OPTIONS: '--require /tmp/evil.js',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/x');
    expect(env.NO_COLOR).toBe('1');
    expect(Object.keys(env).some((k) => k.startsWith('CONTROL_PLANE'))).toBe(false);
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.NODE_OPTIONS).toBeUndefined();
  });
});
