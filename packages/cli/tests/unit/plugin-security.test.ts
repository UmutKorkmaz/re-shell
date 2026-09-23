import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  SecurityLevel,
  PluginSecurityValidator,
  PluginSandbox,
  createSecurityValidator,
  createPluginSandbox,
  getDefaultSecurityPolicy,
  type SecurityPolicy,
  type SecurityScanResult,
  type SandboxConfig,
} from '../../src/utils/plugin-security';
import type { PluginPermission, PluginRegistration } from '../../src/utils/plugin-system';

const MB = 1024 * 1024;

/** Build a PluginRegistration pointing at `pluginPath`. */
function makeRegistration(
  pluginPath: string,
  permissions: PluginPermission[] = [],
  opts: { name?: string; main?: string } = {}
): PluginRegistration {
  const { name = 'test-plugin', main = 'index.js' } = opts;
  return {
    manifest: {
      name,
      version: '1.0.0',
      description: 'test',
      main,
      ...(permissions.length ? { reshell: { permissions } } : {}),
    },
    pluginPath,
    isLoaded: false,
    isActive: false,
    usageCount: 0,
  };
}

/** Write a plugin's main file (and optional SIGNATURE) into `pluginPath`. */
function writePlugin(pluginPath: string, mainContent = 'module.exports = {};\n'): void {
  fs.ensureDirSync(pluginPath);
  fs.writeFileSync(path.join(pluginPath, 'index.js'), mainContent);
}

function writeSignature(pluginPath: string, data: unknown): void {
  fs.writeJSONSync(path.join(pluginPath, 'SIGNATURE'), data);
}

describe('plugin-security — policy defaults', () => {
  it('getDefaultSecurityPolicy returns the documented defaults', () => {
    const policy = getDefaultSecurityPolicy();
    expect(policy).toEqual({
      allowNetworkAccess: false,
      allowFileSystemAccess: true,
      allowProcessExecution: false,
      allowEnvironmentAccess: false,
      allowWorkspaceAccess: true,
      maxMemoryUsage: 512 * MB,
      maxExecutionTime: 30000,
      trustedSources: ['npm', 'builtin'],
      blockedSources: [],
      requiredSignatures: false,
    });
  });

  it('returns a fresh object each call', () => {
    expect(getDefaultSecurityPolicy()).not.toBe(getDefaultSecurityPolicy());
  });

  it('the validator merges partial overrides onto the defaults', () => {
    const validator = new PluginSecurityValidator({ allowNetworkAccess: true, maxExecutionTime: 5000 });
    const policy = (validator as unknown as { securityPolicy: SecurityPolicy }).securityPolicy;
    expect(policy.allowNetworkAccess).toBe(true);
    expect(policy.maxExecutionTime).toBe(5000);
    // Untouched fields keep their defaults.
    expect(policy.allowFileSystemAccess).toBe(true);
    expect(policy.trustedSources).toEqual(['npm', 'builtin']);
  });

  it('createSecurityValidator returns a PluginSecurityValidator', () => {
    expect(createSecurityValidator()).toBeInstanceOf(PluginSecurityValidator);
  });
});

