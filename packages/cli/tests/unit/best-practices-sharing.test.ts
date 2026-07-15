import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateBestPracticesMD,
  generateTerraformBestPractices,
  generateTypeScriptBestPractices,
  generatePythonBestPractices,
  writeFiles,
  bestPractices,
} from '../../src/utils/best-practices-sharing';

const config = {
  projectName: 'bp-app',
  providers: ['aws' as const],
  libraries: new Map(),
  enableCommunityVoting: true,
  enableAutoEnforcement: false,
  enableDiscussion: true,
  votingThreshold: 5,
  reputationSystem: true,
  moderationRequired: false,
  practiceVisibility: 'public' as const,
};

describe('bestPractices', () => {
  it('returns the config as-is', () => {
    expect(bestPractices(config)).toBe(config);
  });
});

describe('generateBestPracticesMD', () => {
  it('generates markdown with title', () => {
    const md = generateBestPracticesMD(config);
    expect(md).toContain('# Best Practices');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateBestPracticesMD(config).toLowerCase()).toContain('practices');
  });
});

describe('generateTerraformBestPractices', () => {
  it('includes project name', () => {
    expect(generateTerraformBestPractices(config)).toContain('bp-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformBestPractices(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptBestPractices', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptBestPractices(config);
    expect(ts).toContain('BestPracticesManager');
    expect(ts).toContain('bp-app');
  });
});

describe('generatePythonBestPractices', () => {
  it('generates Python manager class', () => {
    const py = generatePythonBestPractices(config);
    expect(py).toContain('class BestPracticesManager');
    expect(py).toContain('bp-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'best-practices.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'best-practices-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'BEST_PRACTICES.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'best_practices_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('bp-app-best-practices');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'best-practices-config.json'), 'utf-8'));
    expect(json.projectName).toBe('bp-app');
    expect(json.enableCommunityVoting).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pandas');
    expect(req).toContain('numpy');
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
