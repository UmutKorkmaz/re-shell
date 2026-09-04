import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  containerSecurity,
  displayConfig,
  generateMD,
  generateTerraform,
  generateTypeScript,
  generatePython,
  writeFiles,
} from '../../src/utils/container-security';

const rawConfig = {
  projectName: 'cs-sec-app',
  providers: ['aws' as const],
  scanSettings: {
    enabled: true,
    frequency: 'on-build' as const,
    interval: '0 2 * * *',
    scanTypes: ['image' as const, 'filesystem' as const],
    severityThreshold: 'high' as const,
    failOnThreshold: 'critical' as const,
    scanBaseImage: true,
    scanLayers: false,
    licenseCheck: true,
    secretsCheck: true,
    misconfigCheck: false,
    runtimeProtection: true,
    behavioralAnalysis: false,
    autoRemediation: true,
    quarantineVulnerable: false,
  },
  containers: [],
  images: [],
  vulnerabilities: [],
  behavioralAnalysis: [],
  securityPolicies: [],
  complianceChecks: [],
  alerts: [],
  integrations: [],
};

const config = containerSecurity(rawConfig);

describe('containerSecurity', () => {
  it('returns resolved config with projectName', () => {
    expect(config.projectName).toBe('cs-sec-app');
  });
});

describe('generateMD', () => {
  it('generates markdown with title', () => {
    const md = generateMD(config);
    expect(md).toContain('# Container Security');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateMD(config).toLowerCase()).toContain('security');
  });
});

describe('generateTerraform', () => {
  it('includes container security infrastructure', () => {
    expect(generateTerraform(config, 'aws')).toContain('Container Security');
  });
});

describe('generateTypeScript', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScript(config);
    expect(ts).toContain('ContainerSecurityManager');
  });
});

describe('generatePython', () => {
  it('generates Python manager class', () => {
    const py = generatePython(config);
    expect(py).toContain('class ContainerSecurityManager');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cs-sec-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'container-security-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'container-security-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CONTAINER_SECURITY.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'container_security_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'container-security-config.json'), 'utf-8'));
    expect(json.projectName).toBe('cs-sec-app');
    expect(json.scanSettings.enabled).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pydantic');
  });
});

describe('displayConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
