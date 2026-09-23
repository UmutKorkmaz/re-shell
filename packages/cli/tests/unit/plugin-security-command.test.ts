import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  scanPluginSecurity,
  checkSecurityPolicy,
  generateSecurityReport,
  fixSecurityIssues,
} from '../../src/commands/plugin-security';
import { ValidationError } from '../../src/utils/error-handler';
import * as pluginSystem from '../../src/utils/plugin-system';
import * as pluginSecurity from '../../src/utils/plugin-security';
import * as spinnerMod from '../../src/utils/spinner';

// Covers src/commands/plugin-security.ts (503 lines) — the four
// `plugin security` subcommand entry points (scan / policy / report / fix).
// The plugin registry and security validator engines have their own suites;
// here they are mocked so the command layer's aggregation, severity
// filtering, JSON envelopes and human rendering are exercised in isolation.

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  getPlugins: vi.fn(),
  getPlugin: vi.fn(),
  scanPlugin: vi.fn(),
  getSecurityStats: vi.fn(),
  readJSON: vi.fn(),
}));

vi.mock('../../src/utils/plugin-system', () => ({
  createPluginRegistry: vi.fn(() => ({
    initialize: mocks.initialize,
    getPlugins: mocks.getPlugins,
    getPlugin: mocks.getPlugin,
  })),
}));

vi.mock('../../src/utils/plugin-security', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/utils/plugin-security')>();
  return {
    ...actual,
    createSecurityValidator: vi.fn(() => ({
      scanPlugin: mocks.scanPlugin,
      getSecurityStats: mocks.getSecurityStats,
    })),
    getDefaultSecurityPolicy: vi.fn(() => ({
      allowNetworkAccess: false,
      allowFileSystemAccess: false,
      allowProcessExecution: false,
      maxMemoryUsage: 512 * 1024 * 1024,
      maxExecutionTime: 30000,
    })),
  };
});

vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

const REGISTRY = vi.mocked(pluginSystem.createPluginRegistry);
const VALIDATOR = vi.mocked(pluginSecurity.createSecurityValidator);

function makePlugin(name: string): unknown {
  return { manifest: { name, version: '1.0.0' } };
}

function scanResult(overrides: Partial<pluginSecurity.SecurityScanResult> = {}) {
  return {
    plugin: 'alpha',
    approved: true,
    securityLevel: pluginSecurity.SecurityLevel.TRUSTED,
    violations: [],
    permissions: [],
    warnings: [],
    sandboxRequired: false,
    ...overrides,
  } as pluginSecurity.SecurityScanResult;
}

