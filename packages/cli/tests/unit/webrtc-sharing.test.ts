import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateWebRTCSharingMD,
  generateTerraformWebRTCSharing,
  generateTypeScriptWebRTCSharing,
  generatePythonWebRTCSharing,
  writeFiles,
  webrtcSharing,
} from '../../src/utils/webrtc-sharing';

const config = {
  projectName: 'webrtc-app',
  providers: ['aws', 'gcp'] as const,
  webrtc: {
    enabled: true,
    signalingUrl: 'wss://signal.example.com',
    stunServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    turnServers: [
      { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' },
    ],
    iceTransportPolicy: 'all' as const,
    codec: 'VP8' as const,
    maxBitrate: 1500,
  },
  session: {
    name: 'pair-programming',
    maxParticipants: 4,
    recordingEnabled: false,
    chatEnabled: true,
    audioEnabled: true,
    videoEnabled: true,
  },
  accessControl: {
    authentication: true,
    authorization: ['developer'],
    encryption: true,
    allowedIPs: [],
  },
  enableScreenSharing: true,
  enableFileTransfer: true,
  enableCursorTracking: true,
};

describe('webrtcSharing passthrough', () => {
  it('returns the same config', () => {
    expect(webrtcSharing(config)).toEqual(config);
  });
});

describe('generateWebRTCSharingMD', () => {
  it('includes title and features section', () => {
    const md = generateWebRTCSharingMD(config);
    expect(md).toMatch(/WebRTC|Code Sharing/);
    expect(md).toContain('## Features');
  });
});

describe('generateTerraformWebRTCSharing', () => {
  it('embeds project name', () => {
    expect(generateTerraformWebRTCSharing(config)).toContain('webrtc-app');
  });
});

describe('generateTypeScriptWebRTCSharing', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptWebRTCSharing(config)).toContain('webrtc-app');
  });
});

describe('generatePythonWebRTCSharing', () => {
  it('embeds project name', () => {
    expect(generatePythonWebRTCSharing(config)).toContain('webrtc-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webrtc-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'webrtc-sharing.tf',
      'webrtc-sharing-manager.ts',
      'package.json',
      'WEBRTC_SHARING.md',
      'webrtc-sharing-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'webrtc_sharing_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'webrtc-sharing-config.json'), 'utf-8'));
    expect(json.projectName).toBe('webrtc-app');
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
