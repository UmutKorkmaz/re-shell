import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateZeroTrustMarkdown,
  generateZeroTrustTerraform,
  generateZeroTrustManagerTypeScript,
  generateZeroTrustManagerPython,
  writeZeroTrustFiles,
  displayZeroTrustConfig,
} from '../../src/utils/zero-trust-security';

const config = {
  projectName: 'zt-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  trustSettings: {
    enabled: true,
    defaultTrustLevel: 'low-trust',
    strictMode: true,
    requireMFA: true,
    sessionTimeout: 60,
    maxSessionDuration: 480,
    continuousVerification: true,
    riskScoringEnabled: true,
    adaptiveAccess: true,
    deviceHealthCheck: true,
    networkLocationCheck: true,
    behavioralAnalysis: true,
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventReuse: 5,
      expiryDays: 90,
    } as any,
    devicePolicy: {
      requireTrustedDevice: true,
      allowUnregisteredDevices: false,
      deviceRegistrationRequired: true,
      osVersions: { ios: '15.0', android: '12.0', macos: '13.0', windows: '11.0' },
      requireEncryption: true,
      requireScreenLock: true,
      allowRootedDevices: false,
      allowEmulators: false,
      maxDevicesPerUser: 3,
      deviceCertification: 'managed',
    } as any,
    networkPolicy: {
      allowPublicNetworks: false,
      allowedNetworks: ['10.0.0.0/8'],
      deniedNetworks: [],
      requireVPN: true,
      allowedLocations: ['TR', 'US'],
      deniedLocations: [],
      ipWhitelist: [],
      ipBlacklist: [],
    } as any,
    geoPolicy: {
      enabled: true,
      allowedCountries: ['TR', 'US'],
      deniedCountries: [],
      velocityCheck: true,
      allowedCities: [],
      deniedCities: [],
      anomalyDetection: true,
    } as any,
  } as any,
  identities: [],
  policies: [],
  sessions: [],
  trustScores: [],
  verifications: [],
  complianceReports: [],
  integrations: [],
} as any;

describe('generateZeroTrustMarkdown', () => {
  it('references project name', () => {
    expect(generateZeroTrustMarkdown(config)).toContain('zt-app');
  });
});

describe('generateZeroTrustTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateZeroTrustTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateZeroTrustTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateZeroTrustTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateZeroTrustManagerTypeScript', () => {
  it('produces a typescript module', () => {
    expect(generateZeroTrustManagerTypeScript(config)).toMatch(/class|ZeroTrust|trust/i);
  });
});

describe('generateZeroTrustManagerPython', () => {
  it('produces a python module', () => {
    expect(generateZeroTrustManagerPython(config)).toMatch(/class|def/i);
  });
});

describe('writeZeroTrustFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zt-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown, terraform per provider, TS manager, package.json, config', async () => {
    await writeZeroTrustFiles(config, tmpDir, 'typescript');
    for (const file of [
      'ZERO_TRUST.md',
      'zero-trust-aws.tf',
      'zero-trust-azure.tf',
      'zero-trust-gcp.tf',
      'zero-trust-manager.ts',
      'package.json',
      'zero-trust-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python manager + requirements', async () => {
    await writeZeroTrustFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'zero_trust_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeZeroTrustFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'zero-trust-config.json'), 'utf-8'));
    expect(json.projectName).toBe('zt-app');
  });
});

describe('displayZeroTrustConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayZeroTrustConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
