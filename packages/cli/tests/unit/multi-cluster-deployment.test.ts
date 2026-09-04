import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  displayConfig,
  generateMultiClusterMD,
  generateTypeScriptMultiCluster,
  generatePythonMultiCluster,
  writeFiles,
} from '../../src/utils/multi-cluster-deployment';

const config: any = {
  projectName: 'multi-cluster-app',
  strategy: 'active-active',
  clusters: [
    { name: 'us-east', context: 'us-east-ctx', region: 'us-east-1', provider: 'aws', environment: 'prod' },
    { name: 'eu-west', context: 'eu-west-ctx', region: 'eu-west-1', provider: 'aws', environment: 'dr' },
  ],
};

describe('displayConfig', () => {
  it('logs a summary of the multi-cluster configuration', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('multi-cluster-app');
    expect(out).toContain('active-active');
    expect(out).toContain('us-east');
    expect(out).toContain('eu-west');
    spy.mockRestore();
  });
});

describe('generateMultiClusterMD', () => {
  it('returns markdown with feature list and usage examples', () => {
    const md = generateMultiClusterMD(config);
    expect(md).toContain('# Multi-Cluster Deployment Strategies');
    expect(md).toContain('Active-active');
    expect(md).toContain('Disaster recovery');
    expect(md).toContain('await multiCluster.deploy()');
    expect(md).toContain('await multiCluster.failover');
  });
});

describe('generateTypeScriptMultiCluster', () => {
  it('generates TypeScript class with project name and cluster wiring', () => {
    const code = generateTypeScriptMultiCluster(config);
    expect(code).toContain('multi-cluster-app');
    expect(code).toContain('class MultiClusterDeployment');
    expect(code).toContain('execSync');
    expect(code).toContain('us-east');
    expect(code).toContain('eu-west');
    expect(code).toContain('export default multiCluster');
  });
});

describe('generatePythonMultiCluster', () => {
  it('generates Python class with project name', () => {
    const code = generatePythonMultiCluster(config);
    expect(code).toContain('multi-cluster-app');
    expect(code).toContain('class MultiClusterDeployment');
    expect(code).toContain('subprocess.run');
    expect(code).toContain('us-east');
    expect(code).toContain('eu-west');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('writes all expected files into the output directory', async () => {
    await writeFiles(config, tmpDir);

    const expected = [
      'multi-cluster-deployment.ts',
      'multi-cluster-deployment.py',
      'MULTI_CLUSTER.md',
      'package.json',
      'requirements.txt',
      'multi-cluster-config.json',
    ];
    for (const f of expected) {
      expect(fs.existsSync(path.join(tmpDir, f))).toBe(true);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('multi-cluster-app');
    expect(pkg.main).toBe('multi-cluster-deployment.ts');

    const stored = JSON.parse(fs.readFileSync(path.join(tmpDir, 'multi-cluster-config.json'), 'utf8'));
    expect(stored.projectName).toBe('multi-cluster-app');
    expect(stored.clusters.length).toBe(2);
  });
});
