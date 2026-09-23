import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateResourceLifecycleMD,
  generateTerraformLifecycle,
  generateTypeScriptLifecycle,
  generatePythonLifecycle,
  writeFiles,
  resourceLifecycle,
} from '../../src/utils/resource-lifecycle';

const config = {
  projectName: 'lifecycle-app',
  providers: ['aws', 'azure'] as const,
  tagPolicy: {
    name: 'standard-tags',
    description: 'Required tagging for resources',
    requiredTags: [
      { key: 'env', value: 'prod', required: true, enforceOnCreate: true },
      { key: 'owner', value: 'platform', required: false, enforceOnCreate: false },
    ],
    enforceCompliance: true,
    autoRemediation: false,
  },
  lifecycleRules: [
    {
      name: 'archive-old-snapshots',
      resourceType: 's3' as const,
      transitionStates: [
        { state: 'archived' as const, trigger: 'daily', action: 'archive' },
      ],
      retentionPeriodDays: 90,
      notificationEnabled: true,
    },
  ],
  autoTagging: {
    enabled: true,
    rules: [
      { resourceType: 'ec2' as const, tags: [{ key: 'managed-by', value: 're-shell' }] },
    ],
    enforceOnCreation: true,
    blockNonCompliant: false,
  },
  enableScheduling: true,
  schedule: '0 2 * * *',
  notifications: {
    enabled: true,
    endpoints: ['https://hooks.example.com'],
  },
};

describe('resourceLifecycle passthrough', () => {
  it('returns the same config', () => {
    expect(resourceLifecycle(config)).toEqual(config);
  });
});

describe('generateResourceLifecycleMD', () => {
  it('includes title and tag policy', () => {
    const md = generateResourceLifecycleMD(config);
    expect(md).toContain('# Cloud Resource Tagging');
    expect(md).toContain('standard-tags');
  });

  it('lists required tags', () => {
    expect(generateResourceLifecycleMD(config)).toContain('env');
  });
});

describe('generateTerraformLifecycle', () => {
  it('emits terraform code referencing project name', () => {
    const tf = generateTerraformLifecycle(config);
    expect(tf).toContain('lifecycle-app');
  });
});

describe('generateTypeScriptLifecycle', () => {
  it('embeds project name', () => {
    expect(generateTypeScriptLifecycle(config)).toContain('lifecycle-app');
  });
});

describe('generatePythonLifecycle', () => {
  it('embeds project name', () => {
    expect(generatePythonLifecycle(config)).toContain('lifecycle-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lifecycle-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    for (const file of [
      'resource-lifecycle.tf',
      'resource-lifecycle-manager.ts',
      'package.json',
      'RESOURCE_LIFECYCLE.md',
      'lifecycle-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'resource_lifecycle_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'lifecycle-config.json'), 'utf-8'));
    expect(json.projectName).toBe('lifecycle-app');
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
