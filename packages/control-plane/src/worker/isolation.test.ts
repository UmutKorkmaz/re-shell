import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadWorkerIsolation } from './config.js';
import { acquireOwnerLock, containerArgs, ownerLabel, validateIsolation, type DockerIsolation } from './isolation.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const config: DockerIsolation = { mode: 'docker', host: 'unix:///dedicated/docker.sock', image: `sha256:${'a'.repeat(64)}`, workerId: 'staging-1', cpus: 1, memoryMb: 512, pids: 128, uid: 1000, gid: 1000 };
function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'isolation-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'main', 'nested'), { recursive: true });
  return root;
}

describe('isolated worker configuration', () => {
  it('serializes owner recovery and never releases a different lock generation', () => {
    const root = workspace();
    const owner = ownerLabel(config, 'acme', root);
    const release = acquireOwnerLock(root, owner);
    expect(() => acquireOwnerLock(root, owner)).toThrow('already active');
    const lock = path.join(root, '.re-shell-workers', `${owner}.lock`);
    fs.writeFileSync(path.join(lock, 'generation'), 'replacement');
    release();
    expect(fs.existsSync(lock)).toBe(true);
    fs.rmSync(lock, { recursive: true });
    const guard = path.join(root, '.re-shell-workers', `${owner}.recovery`);
    fs.mkdirSync(guard);
    expect(() => acquireOwnerLock(root, owner)).toThrow('operator recovery');
  });
  it('requires explicit operator mode and refuses partial/invalid isolated settings', () => {
    expect(() => loadWorkerIsolation({})).toThrow('Choose');
    expect(loadWorkerIsolation({ CONTROL_PLANE_WORKER_MODE: 'process' })).toEqual({ mode: 'process' });
    expect(() => loadWorkerIsolation({ CONTROL_PLANE_WORKER_MODE: 'docker' })).toThrow();
    for (const host of ['tcp://127.0.0.1:2375', 'ssh://root@host', '', 'unix:///tmp/d.sock\n']) expect(() => validateIsolation({ ...config, host })).toThrow();
    for (const image of ['node:latest', '-v', 'image@sha256:short']) expect(() => validateIsolation({ ...config, image })).toThrow();
    for (const cpus of [0, -1, NaN, Infinity]) expect(() => validateIsolation({ ...config, cpus })).toThrow();
    for (const uid of [0, -1, 1.2]) expect(() => validateIsolation({ ...config, uid })).toThrow();
    expect(() => validateIsolation({ ...config, pids: 0 })).toThrow();
    expect(() => validateIsolation({ ...config, memoryMb: 0 })).toThrow();
    expect(() => validateIsolation({ ...config, workerId: '../other' })).toThrow();
  });
  it('creates a fixed defensive argv, exact realpath mount, literal params and private environment', () => {
    const root = workspace();
    const main = path.join(root, 'main');
    const args = containerArgs(config, 'owner', 'container', main, path.join(main, 'nested'), ['templates', 'show', '$(id);--privileged']);
    expect(args).toContain('--network=none');
    expect(args).toContain('--read-only');
    expect(args).toContain('--cap-drop=ALL');
    expect(args).toContain('--security-opt=no-new-privileges:true');
    expect(args).toContain('--pull=never');
    expect(args).toContain('--log-driver=none');
    expect(args[args.indexOf('--entrypoint') + 1]).toBe('/usr/bin/env');
    expect(args[args.indexOf(config.image) + 1]).toBe('-i');
    expect(args).toContain(`type=bind,src=${fs.realpathSync(main)},dst=/workspace,bind-propagation=rprivate,bind-recursive=disabled`);
    expect(args.filter((value) => value.startsWith('type=bind'))).toHaveLength(1);
    expect(args[args.indexOf('--workdir') + 1]).toBe('/workspace/nested');
    expect(args[args.indexOf('--user') + 1]).toBe('1000:1000');
    expect(args[args.indexOf('--memory') + 1]).toBe('512m');
    expect(args[args.indexOf('--memory-swap') + 1]).toBe('512m');
    expect(args[args.indexOf('--pids-limit') + 1]).toBe('128');
    expect(args.slice(-3)).toEqual(['templates', 'show', '$(id);--privileged']);
    expect(args.some((arg) => arg.includes('CONTROL_PLANE') || arg.includes('docker.sock'))).toBe(false);
  });
  it('refuses outside symlink cwd and mount parser injection', () => {
    const root = workspace();
    fs.symlinkSync(root, path.join(root, 'main', 'outside'));
    expect(() => containerArgs(config, 'o', 'c', path.join(root, 'main'), path.join(root, 'main', 'outside'), [])).toThrow('escapes');
    const malicious = path.join(root, 'path,dst=/etc');
    expect(() => containerArgs(config, 'o', 'c', malicious, malicious, [])).toThrow('safely');
    expect(() => containerArgs(config, 'o', 'c', path.join(root, 'main'), path.join(root, 'missing'), [])).toThrow();
  });
  it('scopes recovery ownership to worker, tenant and real workspace root', () => {
    const root = workspace();
    const owner = ownerLabel(config, 'acme', root);
    expect(owner).toMatch(/^[a-f0-9]{64}$/);
    expect(ownerLabel(config, 'other', root)).not.toBe(owner);
    expect(ownerLabel({ ...config, workerId: 'another' }, 'acme', root)).not.toBe(owner);
    expect(ownerLabel(config, 'acme', path.join(root, 'main'))).not.toBe(owner);
  });
});
