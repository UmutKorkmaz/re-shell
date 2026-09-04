import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateCICDMD,
  generateTypeScriptCICD,
  generatePythonCICD,
  writeFiles,
} from '../../src/utils/cicd-pipeline';

const config: any = {
  projectName: 'ci-project',
  namespace: 'production',
  gitRepo: 'https://github.com/example/repo.git',
  branch: 'main',
  stages: [
    { name: 'build', type: 'build', image: 'node:20', commands: ['npm ci', 'npm run build'] },
    { name: 'test', type: 'test', image: 'node:20', commands: ['npm test'] },
    { name: 'deploy', type: 'deploy', image: 'bitnami/kubectl', commands: ['kubectl apply -f k8s/'] },
  ],
  progressiveDelivery: {
    enabled: true,
    strategy: 'canary',
    canary: { steps: 5, intervalSeconds: 30, incrementPercentage: 20 },
    analysis: { enabled: true, metrics: ['request-success-rate'], successThreshold: 99 },
  },
  enableNotifications: true,
  enableRollback: true,
};

describe('displayConfig', () => {
  it('logs pipeline config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayConfig(config)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateCICDMD', () => {
  it('produces markdown with CI/CD pipeline documentation', () => {
    const md = generateCICDMD(config);
    expect(md).toContain('# Kubernetes-Native CI/CD Pipeline');
    expect(md).toContain('## Features');
    expect(md).toContain('Progressive delivery with canary deployments');
    expect(md).toContain('## Usage');
  });
});

describe('generateTypeScriptCICD', () => {
  it('generates TypeScript code with project name and stages', () => {
    const ts = generateTypeScriptCICD(config);
    expect(ts).toContain('ci-project');
    expect(ts).toContain('class CICDPipeline');
    expect(ts).toContain("import { execSync } from 'child_process'");
    expect(ts).toContain('KubeConfig');
  });

  it('includes progressive delivery canary configuration', () => {
    const ts = generateTypeScriptCICD(config);
    expect(ts).toContain('Canary');
    expect(ts).toContain('flagger.app/v1beta1');
  });

  it('includes notification deployment code', () => {
    const ts = generateTypeScriptCICD(config);
    expect(ts).toContain('deployNotifications');
    expect(ts).toContain('SlackInterceptor');
  });
});

describe('generatePythonCICD', () => {
  it('generates Python code with project name', () => {
    const py = generatePythonCICD(config);
    expect(py).toContain('ci-project');
    expect(py).toContain('class CICDPipeline');
    expect(py).toContain('from dataclasses import dataclass');
    expect(py).toContain('import subprocess');
  });
});

describe('writeFiles', () => {
  it('writes all expected files to the output directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `cicd-test-${Date.now()}`);
    await writeFiles(config, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'cicd-pipeline.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'cicd-pipeline.py'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'CICD.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'cicd-config.json'))).toBe(true);

    const pkgJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkgJson.dependencies).toBeDefined();
    expect(pkgJson.dependencies['js-yaml']).toBeDefined();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
