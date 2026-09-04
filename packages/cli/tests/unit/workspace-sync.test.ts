import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateWorkspaceSyncMD,
  generateTerraformWorkspaceSync,
  generateTypeScriptWorkspaceSync,
  generatePythonWorkspaceSync,
  writeFiles,
  workspaceSync,
} from '../../src/utils/workspace-sync';

const config = {
  projectName: 'sync-app',
  providers: ['aws', 'gcp'] as const,
  sync: {
    enabled: true,
    strategy: 'real-time' as const,
    protocol: 'websocket' as const,
    interval: 1000,
    debounceMs: 200,
  },
  workspace: {
    name: 'shared-workspace',
    path: '/workspaces/shared',
    ignorePatterns: ['node_modules', '.git'],
    includePatterns: ['src/**'],
  },
  members: [],
  conflictResolution: 'crdt' as const,
  enablePresence: true,
  enableCursorSharing: true,
  enableAutoSync: true,
};

describe('workspaceSync passthrough', () => {
  it('returns the same config', () => {
    expect(workspaceSync(config)).toEqual(config);
  });
});

describe('generateWorkspaceSyncMD', () => {
  it('includes title and features section', () => {
    const md = generateWorkspaceSyncMD(config);
    expect(md).toMatch(/Workspace Sync/i);
    expect(md).toContain('## Features');
  });
});

describe('generateTerraformWorkspaceSync', () => {
  it('embeds project name', () => {
    expect(generateTerraformWorkspaceSync(config)).toContain('sync-app');
  });
});

describe('generateTypeScriptWorkspaceSync', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptWorkspaceSync(config)).toContain('sync-app');
  });
});

describe('generatePythonWorkspaceSync', () => {
  it('embeds project name', () => {
    expect(generatePythonWorkspaceSync(config)).toContain('sync-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'workspace-sync.tf',
      'workspace-sync-manager.ts',
      'package.json',
      'WORKSPACE_SYNC.md',
      'workspace-sync-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'workspace_sync_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'workspace-sync-config.json'), 'utf-8'));
    expect(json.projectName).toBe('sync-app');
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
