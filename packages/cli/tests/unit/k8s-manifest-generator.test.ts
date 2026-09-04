import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateK8sMD,
  generateTypeScriptK8s,
  generatePythonK8s,
  writeFiles,
} from '../../src/utils/k8s-manifest-generator';

const config = {
  projectName: 'k8s-app',
  namespace: 'production',
  replicas: 3,
  resources: { cpu: '250m', memory: '256Mi' },
  services: [
    {
      name: 'api',
      language: 'typescript',
      port: 8080,
      image: 'ghcr.io/acme/api:1.0.0',
      env: { LOG_LEVEL: 'info' },
    },
    {
      name: 'worker',
      language: 'python',
      port: 9000,
      image: 'ghcr.io/acme/worker:1.0.0',
      env: { QUEUE: 'jobs' },
      replicas: 2,
    },
  ],
};

describe('generateK8sMD', () => {
  it('includes title and features section', () => {
    const md = generateK8sMD(config);
    expect(md).toContain('# Kubernetes');
    expect(md).toContain('## Features');
  });

  it('mentions deployment and service resources', () => {
    const md = generateK8sMD(config).toLowerCase();
    expect(md).toContain('deployment');
    expect(md).toContain('service');
  });
});

describe('generateTypeScriptK8s', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptK8s(config)).toContain('k8s-app');
  });

  it('references configured services', () => {
    expect(generateTypeScriptK8s(config)).toContain('api');
    expect(generateTypeScriptK8s(config)).toContain('worker');
  });
});

describe('generatePythonK8s', () => {
  it('embeds project name', () => {
    expect(generatePythonK8s(config)).toContain('k8s-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'k8s-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes all expected files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'k8s-manifest-generator.ts',
      'k8s-manifest-generator.py',
      'K8S_MANIFESTS.md',
      'package.json',
      'requirements.txt',
      'k8s-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'k8s-config.json'), 'utf-8'));
    expect(json.projectName).toBe('k8s-app');
    expect(json.services).toHaveLength(2);
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
