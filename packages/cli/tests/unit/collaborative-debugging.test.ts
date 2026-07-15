import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCollaborativeDebuggingMD,
  generateTerraformCollaborativeDebugging,
  generateTypeScriptCollaborativeDebugging,
  generatePythonCollaborativeDebugging,
  writeFiles,
  collaborativeDebugging,
} from '../../src/utils/collaborative-debugging';

const config = {
  projectName: 'debug-app',
  providers: ['aws' as const],
  protocol: 'debug-adapter-protocol' as const,
  breakpoints: [
    { id: 'bp1', type: 'line' as const, file: 'src/index.ts', line: 10, enabled: true },
  ],
  sessions: [
    { id: 's1', userId: 'u1', userName: 'Alice', role: 'leader' as const, mode: 'lead' as const, active: true },
  ],
  collaboration: {
    maxParticipants: 5,
    sharedBreakpoints: true,
    sharedConsole: true,
    variableInspection: false,
    callStackSharing: true,
    memoryInspection: false,
  },
  enableRemoteDebugging: true,
  enableHotReload: false,
};

describe('collaborativeDebugging', () => {
  it('returns the config as-is', () => {
    expect(collaborativeDebugging(config)).toBe(config);
  });
});

describe('generateCollaborativeDebuggingMD', () => {
  it('generates markdown with title', () => {
    const md = generateCollaborativeDebuggingMD(config);
    expect(md).toContain('# Collaborative Debugging');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateCollaborativeDebuggingMD(config);
    expect(md).toContain('Shared breakpoints');
    expect(md).toContain('debugger protocols');
    expect(md).toContain('Remote debugging');
  });
});

describe('generateTerraformCollaborativeDebugging', () => {
  it('includes project name', () => {
    const tf = generateTerraformCollaborativeDebugging(config);
    expect(tf).toContain('debug-app');
    expect(tf).toContain('Terraform');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformCollaborativeDebugging(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptCollaborativeDebugging', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCollaborativeDebugging(config);
    expect(ts).toContain('CollaborativeDebuggingManager');
    expect(ts).toContain('extends EventEmitter');
    expect(ts).toContain('debug-app');
  });
});

describe('generatePythonCollaborativeDebugging', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCollaborativeDebugging(config);
    expect(py).toContain('class CollaborativeDebuggingManager');
    expect(py).toContain('debug-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbg-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative-debugging.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative-debugging-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'COLLABORATIVE_DEBUGGING.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative-debugging-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'collaborative_debugging_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('debug-app-collaborative-debugging');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'collaborative-debugging-config.json'));
    expect(json.projectName).toBe('debug-app');
    expect(json.protocol).toBe('debug-adapter-protocol');
    expect(json.enableRemoteDebugging).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('debugpy');
    expect(req).toContain('websockets');
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