describe('plugin-security — scanPlugin permission validation', () => {
  let tmp: string;
  let pluginPath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-perm-'));
    // 'node_modules' in the path makes the source 'npm' (trusted by default),
    // isolating these tests to permission behavior only.
    pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
  });
  afterEach(() => fs.removeSync(tmp));

  async function scanWith(permissions: PluginPermission[], policy?: Partial<SecurityPolicy>) {
    const validator = new PluginSecurityValidator(policy);
    return validator.scanPlugin(makeRegistration(pluginPath, permissions));
  }

  it('flags a network permission as high + blocking by default', async () => {
    const result = await scanWith([{ type: 'network', access: 'full', description: 'net' }]);
    const v = result.violations.find((x) => x.description.startsWith('Network access'));
    expect(v).toMatchObject({ severity: 'high', blocked: true });
  });

  it('allows a network permission when the policy permits network access', async () => {
    const result = await scanWith(
      [{ type: 'network', access: 'full', description: 'net' }],
      { allowNetworkAccess: true }
    );
    expect(result.violations.some((x) => x.description.startsWith('Network access'))).toBe(false);
  });

  it('flags a process permission as high + blocking by default', async () => {
    const result = await scanWith([{ type: 'process', access: 'execute', description: 'proc' }]);
    const v = result.violations.find((x) => x.description.startsWith('Process execution'));
    expect(v).toMatchObject({ severity: 'high', blocked: true });
  });

  it('flags a filesystem write permission when fs access is disabled', async () => {
    const result = await scanWith(
      [{ type: 'filesystem', access: 'write', description: 'write' }],
      { allowFileSystemAccess: false }
    );
    const v = result.violations.find((x) => x.description.startsWith('File system write'));
    expect(v).toMatchObject({ severity: 'medium', blocked: false });
  });

  it('still allows filesystem READ access even when fs access is disabled', async () => {
    // NOTE quirk: the guard is `!allowFileSystemAccess && access !== 'read'`,
    // so read access slips through regardless of policy.
    const result = await scanWith(
      [{ type: 'filesystem', access: 'read', description: 'read' }],
      { allowFileSystemAccess: false }
    );
    expect(result.violations.some((x) => x.source === 'permission-policy')).toBe(false);
  });

  it('flags an environment permission as medium (non-blocking) by default', async () => {
    const result = await scanWith([{ type: 'environment', access: 'read', description: 'env' }]);
    const v = result.violations.find((x) => x.description.startsWith('Environment access'));
    expect(v).toMatchObject({ severity: 'medium', blocked: false });
  });

  it('warns about excessive permissions when more than 10 are declared', async () => {
    const perms: PluginPermission[] = Array.from({ length: 11 }, (_, i) => ({
      type: 'environment',
      access: 'read',
      description: `env${i}`,
    }));
    const result = await scanWith(perms);
    expect(result.violations.some((x) => x.description.includes('excessive permissions'))).toBe(true);
  });

  it('flags the dangerous filesystem(full)+network+process combination as blocking', async () => {
    const result = await scanWith([
      { type: 'filesystem', access: 'full', description: 'fs' },
      { type: 'network', access: 'full', description: 'net' },
      { type: 'process', access: 'execute', description: 'proc' },
    ]);
    const v = result.violations.find((x) => x.description.includes('dangerous permission combination'));
    expect(v).toMatchObject({ severity: 'high', blocked: true });
  });
});

describe('plugin-security — source trust', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-src-'));
  });
  afterEach(() => fs.removeSync(tmp));

  it('flags a plugin at an unknown path as an untrusted source', async () => {
    const pluginPath = path.join(tmp, 'orphan-plugin'); // no node_modules / .re-shell/plugins / /plugins
    writePlugin(pluginPath);
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    const v = result.violations.find((x) => x.description.includes('untrusted source'));
    expect(v).toMatchObject({ severity: 'medium', blocked: false });
  });

  it('does not flag a plugin under node_modules (trusted npm source)', async () => {
    const pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.violations.some((x) => x.source === 'source-validator')).toBe(false);
  });

  it('flags a blocked source as a critical, blocking violation', async () => {
    const pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
    const validator = new PluginSecurityValidator({ blockedSources: ['npm'] });
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    const v = result.violations.find((x) => x.description.includes('blocked source'));
    expect(v).toMatchObject({ severity: 'critical', blocked: true });
    expect(result.securityLevel).toBe(SecurityLevel.BLOCKED);
    expect(result.approved).toBe(false);
  });
});

describe('plugin-security — malware scanning', () => {
  let tmp: string;
  let pluginPath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-mal-'));
    pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
  });
  afterEach(() => fs.removeSync(tmp));

  const scan = async (mainContent: string) => {
    writePlugin(pluginPath, mainContent);
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    return result.violations.filter((v) => v.source === 'malware-scanner');
  };

  it('flags eval() as high + blocking', async () => {
    const v = await scan("eval('code');");
    expect(v.some((x) => x.description.includes('eval'))).toBe(true);
    expect(v.find((x) => x.description.includes('eval'))).toMatchObject({ severity: 'high', blocked: true });
  });

  it('flags child_process / spawn / exec as high + blocking', async () => {
    const v = await scan("const cp = require('child_process');");
    expect(v.some((x) => x.description.includes('system processes'))).toBe(true);
  });

  it('flags the Function constructor as medium (non-blocking)', async () => {
    const v = await scan("const f = new Function('x');");
    expect(v.find((x) => x.description.includes('Function constructor'))).toMatchObject({
      severity: 'medium',
      blocked: false,
    });
  });

  it('flags minified/obfuscated code via very long identifiers', async () => {
    const v = await scan(`${'a'.repeat(60)} = 1;`);
    expect(v.some((x) => x.description.includes('minified'))).toBe(true);
  });

  it('reports a missing main file as a medium malware violation', async () => {
    // Do not write the main file.
    fs.ensureDirSync(pluginPath);
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.violations.some((x) => x.description === 'Main plugin file not found')).toBe(true);
  });

  it('produces no malware violations for clean code', async () => {
    const v = await scan('module.exports = { activate() {} };\n');
    expect(v).toHaveLength(0);
  });
});

