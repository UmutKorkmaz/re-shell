import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateIngressMD,
  generateTypeScriptIngress,
  generatePythonIngress,
  writeFiles,
} from '../../src/utils/ingress-manager';

const config = {
  projectName: 'ingress-app',
  namespace: 'edge',
  ingressClassName: 'nginx',
  rules: [
    {
      host: 'app.example.com',
      paths: [
        { path: '/', pathType: 'Prefix', serviceName: 'web', servicePort: 80 },
        { path: '/api', pathType: 'Prefix', serviceName: 'api', servicePort: 8080 },
      ],
    },
  ],
  ssl: {
    enabled: true,
    issuer: 'letsencrypt-prod' as const,
    certificateType: 'cluster-issuer',
    acmeChallenge: 'http01' as const,
  },
  waf: {
    enabled: true,
    mode: 'active' as const,
    rulesets: ['owasp-top-10'],
    rateLimiting: { enabled: true, requestsPerSecond: 100, burst: 50 },
  },
  enableCORS: true,
  enableCompression: true,
  enableAuth: true,
  authType: 'jwt' as const,
};

describe('generateIngressMD', () => {
  it('includes title', () => {
    const md = generateIngressMD(config);
    expect(md).toContain('# Advanced Ingress');
    expect(md).toContain('## Features');
  });

  it('documents ssl and waf features', () => {
    const md = generateIngressMD(config).toLowerCase();
    expect(md).toContain('ssl');
    expect(md).toContain('waf');
  });
});

describe('generateTypeScriptIngress', () => {
  it('embeds project name and namespace', () => {
    const ts = generateTypeScriptIngress(config);
    expect(ts).toContain('ingress-app');
    expect(ts).toContain('edge');
  });
});

describe('generatePythonIngress', () => {
  it('embeds project name', () => {
    expect(generatePythonIngress(config)).toContain('ingress-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ingress-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of ['ingress-manager.ts', 'package.json', 'INGRESS.md', 'ingress-config.json']) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'ingress-manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'ingress-config.json'), 'utf-8'));
    expect(json.projectName).toBe('ingress-app');
    expect(json.namespace).toBe('edge');
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
