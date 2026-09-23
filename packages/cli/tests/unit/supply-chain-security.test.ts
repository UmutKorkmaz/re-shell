import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateSupplyChainSecurityMarkdown,
  generateSupplyChainSecurityTerraform,
  generateSupplyChainManagerTypeScript,
  generateSupplyChainManagerPython,
  writeSupplyChainSecurityFiles,
  displaySupplyChainSecurityConfig,
} from '../../src/utils/supply-chain-security';

const config = {
  projectName: 'scs-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  settings: {
    autoGenerate: true,
    format: 'cyclonedx',
    includeDevDependencies: false,
    vulnerabilityScan: true,
    licenseCompliance: true,
    integrityVerification: true,
    signatureVerification: true,
    depth: 5,
    updateFrequency: 'weekly',
    severityThreshold: 'high',
    failOnViolation: true,
    allowedLicenses: ['MIT', 'Apache-2.0'],
    prohibitedLicenses: ['GPL-3.0'],
    signatureRequired: true,
    verifyProvenance: true,
    attestationsRequired: true,
  } as any,
  sbom: [],
  components: [],
  vulnerabilities: [],
  licenses: [],
  dependencies: [],
  integrityChecks: [],
  analytics: [],
  integrations: [],
} as any;

describe('generateSupplyChainSecurityMarkdown', () => {
  it('references project name', () => {
    expect(generateSupplyChainSecurityMarkdown(config)).toContain('scs-app');
  });
});

describe('generateSupplyChainSecurityTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateSupplyChainSecurityTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateSupplyChainSecurityTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateSupplyChainSecurityTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateSupplyChainManagerTypeScript', () => {
  it('produces a typescript module', () => {
    expect(generateSupplyChainManagerTypeScript(config)).toMatch(/class|SupplyChain|security/i);
  });
});

describe('generateSupplyChainManagerPython', () => {
  it('produces a python module', () => {
    expect(generateSupplyChainManagerPython(config)).toMatch(/class|def/i);
  });
});

describe('writeSupplyChainSecurityFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scs-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown, terraform per provider, TS manager, package.json, config', async () => {
    await writeSupplyChainSecurityFiles(config, tmpDir, 'typescript');
    for (const file of [
      'SUPPLY_CHAIN_SECURITY.md',
      'supply-chain-security-aws.tf',
      'supply-chain-security-azure.tf',
      'supply-chain-security-gcp.tf',
      'supply-chain-security-manager.ts',
      'package.json',
      'supply-chain-security-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python manager + requirements', async () => {
    await writeSupplyChainSecurityFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'supply_chain_security_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeSupplyChainSecurityFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'supply-chain-security-config.json'), 'utf-8'));
    expect(json.projectName).toBe('scs-app');
  });
});

describe('displaySupplyChainSecurityConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displaySupplyChainSecurityConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
