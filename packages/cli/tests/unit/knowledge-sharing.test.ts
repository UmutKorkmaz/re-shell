import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateKnowledgeSharingMD,
  generateTerraformKnowledgeSharing,
  generateTypeScriptKnowledgeSharing,
  generatePythonKnowledgeSharing,
  writeFiles,
  knowledgeSharing,
} from '../../src/utils/knowledge-sharing';

const config = {
  projectName: 'ks-app',
  providers: ['aws' as const],
  documents: [],
  comments: [],
  search: {
    provider: 'elasticsearch' as const,
    indexing: true,
    fuzzySearch: false,
    highlighting: true,
  },
  collaboration: {
    enableRealTimeEditing: true,
    enableComments: true,
    enableSuggestions: false,
    enableVersionHistory: true,
    maxContributors: 10,
  },
  enableAnalytics: true,
  enableNotifications: false,
};

describe('knowledgeSharing', () => {
  it('returns the config as-is', () => {
    expect(knowledgeSharing(config)).toBe(config);
  });
});

describe('generateKnowledgeSharingMD', () => {
  it('generates markdown with title', () => {
    const md = generateKnowledgeSharingMD(config);
    expect(md).toContain('# Team Knowledge Sharing');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateKnowledgeSharingMD(config).toLowerCase()).toContain('knowledge');
  });
});

describe('generateTerraformKnowledgeSharing', () => {
  it('includes project name', () => {
    expect(generateTerraformKnowledgeSharing(config)).toContain('ks-app');
  });
});

describe('generateTypeScriptKnowledgeSharing', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptKnowledgeSharing(config);
    expect(ts).toContain('KnowledgeSharingManager');
    expect(ts).toContain('ks-app');
  });
});

describe('generatePythonKnowledgeSharing', () => {
  it('generates Python manager class', () => {
    const py = generatePythonKnowledgeSharing(config);
    expect(py).toContain('class KnowledgeSharingManager');
    expect(py).toContain('ks-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ks-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'knowledge-sharing.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'knowledge-sharing-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'KNOWLEDGE_SHARING.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'knowledge_sharing_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'knowledge-sharing-config.json'), 'utf-8'));
    expect(json.projectName).toBe('ks-app');
    expect(json.enableAnalytics).toBe(true);
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
