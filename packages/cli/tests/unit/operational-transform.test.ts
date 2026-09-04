import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateOperationalTransformMD,
  generateTerraformOperationalTransform,
  generateTypeScriptOperationalTransform,
  generatePythonOperationalTransform,
  writeFiles,
  operationalTransform,
} from '../../src/utils/operational-transform';

const config = {
  projectName: 'ot-app',
  providers: ['aws', 'gcp'] as const,
  transform: {
    enabled: true,
    algorithm: 'ot0' as const,
    conflictStrategy: 'operational-transform' as const,
    syncProtocol: 'websocket' as const,
    broadcast: true,
    delay: 0,
  },
  documentState: {
    version: 1,
    hash: 'abc123',
    participants: ['alice', 'bob'],
    locks: {},
  },
  features: {
    presence: true,
    cursors: true,
    selections: false,
    comments: true,
    suggestions: false,
  },
  enableReplay: true,
  enableConflictDetection: true,
  enableAutoMerge: false,
};

describe('operationalTransform passthrough', () => {
  it('returns the same config', () => {
    expect(operationalTransform(config)).toEqual(config);
  });
});

describe('generateOperationalTransformMD', () => {
  it('includes title and features section', () => {
    const md = generateOperationalTransformMD(config);
    expect(md).toContain('# Operational Transform');
    expect(md).toContain('## Features');
  });
});

describe('generateTerraformOperationalTransform', () => {
  it('emits terraform referencing project name', () => {
    expect(generateTerraformOperationalTransform(config)).toContain('ot-app');
  });
});

describe('generateTypeScriptOperationalTransform', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptOperationalTransform(config)).toContain('ot-app');
  });
});

describe('generatePythonOperationalTransform', () => {
  it('embeds project name', () => {
    expect(generatePythonOperationalTransform(config)).toContain('ot-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ot-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'operational-transform.tf',
      'operational-transform-manager.ts',
      'package.json',
      'OPERATIONAL_TRANSFORM.md',
      'operational-transform-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'operational_transform_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'operational-transform-config.json'), 'utf-8'));
    expect(json.projectName).toBe('ot-app');
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