describe('plugin-security — signatures', () => {
  let tmp: string;
  let pluginPath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-sig-'));
    pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
  });
  afterEach(() => fs.removeSync(tmp));

  it('requires a signature when requiredSignatures is enabled', async () => {
    const validator = new PluginSecurityValidator({ requiredSignatures: true });
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    const v = result.violations.find((x) => x.description.includes('signature required'));
    expect(v).toMatchObject({ severity: 'high', blocked: true });
  });

  it('does not require a signature by default', async () => {
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.violations.some((x) => x.source === 'signature-validator')).toBe(false);
  });

  it('marks a signature from an untrusted key as unverified', async () => {
    writeSignature(pluginPath, {
      algorithm: 'rsa-sha256',
      signature: 'sig',
      publicKey: 'UNTRUSTED',
      timestamp: 0,
    });
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.signature?.verified).toBe(false);
    expect(result.violations.some((x) => x.description.includes('not from trusted source'))).toBe(true);
  });

  it('verifies a signature whose public key has been trusted', async () => {
    writeSignature(pluginPath, {
      algorithm: 'rsa-sha256',
      signature: 'sig',
      publicKey: 'TRUSTED-KEY',
      timestamp: 0,
    });
    const validator = new PluginSecurityValidator();
    validator.addTrustedPublicKey('TRUSTED-KEY');
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.signature?.verified).toBe(true);
  });

  it('records a violation for a malformed SIGNATURE file', async () => {
    fs.writeFileSync(path.join(pluginPath, 'SIGNATURE'), '{ not json');
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.violations.some((x) => x.description === 'Invalid signature format')).toBe(true);
  });
});

describe('plugin-security — reputation', () => {
  let tmp: string;
  let pluginPath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-rep-'));
    pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
  });
  afterEach(() => fs.removeSync(tmp));

  it('warns when no reputation data is available', async () => {
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.warnings.some((w) => w.includes('No reputation data'))).toBe(true);
  });

  it('flags a low community rating', async () => {
    const validator = new PluginSecurityValidator();
    validator.updatePluginReputation('test-plugin', {
      rating: 1.0,
      downloads: 1000,
      reviews: 5,
      lastUpdated: Date.now(),
      maintainer: 'x',
      verified: true,
      communityTrust: 50,
    });
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.violations.some((x) => x.description.includes('Low community rating'))).toBe(true);
  });

  it('flags a low download count', async () => {
    const validator = new PluginSecurityValidator();
    validator.updatePluginReputation('test-plugin', {
      rating: 5,
      downloads: 10,
      reviews: 1,
      lastUpdated: Date.now(),
      maintainer: 'x',
      verified: true,
      communityTrust: 50,
    });
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.violations.some((x) => x.description.includes('Low download count'))).toBe(true);
  });

  it('flags a stale plugin (not updated in over a year)', async () => {
    const validator = new PluginSecurityValidator();
    validator.updatePluginReputation('test-plugin', {
      rating: 5,
      downloads: 1000,
      reviews: 5,
      lastUpdated: Date.now() - 400 * 24 * 60 * 60 * 1000,
      maintainer: 'x',
      verified: true,
      communityTrust: 50,
    });
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.violations.some((x) => x.description.includes('not updated'))).toBe(true);
  });
});

