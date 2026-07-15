import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCodeQualityCoachingMD,
  generateTerraformCodeQualityCoaching,
  generateTypeScriptCodeQualityCoaching,
  generatePythonCodeQualityCoaching,
  writeFiles,
  codeQualityCoaching,
} from '../../src/utils/code-quality-coaching';

const config = {
  projectName: 'cqc-app',
  providers: ['aws' as const],
  profiles: [],
  recommendations: [],
  sessions: [],
  enableAutomatedAnalysis: true,
  enablePersonalizedCoaching: false,
  enableProgressTracking: true,
  defaultCoachingStyle: 'collaborative' as const,
  feedbackFormat: 'summary' as const,
  severityThreshold: 'major' as const,
  reviewFrequency: 14,
};

describe('codeQualityCoaching', () => {
  it('returns the config as-is', () => {
    expect(codeQualityCoaching(config)).toBe(config);
  });
});

describe('generateCodeQualityCoachingMD', () => {
  it('generates markdown with title', () => {
    const md = generateCodeQualityCoachingMD(config);
    expect(md).toContain('# Code Quality Coaching');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateCodeQualityCoachingMD(config).toLowerCase()).toContain('coaching');
  });
});

describe('generateTerraformCodeQualityCoaching', () => {
  it('includes project name', () => {
    expect(generateTerraformCodeQualityCoaching(config)).toContain('cqc-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformCodeQualityCoaching(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptCodeQualityCoaching', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCodeQualityCoaching(config);
    expect(ts).toContain('CodeQualityCoachingManager');
    expect(ts).toContain('cqc-app');
  });
});

describe('generatePythonCodeQualityCoaching', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCodeQualityCoaching(config);
    expect(py).toContain('class CodeQualityCoachingManager');
    expect(py).toContain('cqc-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cqc-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'code-quality-coaching.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'code-quality-coaching-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CODE_QUALITY_COACHING.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'code_quality_coaching_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('cqc-app-code-quality-coaching');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'code-quality-coaching-config.json'), 'utf-8'));
    expect(json.projectName).toBe('cqc-app');
    expect(json.enableAutomatedAnalysis).toBe(true);
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
