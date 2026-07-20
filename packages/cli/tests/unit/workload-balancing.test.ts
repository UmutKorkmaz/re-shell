import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateWorkloadBalancingMD,
  generateTerraformWorkloadBalancing,
  generateTypeScriptWorkloadBalancing,
  generatePythonWorkloadBalancing,
  writeFiles,
  workloadBalancing,
} from '../../src/utils/workload-balancing';

const config = {
  projectName: 'wlb-app',
  providers: ['aws', 'gcp'] as const,
  resources: [],
  tasks: [],
  allocations: [],
  balances: [],
  recommendations: [],
  strategy: 'load-based' as const,
  optimizationGoal: 'balanced' as const,
  enableAI: false,
  maxWorkloadThreshold: 85,
  minUtilizationThreshold: 30,
  rebalanceInterval: 6,
};

describe('workloadBalancing passthrough', () => {
  it('returns the same config', () => {
    expect(workloadBalancing(config)).toEqual(config);
  });
});

describe('generateWorkloadBalancingMD', () => {
  it('includes title and features section', () => {
    const md = generateWorkloadBalancingMD(config);
    expect(md).toMatch(/Workload Balancing/i);
    expect(md).toContain('## Features');
  });
});

describe('generateTerraformWorkloadBalancing', () => {
  it('embeds project name', () => {
    expect(generateTerraformWorkloadBalancing(config)).toContain('wlb-app');
  });
});

describe('generateTypeScriptWorkloadBalancing', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptWorkloadBalancing(config)).toContain('wlb-app');
  });
});

describe('generatePythonWorkloadBalancing', () => {
  it('embeds project name', () => {
    expect(generatePythonWorkloadBalancing(config)).toContain('wlb-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wlb-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'workload-balancing.tf',
      'workload-balancing-manager.ts',
      'package.json',
      'WORKLOAD_BALANCING.md',
      'workload-balancing-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'workload_balancing_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'workload-balancing-config.json'), 'utf-8'));
    expect(json.projectName).toBe('wlb-app');
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