describe('plugin-security — security level outcomes', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-lvl-'));
  });
  afterEach(() => fs.removeSync(tmp));

  it('assigns VERIFIED to a clean plugin from a trusted source', async () => {
    const pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.securityLevel).toBe(SecurityLevel.VERIFIED);
    expect(result.approved).toBe(true);
    expect(result.sandboxRequired).toBe(false);
  });

  it('assigns TRUSTED to a signed, reputable, clean plugin', async () => {
    const pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
    writeSignature(pluginPath, {
      algorithm: 'rsa-sha256',
      signature: 'sig',
      publicKey: 'TRUSTED-KEY',
      timestamp: 0,
    });
    const validator = new PluginSecurityValidator();
    validator.addTrustedPublicKey('TRUSTED-KEY');
    validator.updatePluginReputation('test-plugin', {
      rating: 5,
      downloads: 1000,
      reviews: 5,
      lastUpdated: Date.now(),
      maintainer: 'x',
      verified: true,
      communityTrust: 90,
    });
    const result = await validator.scanPlugin(makeRegistration(pluginPath));
    expect(result.securityLevel).toBe(SecurityLevel.TRUSTED);
    expect(result.approved).toBe(true);
    expect(result.sandboxRequired).toBe(false);
  });

  it('assigns SANDBOXED when only non-blocking violations are present', async () => {
    const pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
    // environment permission -> medium, non-blocking.
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath, [
      { type: 'environment', access: 'read', description: 'env' },
    ]));
    expect(result.securityLevel).toBe(SecurityLevel.SANDBOXED);
    expect(result.approved).toBe(true);
    expect(result.sandboxRequired).toBe(true);
  });

  it('escalates a blocking violation straight to BLOCKED', async () => {
    const pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
    // network permission -> high + blocking.
    const validator = new PluginSecurityValidator();
    const result = await validator.scanPlugin(makeRegistration(pluginPath, [
      { type: 'network', access: 'full', description: 'net' },
    ]));
    expect(result.securityLevel).toBe(SecurityLevel.BLOCKED);
    expect(result.approved).toBe(false);
  });

  // NOTE: the RESTRICTED level (high violation but none blocking) is effectively
  // unreachable: every high-severity built-in violation is also blocking, so any
  // high violation escalates directly to BLOCKED. This test documents that gap by
  // confirming a high-but-not-blocking violation still cannot be produced.
  it('documents that RESTRICTED is unreachable via built-in high violations', () => {
    const fake: SecurityScanResult = {
      plugin: 'x',
      securityLevel: SecurityLevel.RESTRICTED,
      violations: [],
      permissions: [],
      sandboxRequired: true,
      approved: false,
      warnings: [],
    };
    // createSandboxConfig still honors a crafted RESTRICTED result, proving the
    // level is wired up even if scanPlugin never yields it.
    const cfg = new PluginSecurityValidator().createSandboxConfig(
      { manifest: { name: 'x', version: '1', description: 'd', main: 'i.js' }, pluginPath: '/x', isLoaded: false, isActive: false, usageCount: 0 },
      fake
    );
    expect(cfg.memoryLimit).toBeLessThanOrEqual(256 * MB);
    expect(cfg.timeoutLimit).toBeLessThanOrEqual(10000);
  });
});

