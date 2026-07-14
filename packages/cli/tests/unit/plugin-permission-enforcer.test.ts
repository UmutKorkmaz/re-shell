import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  PermissionEnforcer,
  PermissionDeniedError,
  wrapPluginUtils,
} from '../../src/utils/plugin-permission-enforcer';
import type { PluginPermission, PluginUtils } from '../../src/utils/plugin-system';
import * as realFs from 'fs-extra';
import * as realPath from 'path';
import chalk from 'chalk';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-enforcer-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const fsReadPerm: PluginPermission = {
  type: 'filesystem',
  access: 'read',
  description: 'Read workspace files',
};

const fsWritePerm: PluginPermission = {
  type: 'filesystem',
  access: 'write',
  resource: '/tmp/allowed',
  description: 'Write to allowed dir',
};

const processExecPerm: PluginPermission = {
  type: 'process',
  access: 'execute',
  description: 'Execute system commands',
};

describe('PermissionEnforcer', () => {
  describe('checkFileSystem', () => {
    it('should allow read when filesystem:read permission exists', () => {
      const enforcer = new PermissionEnforcer('test-plugin', [fsReadPerm]);
      expect(() => enforcer.checkFileSystem('read', '/any/path')).not.toThrow();
    });

    it('should deny read when no filesystem permission', () => {
      const enforcer = new PermissionEnforcer('test-plugin', []);
      expect(() => enforcer.checkFileSystem('read', '/any/path')).toThrow(PermissionDeniedError);
    });

    it('should allow write when resource is under declared path', () => {
      const enforcer = new PermissionEnforcer('test-plugin', [fsWritePerm]);
      expect(() => enforcer.checkFileSystem('write', '/tmp/allowed/file.txt')).not.toThrow();
    });

    it('should deny write when resource is outside declared path', () => {
      const enforcer = new PermissionEnforcer('test-plugin', [fsWritePerm]);
      expect(() => enforcer.checkFileSystem('write', '/etc/passwd')).toThrow(PermissionDeniedError);
    });

    it('should allow write when filesystem:full permission without resource restriction', () => {
      const fullPerm: PluginPermission = { type: 'filesystem', access: 'full', description: 'Full fs' };
      const enforcer = new PermissionEnforcer('test-plugin', [fullPerm]);
      expect(() => enforcer.checkFileSystem('write', '/anywhere')).not.toThrow();
    });

    it('should always allow access to plugin dataPath', () => {
      const dataPath = '/workspace/.re-shell/data/test-plugin';
      const enforcer = new PermissionEnforcer('test-plugin', [], dataPath);
      expect(() => enforcer.checkFileSystem('write', join(dataPath, 'cache.json'))).not.toThrow();
    });

    it('should always allow access to plugin cachePath', () => {
      const cachePath = '/workspace/.re-shell/cache/test-plugin';
      const enforcer = new PermissionEnforcer('test-plugin', [], undefined, cachePath);
      expect(() => enforcer.checkFileSystem('write', join(cachePath, 'tmp.json'))).not.toThrow();
    });
  });

  describe('checkProcess', () => {
    it('should allow exec when process:execute permission exists', () => {
      const enforcer = new PermissionEnforcer('test-plugin', [processExecPerm]);
      expect(() => enforcer.checkProcess('ls -la')).not.toThrow();
    });

    it('should deny exec when no process permission', () => {
      const enforcer = new PermissionEnforcer('test-plugin', []);
      expect(() => enforcer.checkProcess('rm -rf /')).toThrow(PermissionDeniedError);
    });
  });
});

describe('wrapPluginUtils', () => {
  function makeRawUtils(): PluginUtils {
    return {
      path: realPath,
      fs: realFs,
      chalk,
      exec: async () => ({ stdout: '', stderr: '' }),
      spawn: async () => 0,
    };
  }

  it('should allow fs.readFile when filesystem:read is declared', async () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'test.txt');
    writeFileSync(filePath, 'hello');
    const enforcer = new PermissionEnforcer('test', [fsReadPerm]);
    const wrapped = wrapPluginUtils(makeRawUtils(), enforcer);
    const content = await wrapped.fs.readFile(filePath, 'utf8');
    expect(content).toBe('hello');
  });

  it('should deny fs.writeFile when no filesystem:write permission', async () => {
    const dir = makeTempDir();
    const enforcer = new PermissionEnforcer('test', [fsReadPerm]);
    const wrapped = wrapPluginUtils(makeRawUtils(), enforcer);
    await expect(wrapped.fs.writeFile(join(dir, 'out.txt'), 'data')).rejects.toThrow(
      PermissionDeniedError
    );
  });

  it('should allow fs.writeFile under declared resource path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reshell-allowed-'));
    tempDirs.push(dir);
    const writePerm: PluginPermission = {
      type: 'filesystem',
      access: 'write',
      resource: dir,
      description: 'Write to temp',
    };
    const enforcer = new PermissionEnforcer('test', [writePerm]);
    const wrapped = wrapPluginUtils(makeRawUtils(), enforcer);
    await wrapped.fs.writeFile(join(dir, 'out.txt'), 'data');
    expect(readFileSync(join(dir, 'out.txt'), 'utf8')).toBe('data');
  });

  it('should deny exec when no process permission', async () => {
    const enforcer = new PermissionEnforcer('test', []);
    const wrapped = wrapPluginUtils(makeRawUtils(), enforcer);
    await expect(wrapped.exec('ls')).rejects.toThrow(PermissionDeniedError);
  });

  it('should allow exec when process:execute permission exists', async () => {
    const enforcer = new PermissionEnforcer('test', [processExecPerm]);
    const wrapped = wrapPluginUtils(makeRawUtils(), enforcer);
    const result = await wrapped.exec('echo hello');
    expect(result.stdout).toBe('');
  });

  it('should deny spawn when no process permission', async () => {
    const enforcer = new PermissionEnforcer('test', []);
    const wrapped = wrapPluginUtils(makeRawUtils(), enforcer);
    await expect(wrapped.spawn('ls', [])).rejects.toThrow(PermissionDeniedError);
  });

  it('should preserve path and chalk utilities (non-intercepted)', () => {
    const enforcer = new PermissionEnforcer('test', []);
    const wrapped = wrapPluginUtils(makeRawUtils(), enforcer);
    expect(wrapped.path).toBe(realPath);
    expect(wrapped.chalk).toBe(chalk);
  });
});
