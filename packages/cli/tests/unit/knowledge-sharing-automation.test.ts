import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateKnowledgeSharingAutomationMD,
  generateTerraformKnowledgeSharingAutomation,
  generateTypeScriptKnowledgeSharingAutomation,
  generatePythonKnowledgeSharingAutomation,
  writeFiles,
  knowledgeSharingAutomation,
} from '../../src/utils/knowledge-sharing-automation';

const config = {
  projectName: 'ksa-app',
  providers: ['aws' as const],
  templates: [],
  rules: [],
  knowledgeBases: [],
  ai: {
    enabled: true,
    provider: 'openai' as const,
    model: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
  },
  enableAutoGeneration: true,
  enableVersioning: false,
  enableSync: true,
};

describe('knowledgeSharingAutomation', () => {
  it('returns the config as-is', () => {
    expect(knowledgeSharingAutomation(config)).toBe(config);
  });
});

describe('generateKnowledgeSharingAutomationMD', () => {
  it('generates markdown with title', () => {
    const md = generateKnowledgeSharingAutomationMD(config);
    expect(md).toContain('# Knowledge Sharing');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateKnowledgeSharingAutomationMD(config).toLowerCase()).toContain('automation');
  });
});

describe('generateTerraformKnowledgeSharingAutomation', () => {
  it('includes project name', () => {
    expect(generateTerraformKnowledgeSharingAutomation(config)).toContain('ksa-app');
  });
});

describe('generateTypeScriptKnowledgeSharingAutomation', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptKnowledgeSharingAutomation(config);
    expect(ts).toContain('KnowledgeSharingAutomationManager');
    expect(ts).toContain('ksa-app');
  });
});

describe('generatePythonKnowledgeSharingAutomation', () => {
  it('generates Python manager class', () => {
    const py = generatePythonKnowledgeSharingAutomation(config);
    expect(py).toContain('class KnowledgeSharingAutomationManager');
    expect(py).toContain('ksa-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ksa-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'knowledge-sharing-automation.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'knowledge-sharing-automation-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'KNOWLEDGE_SHARING_AUTOMATION.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'knowledge_sharing_automation_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'knowledge-sharing-automation-config.json'), 'utf-8'));
    expect(json.projectName).toBe('ksa-app');
    expect(json.enableAutoGeneration).toBe(true);
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