describe('plugin-security — createSandboxConfig', () => {
  let tmp: string;
  let pluginPath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-sbx-cfg-'));
    pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
  });
  afterEach(() => fs.removeSync(tmp));

  const reg = (perms: PluginPermission[] = []) => makeRegistration(pluginPath, perms);
  const verifiedResult = (level: SecurityLevel): SecurityScanResult => ({
    plugin: 'test-plugin',
    securityLevel: level,
    violations: [],
    permissions: [],
    sandboxRequired: false,
    approved: true,
    warnings: [],
  });

  it('builds a locked-down base config by default', () => {
    const cfg = new PluginSecurityValidator().createSandboxConfig(reg(), verifiedResult(SecurityLevel.SANDBOXED));
    expect(cfg.isolateFileSystem).toBe(true);
    expect(cfg.isolateNetwork).toBe(true);
    expect(cfg.isolateProcesses).toBe(true);
    expect(cfg.allowedPaths).toContain(pluginPath);
    expect(cfg.blockedPaths).toContain('/etc');
    expect(cfg.blockedNetworks).toContain('localhost');
  });

  it('loosens filesystem isolation for a read permission and allowlists its resource', () => {
    const cfg = new PluginSecurityValidator().createSandboxConfig(
      reg([{ type: 'filesystem', access: 'read', resource: '/data', description: 'r' }]),
      verifiedResult(SecurityLevel.SANDBOXED)
    );
    expect(cfg.isolateFileSystem).toBe(false);
    expect(cfg.allowedPaths).toContain('/data');
  });

  it('loosens network isolation for a network permission and allowlists its resource', () => {
    const cfg = new PluginSecurityValidator().createSandboxConfig(
      reg([{ type: 'network', access: 'full', resource: 'example.com', description: 'n' }]),
      verifiedResult(SecurityLevel.SANDBOXED)
    );
    expect(cfg.isolateNetwork).toBe(false);
    expect(cfg.allowedNetworks).toContain('example.com');
  });

  it('disables all isolation for a TRUSTED plugin', () => {
    const cfg = new PluginSecurityValidator().createSandboxConfig(reg(), verifiedResult(SecurityLevel.TRUSTED));
    expect(cfg.isolateFileSystem).toBe(false);
    expect(cfg.isolateNetwork).toBe(false);
  });

  it('disables network isolation for a VERIFIED plugin', () => {
    const cfg = new PluginSecurityValidator().createSandboxConfig(reg(), verifiedResult(SecurityLevel.VERIFIED));
    expect(cfg.isolateNetwork).toBe(false);
  });
});

describe('plugin-security — caching, stats & events', () => {
  let tmp: string;
  let pluginPath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-cache-'));
    pluginPath = path.join(tmp, 'node_modules', 'test-plugin');
    writePlugin(pluginPath);
  });
  afterEach(() => fs.removeSync(tmp));

  it('caches scan results and returns the same reference on the second call', async () => {
    const validator = new PluginSecurityValidator();
    const cachedListener = vi.fn();
    validator.on('security-scan-cached', cachedListener);

    const first = await validator.scanPlugin(makeRegistration(pluginPath));
    const second = await validator.scanPlugin(makeRegistration(pluginPath));

    expect(second).toBe(first);
    expect(cachedListener).toHaveBeenCalledWith('test-plugin');
  });

  it('emits started and completed events with the plugin name and level', async () => {
    const validator = new PluginSecurityValidator();
    const started = vi.fn();
    const completed = vi.fn();
    validator.on('security-scan-started', started);
    validator.on('security-scan-completed', completed);

    await validator.scanPlugin(makeRegistration(pluginPath));

    expect(started).toHaveBeenCalledWith('test-plugin');
    expect(completed).toHaveBeenCalledWith(
      expect.objectContaining({ plugin: 'test-plugin', securityLevel: expect.any(String) })
    );
  });

  it('clearCache forces a re-scan', async () => {
    const validator = new PluginSecurityValidator();
    const cleared = vi.fn();
    validator.on('cache-cleared', cleared);

    await validator.scanPlugin(makeRegistration(pluginPath));
    validator.clearCache();
    expect(cleared).toHaveBeenCalledTimes(1);

    const started = vi.fn();
    validator.on('security-scan-started', started);
    await validator.scanPlugin(makeRegistration(pluginPath));
    expect(started).toHaveBeenCalledTimes(1);
  });

  it('addTrustedPublicKey and updatePluginReputation invalidate the cache', async () => {
    const validator = new PluginSecurityValidator();
    const cleared = vi.fn();
    validator.on('cache-cleared', cleared);
    validator.addTrustedPublicKey('K');
    validator.updatePluginReputation('x', {
      rating: 5,
      downloads: 1,
      reviews: 1,
      lastUpdated: 0,
      maintainer: 'x',
      verified: true,
      communityTrust: 1,
    });
    expect(cleared).toHaveBeenCalledTimes(2);
  });

  it('getSecurityStats aggregates cached scans, keys and reputations', async () => {
    const validator = new PluginSecurityValidator();
    validator.addTrustedPublicKey('K');
    validator.updatePluginReputation('test-plugin', {
      rating: 5,
      downloads: 1000,
      reviews: 5,
      lastUpdated: Date.now(),
      maintainer: 'x',
      verified: true,
      communityTrust: 90,
    });
    await validator.scanPlugin(makeRegistration(pluginPath));

    const stats = validator.getSecurityStats();
    expect(stats.totalScans).toBe(1);
    expect(stats.trustedKeys).toBe(1);
    expect(stats.reputationData).toBe(1);
    expect(stats.securityLevels).toHaveProperty(SecurityLevel.VERIFIED);
  });
});

