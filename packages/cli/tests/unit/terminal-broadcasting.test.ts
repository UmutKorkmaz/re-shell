import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateTerminalBroadcastingMD,
  generateTerraformTerminalBroadcasting,
  generateTypeScriptTerminalBroadcasting,
  generatePythonTerminalBroadcasting,
  writeFiles,
  terminalBroadcasting,
} from '../../src/utils/terminal-broadcasting';

const config = {
  projectName: 'broadcast-app',
  providers: ['aws', 'gcp'] as const,
  broadcast: {
    enabled: true,
    maxViewers: 50,
    recordingEnabled: false,
    interactiveMode: true,
    encryption: 'aes-256-gcm' as const,
    compression: 'gzip' as const,
    latencyTarget: 100,
  },
  accessControl: {
    authentication: 'jwt' as const,
    authorizedUsers: ['alice', 'bob'],
    allowedIPs: [],
    sessionTimeout: 600,
  },
  features: {
    colors: true,
    unicode: true,
    cursor: true,
    resize: true,
    copyPaste: false,
  },
  enableChat: true,
  enableVoiceOverlay: false,
};

describe('terminalBroadcasting passthrough', () => {
  it('returns the same config', () => {
    expect(terminalBroadcasting(config)).toEqual(config);
  });
});

describe('generateTerminalBroadcastingMD', () => {
  it('includes title and features section', () => {
    const md = generateTerminalBroadcastingMD(config);
    expect(md).toMatch(/Terminal Broadcasting/i);
    expect(md).toContain('## Features');
  });
});

describe('generateTerraformTerminalBroadcasting', () => {
  it('embeds project name', () => {
    expect(generateTerraformTerminalBroadcasting(config)).toContain('broadcast-app');
  });
});

describe('generateTypeScriptTerminalBroadcasting', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptTerminalBroadcasting(config)).toContain('broadcast-app');
  });
});

describe('generatePythonTerminalBroadcasting', () => {
  it('embeds project name', () => {
    expect(generatePythonTerminalBroadcasting(config)).toContain('broadcast-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'broadcast-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'terminal-broadcasting.tf',
      'terminal-broadcasting-manager.ts',
      'package.json',
      'TERMINAL_BROADCASTING.md',
      'terminal-broadcasting-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'terminal_broadcasting_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'terminal-broadcasting-config.json'), 'utf-8'));
    expect(json.projectName).toBe('broadcast-app');
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
