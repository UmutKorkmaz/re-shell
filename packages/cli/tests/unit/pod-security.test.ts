import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generatePodSecurityMD,
  generateTypeScriptPodSecurity,
  generatePythonPodSecurity,
  writeFiles,
} from '../../src/utils/pod-security';

const config = {
  projectName: 'podsec-app',
  namespace: 'secure',
  securityProfile: {
    name: 'restricted-profile',
    level: 'restricted' as const,
    version: 'v1.25' as const,
    enforce: true,
    audit: true,
    warn: true,
  },
  admissionRules: [
    {
      name: 'deny-privileged',
      namespace: 'secure',
      operations: ['CREATE', 'UPDATE'],
      resources: ['pods'],
      apiGroups: [''],
      failurePolicy: 'Fail' as const,
      validations: [
        {
          expression: 'has(object.metadata.labels) && has(object.metadata.labels.app)',
          message: 'pod must have an app label',
        },
      ],
    },
  ],
  compliancePolicies: [
    {
      name: 'require-non-root',
      description: 'Containers must not run as root',
      rules: ['runAsNonRoot == true'],
      severity: 'high' as const,
      remediation: 'Set securityContext.runAsNonRoot=true',
    },
  ],
  enableNetworkPolicies: true,
  enableResourceQuotas: false,
  enableLimitRanges: false,
};

describe('generatePodSecurityMD', () => {
  it('includes title and features section', () => {
    const md = generatePodSecurityMD(config);
    expect(md).toContain('# Pod Security');
    expect(md).toContain('## Features');
  });

  it('describes pod security standards', () => {
    expect(generatePodSecurityMD(config).toLowerCase()).toContain('restricted');
  });
});

describe('generateTypeScriptPodSecurity', () => {
  it('embeds project name', () => {
    const ts = generateTypeScriptPodSecurity(config);
    expect(ts).toContain('podsec-app');
  });

  it('references the configured admission rule', () => {
    expect(generateTypeScriptPodSecurity(config)).toContain('deny-privileged');
  });
});

describe('generatePythonPodSecurity', () => {
  it('embeds project name', () => {
    const py = generatePythonPodSecurity(config);
    expect(py).toContain('podsec-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'podsec-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of ['pod-security.ts', 'package.json', 'POD_SECURITY.md', 'pod-security-config.json']) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'pod-security.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'pod-security-config.json'), 'utf-8'));
    expect(json.projectName).toBe('podsec-app');
    expect(json.namespace).toBe('secure');
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
