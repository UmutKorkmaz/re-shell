import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCollaborativeTestingMD,
  generateTerraformCollaborativeTesting,
  generateTypeScriptCollaborativeTesting,
  generatePythonCollaborativeTesting,
  writeFiles,
  collaborativeTesting,
} from '../../src/utils/collaborative-testing';

const config = {
  projectName: 'test-app',
  providers: ['aws' as const],
  environments: [
    { id: 'env1', name: 'Staging', type: 'staging' as const, url: 'https://staging.test.app', status: 'active' as const, capabilities: {} },
  ],
  suites: [
    { id: 's1', name: 'Unit Tests', framework: 'jest' as const, type: 'unit' as const, tests: 50, duration: 30, lastRun: Date.now() },
  ],
  tests: [
    { id: 't1', suite: 's1', name: 'should add', status: 'passed' as const, duration: 5 },
  ],
  quality: {
    minCoverage: 80,
    maxFlakiness: 5,
    requireApproval: true,
    blockOnFailure: false,
  },
  execution: 'parallel' as const,
  enableRealTimeCollaboration: true,
  enableSharedFixtures: true,
  enableAnalytics: false,
};

describe('collaborativeTesting', () => {
  it('returns the config as-is', () => {
    expect(collaborativeTesting(config)).toBe(config);
  });
});

describe('generateCollaborativeTestingMD', () => {
  it('generates markdown with title', () => {
    const md = generateCollaborativeTestingMD(config);
    expect(md).toContain('# Collaborative Testing');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateCollaborativeTestingMD(config);
    expect(md).toContain('Jest');
    expect(md).toContain('parallel');
    expect(md).toContain('Quality gates');
  });
});

describe('generateTerraformCollaborativeTesting', () => {
  it('includes project name', () => {
    expect(generateTerraformCollaborativeTesting(config)).toContain('test-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformCollaborativeTesting(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptCollaborativeTesting', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCollaborativeTesting(config);
    expect(ts).toContain('CollaborativeTestingManager');
    expect(ts).toContain('test-app');
  });
});

describe('generatePythonCollaborativeTesting', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCollaborativeTesting(config);
    expect(py).toContain('class CollaborativeTestingManager');
    expect(py).toContain('test-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ctest-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative-testing.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative-testing-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'COLLABORATIVE_TESTING.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative-testing-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative_testing_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('test-app-collaborative-testing');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'collaborative-testing-config.json'));
    expect(json.projectName).toBe('test-app');
    expect(json.execution).toBe('parallel');
    expect(json.quality.minCoverage).toBe(80);
    expect(json.enableRealTimeCollaboration).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pytest');
    expect(req).toContain('pytest-asyncio');
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
