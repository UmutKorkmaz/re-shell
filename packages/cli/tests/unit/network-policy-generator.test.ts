import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateNetworkPolicyMD,
  generateTypeScriptNetworkPolicy,
  generatePythonNetworkPolicy,
  writeFiles,
} from '../../src/utils/network-policy-generator';

const config = {
  projectName: 'np-app',
  namespace: 'production',
  microSegmentation: true,
  denyAllIngress: true,
  denyAllEgress: false,
  policies: [
    {
      name: 'allow-api',
      podSelector: { app: 'api' },
      policyTypes: ['Ingress' as const],
      rules: [
        {
          direction: 'Ingress' as const,
          ports: [{ protocol: 'TCP' as const, port: 8080 }],
        },
      ],
    },
  ],
  podSecurityPolicy: {
    restricted: {
      runAsNonRoot: true,
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
    },
  },
};

describe('generateNetworkPolicyMD', () => {
  it('includes title and features section', () => {
    const md = generateNetworkPolicyMD(config);
    expect(md).toContain('# Network Policies');
    expect(md).toContain('## Features');
  });

  it('mentions micro-segmentation feature', () => {
    expect(generateNetworkPolicyMD(config).toLowerCase()).toContain('micro-segmentation');
  });
});

describe('generateTypeScriptNetworkPolicy', () => {
  it('embeds project name', () => {
    const ts = generateTypeScriptNetworkPolicy(config);
    expect(ts).toContain('NetworkPolicyController');
    expect(ts).toContain('np-app');
  });

  it('emits the configured policy', () => {
    expect(generateTypeScriptNetworkPolicy(config)).toContain('allow-api');
  });
});

describe('generatePythonNetworkPolicy', () => {
  it('embeds project name', () => {
    const py = generatePythonNetworkPolicy(config);
    expect(py).toContain('np-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'np-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes all expected files', async () => {
    await writeFiles(config, tmpDir);
    for (const file of [
      'network-policy-generator.ts',
      'network-policy-generator.py',
      'NETWORK_POLICY.md',
      'package.json',
      'requirements.txt',
      'network-policy-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('package.json reflects project name', async () => {
    await writeFiles(config, tmpDir);
    const pkg = JSON.parse(await fs.readFile(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('np-app');
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir);
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'network-policy-config.json'), 'utf-8'));
    expect(json.projectName).toBe('np-app');
    expect(json.namespace).toBe('production');
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