function violation(overrides: Partial<pluginSecurity.SecurityViolation> = {}) {
  return {
    type: 'permission',
    severity: 'high',
    description: 'plugin requests excessive permissions',
    recommendation: 'trim the manifest',
    blocked: false,
    ...overrides,
  } as pluginSecurity.SecurityViolation;
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.initialize.mockResolvedValue(undefined);
  mocks.getPlugins.mockReturnValue([]);
  mocks.getPlugin.mockReturnValue(undefined);
  mocks.getSecurityStats.mockReturnValue({
    totalScans: 0,
    trustedKeys: 0,
    reputationData: 0,
    securityLevels: {},
    violationTypes: {},
  });
  REGISTRY.mockClear();
  VALIDATOR.mockClear();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

function out(): string {
  return logSpy.mock.calls.map(c => String(c[0])).join('\n');
}

describe('scanPluginSecurity', () => {
  it('scans every registered plugin and renders the summary', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha'), makePlugin('beta')]);
    mocks.scanPlugin
      .mockResolvedValueOnce(scanResult({ plugin: 'alpha', approved: true }))
      .mockResolvedValueOnce(
        scanResult({
          plugin: 'beta',
          approved: false,
          securityLevel: pluginSecurity.SecurityLevel.BLOCKED,
          violations: [
            violation({ severity: 'critical', blocked: true }),
            violation({ severity: 'high' }),
          ],
        })
      );

    await scanPluginSecurity();

    expect(mocks.scanPlugin).toHaveBeenCalledTimes(2);
    const text = out();
    expect(text).toContain('Total Plugins: 2');
    expect(text).toContain('Approved: 1');
    expect(text).toContain('Blocked: 1');
    expect(text).toContain('Total Violations: 2');
    expect(text).toContain('Critical: 1');
    expect(text).toContain('High: 1');
  });

  it('restricts the scan to a named plugin', async () => {
    const plugin = makePlugin('alpha');
    mocks.getPlugin.mockReturnValue(plugin);
    mocks.scanPlugin.mockResolvedValue(scanResult());

    await scanPluginSecurity('alpha');

    expect(mocks.getPlugin).toHaveBeenCalledWith('alpha');
    expect(mocks.scanPlugin).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown plugin names with a ValidationError', async () => {
    await expect(scanPluginSecurity('ghost')).rejects.toThrow(
      "Plugin 'ghost' not found"
    );
  });

  it('filters violations by severity before aggregating', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(
      scanResult({
        violations: [
          violation({ severity: 'critical' }),
          violation({ severity: 'high', description: 'other' }),
        ],
      })
    );

    await scanPluginSecurity(undefined, { severity: 'critical' });

    expect(out()).toContain('Total Violations: 1');
  });

  it('emits a raw JSON array in json mode', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(scanResult());

    await scanPluginSecurity(undefined, { json: true });

    const parsed = JSON.parse(out());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].plugin).toBe('alpha');
  });

  it('reports when no plugins are registered (human)', async () => {
    await scanPluginSecurity();
    expect(out()).toContain('No plugins scanned.');
  });

  it('skips a plugin whose individual scan throws and keeps going', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha'), makePlugin('beta')]);
    mocks.scanPlugin
      .mockRejectedValueOnce(new Error('manifest unreadable'))
      .mockResolvedValueOnce(scanResult({ plugin: 'beta' }));

    await scanPluginSecurity();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to scan alpha')
    );
    expect(out()).toContain('Total Plugins: 1');
  });

  it('wraps initialization failures in a ValidationError', async () => {
    mocks.initialize.mockRejectedValue(new Error('registry boom'));
    await expect(scanPluginSecurity()).rejects.toThrow(
      'Security scan failed: registry boom'
    );
  });

  it('renders verbose violations, permissions, signature and reputation detail', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(
      scanResult({
        approved: false,
        securityLevel: pluginSecurity.SecurityLevel.SANDBOXED,
        violations: [violation({ severity: 'medium', blocked: true })],
        permissions: [
          { type: 'filesystem', access: 'read', description: 'read files' },
        ],
        signature: { verified: true, algorithm: 'Ed25519' },
        reputation: { rating: 4.5, downloads: 1200 },
        sandboxRequired: true,
        warnings: ['legacy manifest'],
      })
    );

    await scanPluginSecurity(undefined, { verbose: true, includeWarnings: true });

    const text = out();
    expect(text).toContain('medium: plugin requests excessive permissions');
    expect(text).toContain('BLOCKED - trim the manifest');
    expect(text).toContain('Permissions: 1');
    expect(text).toContain('filesystem:read');
    expect(text).toContain('Signature: verified (Ed25519)');
    expect(text).toContain('Reputation: 4.5/5.0 (1200 downloads)');
    expect(text).toContain('Sandbox required');
    expect(text).toContain('legacy manifest');
  });
});

describe('checkSecurityPolicy', () => {
  it('scores compliance across all registered plugins', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha'), makePlugin('beta')]);
    mocks.scanPlugin
      .mockResolvedValueOnce(scanResult({ approved: true }))
      .mockResolvedValueOnce(scanResult({ plugin: 'beta', approved: false }));

    await checkSecurityPolicy();

    const text = out();
    expect(text).toContain('Compliant: 1/2');
    expect(text).toContain('Non-Compliant: 1/2');
    expect(text).toContain('beta');
  });

  it('emits the merged policy with results in json mode', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(scanResult());

    await checkSecurityPolicy({ json: true });

    const parsed = JSON.parse(out());
    expect(parsed.policy).toMatchObject({ allowNetworkAccess: false });
    expect(parsed.results[0]).toMatchObject({ plugin: 'alpha', compliant: true });
  });

  it('merges a custom policy file over the defaults', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(scanResult());
    // The command require()s fs-extra dynamically; route it to the mock
    const fsExtra = require('fs-extra');
    vi.spyOn(fsExtra, 'readJSON').mockResolvedValue({ allowNetworkAccess: true });

    await checkSecurityPolicy({ policy: '/tmp/policy.json', verbose: true });

    const text = out();
    expect(text).toContain('Network Access: Allowed');
    expect(fsExtra.readJSON).toHaveBeenCalledWith('/tmp/policy.json');
    vi.mocked(fsExtra.readJSON).mockRestore();
  });

  it('renders the verbose policy settings block', async () => {
    mocks.getPlugins.mockReturnValue([]);
    await checkSecurityPolicy({ verbose: true });

    const text = out();
    expect(text).toContain('Security Policy:');
    expect(text).toContain('Memory Limit: 512MB');
    expect(text).toContain('Execution Timeout: 30000ms');
  });

  it('lists non-compliant plugins with their security level', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('beta')]);
    mocks.scanPlugin.mockResolvedValue(
      scanResult({
        plugin: 'beta',
        approved: false,
        securityLevel: pluginSecurity.SecurityLevel.BLOCKED,
        violations: [violation({ severity: 'critical', description: 'malware' })],
      })
    );

    await checkSecurityPolicy({ verbose: true });

    const text = out();
    expect(text).toContain('Non-Compliant Plugins:');
    expect(text).toContain('beta (blocked)');
    expect(text).toContain('critical: malware');
  });

  it('wraps failures in a ValidationError', async () => {
    mocks.initialize.mockRejectedValue(new Error('nope'));
    await expect(checkSecurityPolicy()).rejects.toThrow(
      'Policy compliance check failed: nope'
    );
  });
});

