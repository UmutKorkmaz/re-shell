import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateClusterManagerMD,
  generateTypeScriptClusterManager,
  generatePythonClusterManager,
  writeFiles,
} from '../../src/utils/cluster-manager';

const config = {
  projectName: 'cm-app',
  kubeconfig: '~/.kube/config',
  context: 'minikube',
  namespace: 'default',
  upgradeConfig: {
    currentVersion: '1.28.0',
    targetVersion: '1.29.0',
    autoApprove: false,
    drainNodes: true,
    ignoreDaemonSets: true,
    timeout: 300,
    dryRun: false,
  },
  safetyChecks: [],
  enableMonitoring: true,
  enableLogging: false,
};

describe('generateClusterManagerMD', () => {
  it('generates markdown with title', () => {
    const md = generateClusterManagerMD(config);
    expect(md).toContain('# Kubernetes Cluster Management');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateClusterManagerMD(config).toLowerCase()).toContain('cluster');
  });
});

describe('generateTypeScriptClusterManager', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptClusterManager(config);
    expect(ts).toContain('class ClusterManager');
    expect(ts).toContain('cm-app');
  });
});

describe('generatePythonClusterManager', () => {
  it('generates Python manager class', () => {
    const py = generatePythonClusterManager(config);
    expect(py).toContain('class ClusterManager');
    expect(py).toContain('cm-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cm-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'cluster-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CLUSTER_MANAGER.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'cluster-manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('cm-app-cluster-manager');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'cluster-config.json'), 'utf-8'));
    expect(json.projectName).toBe('cm-app');
    expect(json.enableMonitoring).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('kubernetes');
    expect(req).toContain('pyyaml');
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
