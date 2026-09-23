import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateTeamPerformanceOptimizationMD,
  generateTerraformTeamPerformanceOptimization,
  generateTypeScriptTeamPerformanceOptimization,
  generatePythonTeamPerformanceOptimization,
  writeFiles,
  teamPerformanceOptimization,
} from '../../src/utils/team-performance-optimization';

const config = {
  projectName: 'perf-app',
  providers: ['aws' as const],
  issues: [
    { id: 'i1', teamId: 't1', teamName: 'Backend', area: 'velocity' as const, description: 'Low velocity' },
  ],
  recommendations: [
    { id: 'r1', issueId: 'i1', type: 'training' as const, title: 'React training', description: 'Upskill team' },
  ],
  sessions: [
    { id: 's1', teamId: 't1', coachId: 'c1', style: 'facilitative' as const, focus: ['velocity'] },
  ],
  goals: [
    { id: 'g1', teamId: 't1', area: 'velocity' as const, current: 20, target: 30 },
  ],
  enableAutoDetection: true,
  enableProgressTracking: false,
  enableFeedbackCollection: true,
};

describe('teamPerformanceOptimization', () => {
  it('returns the config as-is', () => {
    expect(teamPerformanceOptimization(config)).toBe(config);
  });
});

describe('generateTeamPerformanceOptimizationMD', () => {
  it('generates markdown with title', () => {
    const md = generateTeamPerformanceOptimizationMD(config);
    expect(md).toContain('# Team Performance');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateTeamPerformanceOptimizationMD(config);
    expect(md.toLowerCase()).toContain('performance');
    expect(md.toLowerCase()).toContain('optimization');
  });
});

describe('generateTerraformTeamPerformanceOptimization', () => {
  it('includes project name', () => {
    expect(generateTerraformTeamPerformanceOptimization(config)).toContain('perf-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformTeamPerformanceOptimization(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptTeamPerformanceOptimization', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptTeamPerformanceOptimization(config);
    expect(ts).toContain('TeamPerformanceOptimizationManager');
    expect(ts).toContain('perf-app');
  });
});

describe('generatePythonTeamPerformanceOptimization', () => {
  it('generates Python manager class', () => {
    const py = generatePythonTeamPerformanceOptimization(config);
    expect(py).toContain('class TeamPerformanceOptimizationManager');
    expect(py).toContain('perf-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tpo-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'team-performance-optimization.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'team-performance-optimization-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'TEAM_PERFORMANCE_OPTIMIZATION.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'team_performance_optimization_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('perf-app-team-performance-optimization');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'team-performance-optimization-config.json'), 'utf-8'));
    expect(json.projectName).toBe('perf-app');
    expect(json.enableAutoDetection).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('scikit-learn');
    expect(req).toContain('pandas');
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
