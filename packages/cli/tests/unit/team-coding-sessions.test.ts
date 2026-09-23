import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateTeamCodingSessionsMD,
  generateTerraformTeamCodingSessions,
  generateTypeScriptTeamCodingSessions,
  generatePythonTeamCodingSessions,
  writeFiles,
  teamCodingSessions,
} from '../../src/utils/team-coding-sessions';

const config = {
  projectName: 'tcs-app',
  providers: ['aws' as const],
  session: {
    name: 'Pairing Session',
    maxDuration: 120,
    autoArchive: true,
    recordingEnabled: false,
  },
  permissions: {
    driver: { canEdit: true, canComment: true, canReview: false, canApprove: false, canExecute: true },
    navigator: { canEdit: false, canComment: true, canReview: true, canApprove: true, canExecute: false },
  },
  activityLog: [
    { userId: 'u1', userName: 'Alice', action: 'edit' as const, timestamp: Date.now(), details: {} },
  ],
  enableVoiceChat: true,
  enableScreenShare: false,
  enableAnalytics: true,
};

describe('teamCodingSessions', () => {
  it('returns the config as-is', () => {
    expect(teamCodingSessions(config)).toBe(config);
  });
});

describe('generateTeamCodingSessionsMD', () => {
  it('generates markdown with title', () => {
    const md = generateTeamCodingSessionsMD(config);
    expect(md).toContain('# Team Coding');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateTeamCodingSessionsMD(config).toLowerCase()).toContain('coding');
  });
});

describe('generateTerraformTeamCodingSessions', () => {
  it('includes project name', () => {
    expect(generateTerraformTeamCodingSessions(config)).toContain('tcs-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformTeamCodingSessions(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptTeamCodingSessions', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptTeamCodingSessions(config);
    expect(ts).toContain('TeamCodingSessionsManager');
    expect(ts).toContain('tcs-app');
  });
});

describe('generatePythonTeamCodingSessions', () => {
  it('generates Python manager class', () => {
    const py = generatePythonTeamCodingSessions(config);
    expect(py).toContain('class TeamCodingSessionsManager');
    expect(py).toContain('tcs-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tcs-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'team-coding-sessions.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'team-coding-sessions-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'TEAM_CODING_SESSIONS.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'team_coding_sessions_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('tcs-app-team-coding-sessions');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'team-coding-sessions-config.json'), 'utf-8'));
    expect(json.projectName).toBe('tcs-app');
    expect(json.enableVoiceChat).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('websockets');
    expect(req).toContain('python-json-logger');
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
