import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateDeveloperProductivityMD,
  generateTerraformDeveloperProductivity,
  generateTypeScriptDeveloperProductivity,
  generatePythonDeveloperProductivity,
  writeFiles,
  developerProductivity,
} from '../../src/utils/developer-productivity';

const config = {
  projectName: 'prod-app',
  providers: ['aws' as const],
  metrics: [
    { id: 'm1', name: 'PRs/day', category: 'code' as const, unit: 'count', target: 3, current: 2 },
  ],
  developers: [
    { developerId: 'd1', name: 'Alice', email: 'alice@x.com', team: 'backend', metrics: { commitsCount: 50, prsCount: 10, reviewsCount: 20 } },
  ],
  widgets: [
    { id: 'w1', title: 'PR Throughput', type: 'line' as const, metric: 'prs', timeRange: 'weekly' as const, position: { x: 0, y: 0, w: 6, h: 4 } },
  ],
  insights: [
    { id: 'i1', type: 'tip' as const, title: 'Review faster', description: 'Reduce review time', actionable: true },
  ],
  enablePersonalization: true,
  enableBenchmarking: false,
  enableGoalTracking: true,
};

describe('developerProductivity', () => {
  it('returns the config as-is', () => {
    expect(developerProductivity(config)).toBe(config);
  });
});

describe('generateDeveloperProductivityMD', () => {
  it('generates markdown with title', () => {
    const md = generateDeveloperProductivityMD(config);
    expect(md).toContain('# Developer Productivity');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateDeveloperProductivityMD(config).toLowerCase()).toContain('productivity');
  });
});

describe('generateTerraformDeveloperProductivity', () => {
  it('includes project name', () => {
    expect(generateTerraformDeveloperProductivity(config)).toContain('prod-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformDeveloperProductivity(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptDeveloperProductivity', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptDeveloperProductivity(config);
    expect(ts).toContain('DeveloperProductivityManager');
    expect(ts).toContain('prod-app');
  });
});

describe('generatePythonDeveloperProductivity', () => {
  it('generates Python manager class', () => {
    const py = generatePythonDeveloperProductivity(config);
    expect(py).toContain('class DeveloperProductivityManager');
    expect(py).toContain('prod-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dp-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'developer-productivity.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'developer-productivity-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'DEVELOPER_PRODUCTIVITY.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'developer_productivity_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('prod-app-developer-productivity');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'developer-productivity-config.json'), 'utf-8'));
    expect(json.projectName).toBe('prod-app');
    expect(json.enablePersonalization).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pandas');
    expect(req).toContain('matplotlib');
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
