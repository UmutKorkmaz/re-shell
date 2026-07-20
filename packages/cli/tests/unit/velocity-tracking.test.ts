import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateVelocityTrackingMD,
  generateTerraformVelocityTracking,
  generateTypeScriptVelocityTracking,
  generatePythonVelocityTracking,
  writeFiles,
} from '../../src/utils/velocity-tracking';

const config = {
  projectName: 'vel-app',
  providers: ['aws', 'gcp'] as const,
  sprints: [],
  trends: [],
  capacity: [],
  predictions: [],
  enablePredictiveAnalytics: true,
  enableCapacityPlanning: true,
  enableResourceOptimization: false,
};

describe('generateVelocityTrackingMD', () => {
  it('includes title and features section', () => {
    const md = generateVelocityTrackingMD(config);
    expect(md).toContain('# Velocity');
    expect(md).toContain('## Features');
  });
});

describe('generateTerraformVelocityTracking', () => {
  it('embeds project name', () => {
    expect(generateTerraformVelocityTracking(config)).toContain('vel-app');
  });
});

describe('generateTypeScriptVelocityTracking', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptVelocityTracking(config)).toContain('vel-app');
  });
});

describe('generatePythonVelocityTracking', () => {
  it('embeds project name', () => {
    expect(generatePythonVelocityTracking(config)).toContain('vel-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vel-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'velocity-tracking.tf',
      'velocity-tracking-manager.ts',
      'package.json',
      'VELOCITY_TRACKING.md',
      'velocity-tracking-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'velocity_tracking_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'velocity-tracking-config.json'), 'utf-8'));
    expect(json.projectName).toBe('vel-app');
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