describe('generateSecurityReport', () => {
  it('summarizes scan stats and security level distribution', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(scanResult());
    mocks.getSecurityStats.mockReturnValue({
      totalScans: 3,
      trustedKeys: 2,
      reputationData: 1,
      securityLevels: { trusted: 2, blocked: 1 },
      violationTypes: { permission: 2, signature: 1 },
    });

    await generateSecurityReport();

    const text = out();
    expect(text).toContain('Total Plugins Scanned: 3');
    expect(text).toContain('Trusted Keys: 2');
    expect(text).toContain('Reputation Data: 1');
    expect(text).toContain('trusted: 2');
    expect(text).toContain('blocked: 1');
    expect(text).toContain('Violation Types:');
    expect(text).toContain('permission: 2');
  });

  it('emits summary, results and timestamp in json mode', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(scanResult());

    await generateSecurityReport({ json: true });

    const parsed = JSON.parse(out());
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('results');
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('recommends removal for blocked plugins and sandboxing for restricted ones', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('a'), makePlugin('b')]);
    mocks.scanPlugin
      .mockResolvedValueOnce(
        scanResult({ securityLevel: pluginSecurity.SecurityLevel.BLOCKED })
      )
      .mockResolvedValueOnce(
        scanResult({ securityLevel: pluginSecurity.SecurityLevel.RESTRICTED })
      );

    await generateSecurityReport();

    const text = out();
    expect(text).toContain('Recommendations:');
    expect(text).toContain('remove 1 blocked plugin(s)');
    expect(text).toContain('sandboxing 1 restricted plugin(s)');
    expect(text).toContain('Regularly update plugins');
  });

  it('omits recommendations when everything passed', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('a')]);
    mocks.scanPlugin.mockResolvedValue(scanResult());
    mocks.getSecurityStats.mockReturnValue({
      totalScans: 1,
      trustedKeys: 0,
      reputationData: 0,
      securityLevels: { trusted: 1 },
      violationTypes: {},
    });

    await generateSecurityReport();

    expect(out()).not.toContain('Recommendations:');
  });

  it('wraps validator failures in a ValidationError', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('a')]);
    mocks.scanPlugin.mockRejectedValue(new Error('scan exploded'));
    await expect(generateSecurityReport()).rejects.toThrow(
      'Security report generation failed: scan exploded'
    );
  });
});

describe('fixSecurityIssues', () => {
  it('classifies excessive-permission violations as auto-fixable', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(
      scanResult({ violations: [violation()] })
    );

    await fixSecurityIssues();

    const text = out();
    expect(text).toContain('Total Issues: 1');
    expect(text).toContain('Auto-fixable: 1');
    expect(text).toContain('Remove unnecessary permissions from plugin manifest');
    expect(text).toContain('To apply automatic fixes, run with --fix flag');
  });

  it('falls back to the recommendation for non-auto-fixable violations', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(
      scanResult({
        violations: [violation({ type: 'malware', description: 'uses eval' })],
      })
    );

    await fixSecurityIssues();

    const text = out();
    expect(text).toContain('Manual fixes required: 1');
    expect(text).toContain('trim the manifest');
  });

  it('reports a clean state when there are no violations', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(scanResult());

    await fixSecurityIssues();

    expect(out()).toContain(
      'No security issues found that can be automatically fixed.'
    );
  });

  it('applies fixes and reports success when --fix is passed', async () => {
    mocks.getPlugins.mockReturnValue([makePlugin('alpha')]);
    mocks.scanPlugin.mockResolvedValue(
      scanResult({ violations: [violation()] })
    );

    await fixSecurityIssues(undefined, { fix: true });

    const text = out();
    expect(text).toContain('Applying automatic fixes...');
    expect(text).toContain('Fixed: alpha');
  });

  it('limits analysis to a named plugin', async () => {
    mocks.getPlugin.mockReturnValue(makePlugin('alpha'));
    mocks.scanPlugin.mockResolvedValue(scanResult());

    await fixSecurityIssues('alpha');

    expect(mocks.scanPlugin).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown plugin names', async () => {
    await expect(fixSecurityIssues('ghost')).rejects.toThrow(
      "Plugin 'ghost' not found"
    );
  });
});
