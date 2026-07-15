import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateVoiceVideoIntegrationMD,
  generateTerraformVoiceVideoIntegration,
  generateTypeScriptVoiceVideoIntegration,
  generatePythonVoiceVideoIntegration,
  writeFiles,
  voiceVideoIntegration,
} from '../../src/utils/voice-video-integration';

const config = {
  projectName: 'voice-app',
  providers: ['aws' as const],
  audio: {
    enabled: true,
    codec: 'opus' as const,
    bitrate: 128,
    sampleRate: 48000,
    noiseCancellation: 'ml-enhanced' as const,
    echoCancellation: 'advanced' as const,
    autoGainControl: true,
  },
  video: {
    enabled: true,
    codec: 'h264' as const,
    resolution: '1080p',
    framerate: 30,
    bitrate: 2500,
    enableHd: true,
  },
  collaboration: {
    maxParticipants: 50,
    screenSharing: true,
    recordingEnabled: false,
    chatEnabled: true,
    reactionEmoji: true,
  },
  enableTranscription: true,
  enableTranslation: false,
};

describe('voiceVideoIntegration', () => {
  it('returns the config as-is', () => {
    expect(voiceVideoIntegration(config)).toBe(config);
  });
});

describe('generateVoiceVideoIntegrationMD', () => {
  it('generates markdown with title', () => {
    const md = generateVoiceVideoIntegrationMD(config);
    expect(md).toContain('# Voice/Video Integration');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateVoiceVideoIntegrationMD(config);
    expect(md).toContain('audio');
    expect(md).toContain('video');
  });
});

describe('generateTerraformVoiceVideoIntegration', () => {
  it('includes project name', () => {
    expect(generateTerraformVoiceVideoIntegration(config)).toContain('voice-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformVoiceVideoIntegration(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptVoiceVideoIntegration', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptVoiceVideoIntegration(config);
    expect(ts).toContain('VoiceVideoIntegrationManager');
    expect(ts).toContain('voice-app');
  });
});

describe('generatePythonVoiceVideoIntegration', () => {
  it('generates Python manager class', () => {
    const py = generatePythonVoiceVideoIntegration(config);
    expect(py).toContain('class VoiceVideoIntegrationManager');
    expect(py).toContain('voice-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vv-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'voice-video-integration.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'voice-video-integration-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'VOICE_VIDEO_INTEGRATION.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'voice-video-integration-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'voice_video_integration_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('voice-app-voice-video-integration');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'voice-video-integration-config.json'));
    expect(json.projectName).toBe('voice-app');
    expect(json.audio.codec).toBe('opus');
    expect(json.enableTranscription).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('aiortc');
    expect(req).toContain('pydub');
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
