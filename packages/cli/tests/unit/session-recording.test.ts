import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateSessionRecordingMD,
  generateTerraformSessionRecording,
  generateTypeScriptSessionRecording,
  generatePythonSessionRecording,
  writeFiles,
  sessionRecording,
} from '../../src/utils/session-recording';

const config = {
  projectName: 'rec-app',
  providers: ['aws' as const],
  recording: {
    enabled: true,
    format: 'webm' as const,
    storage: 's3' as const,
    compression: 'medium' as const,
    quality: 80,
    fps: 30,
  },
  metadata: {
    captureUser: true,
    captureTimestamp: true,
    captureEnvironment: false,
    captureTerminalSize: true,
    addMarkers: false,
  },
  replay: {
    enablePlayback: true,
    enableSpeedControl: true,
    enableStepThrough: false,
    enableAnnotations: true,
    enableExport: false,
  },
  enableAutoRecording: true,
  enablePrivacyMode: false,
  enableSearch: true,
};

describe('sessionRecording', () => {
  it('returns the config as-is', () => {
    expect(sessionRecording(config)).toBe(config);
  });
});

describe('generateSessionRecordingMD', () => {
  it('generates markdown with title', () => {
    const md = generateSessionRecordingMD(config);
    expect(md).toContain('# Session Recording');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateSessionRecordingMD(config).toLowerCase()).toContain('recording');
  });
});

describe('generateTerraformSessionRecording', () => {
  it('includes project name', () => {
    expect(generateTerraformSessionRecording(config)).toContain('rec-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformSessionRecording(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptSessionRecording', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptSessionRecording(config);
    expect(ts).toContain('SessionRecordingManager');
    expect(ts).toContain('rec-app');
  });
});

describe('generatePythonSessionRecording', () => {
  it('generates Python manager class', () => {
    const py = generatePythonSessionRecording(config);
    expect(py).toContain('class SessionRecordingManager');
    expect(py).toContain('rec-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sr-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'session-recording.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'session-recording-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'SESSION_RECORDING.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'session_recording_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('rec-app-session-recording');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'session-recording-config.json'), 'utf-8'));
    expect(json.projectName).toBe('rec-app');
    expect(json.recording.format).toBe('webm');
    expect(json.enableAutoRecording).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('boto3');
    expect(req).toContain('opencv');
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