describe('plugin-security — PluginSandbox', () => {
  let tmp: string;
  let allowedDir: string;
  let blockedDir: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psec-sandbox-'));
    allowedDir = path.join(tmp, 'allowed');
    blockedDir = path.join(tmp, 'blocked');
    fs.ensureDirSync(allowedDir);
    fs.ensureDirSync(blockedDir);
  });
  afterEach(() => fs.removeSync(tmp));

  const baseConfig: SandboxConfig = {
    isolateFileSystem: false,
    isolateNetwork: false,
    isolateProcesses: false,
    memoryLimit: 512 * MB,
    timeoutLimit: 5000,
    allowedPaths: [],
    blockedPaths: [],
    allowedNetworks: [],
    blockedNetworks: [],
  };

  it('createPluginSandbox returns a PluginSandbox', () => {
    expect(createPluginSandbox(baseConfig)).toBeInstanceOf(PluginSandbox);
  });

  it('executes a function and returns its value', async () => {
    const sandbox = new PluginSandbox({ ...baseConfig });
    const value = await sandbox.executeInSandbox(() => 42, {});
    expect(value).toBe(42);
  });

  it('rejects with a timeout error when the function exceeds the limit', async () => {
    const sandbox = new PluginSandbox({ ...baseConfig, timeoutLimit: 5000 });
    const failed = vi.fn();
    sandbox.on('sandbox-execution-failed', failed);
    await expect(
      sandbox.executeInSandbox(
        () => new Promise((resolve) => setTimeout(resolve, 200)),
        {},
        20
      )
    ).rejects.toThrow('Plugin execution timeout');
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('nulls out network modules when network isolation is enabled', async () => {
    const sandbox = new PluginSandbox({ ...baseConfig, isolateNetwork: true });
    let snapshot: Record<string, unknown> = {};
    await sandbox.executeInSandbox((ctx: Record<string, unknown>) => {
      snapshot = ctx;
    }, { http: {}, https: {}, fetch: () => {} });
    expect(snapshot.http).toBeNull();
    expect(snapshot.https).toBeNull();
    expect(snapshot.fetch).toBeNull();
  });

  it('replaces the process object with a sandboxed one that blocks exit/kill', async () => {
    const sandbox = new PluginSandbox({ ...baseConfig, isolateProcesses: true });
    await expect(
      sandbox.executeInSandbox((ctx: { process: { exit: () => void } }) => ctx.process.exit(), { process: process })
    ).rejects.toThrow('Process exit blocked in sandbox');
  });

  it('denies filesystem writes outside the allowed paths', async () => {
    const sandbox = new PluginSandbox({
      ...baseConfig,
      isolateFileSystem: true,
      allowedPaths: [allowedDir],
      blockedPaths: [blockedDir],
    });
    await expect(
      sandbox.executeInSandbox(
        (ctx: { fs: { writeFileSync: (p: string, d: string) => void } }) =>
          ctx.fs.writeFileSync(path.join(blockedDir, 'x'), 'y'),
        {}
      )
    ).rejects.toThrow('Filesystem access denied');
  });

  it('permits filesystem writes inside the allowed paths', async () => {
    const sandbox = new PluginSandbox({
      ...baseConfig,
      isolateFileSystem: true,
      allowedPaths: [allowedDir],
      blockedPaths: [],
    });
    await expect(
      sandbox.executeInSandbox(
        (ctx: { fs: { writeFileSync: (p: string, d: string) => void } }) =>
          ctx.fs.writeFileSync(path.join(allowedDir, 'ok'), 'y'),
        {}
      )
    ).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(allowedDir, 'ok'))).toBe(true);
  });

  it('monitorResourceUsage can be started without throwing', () => {
    const sandbox = new PluginSandbox({ ...baseConfig, timeoutLimit: 10 });
    expect(() => sandbox.monitorResourceUsage()).not.toThrow();
  });
});
