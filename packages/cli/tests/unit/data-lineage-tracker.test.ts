import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateLineageTrackerConfig,
  generateTypeScriptLineageTracker,
  generatePythonLineageTracker,
  writeLineageTrackerFiles,
  displayLineageTrackerConfig,
} from '../../src/utils/data-lineage-tracker';

describe('generateLineageTrackerConfig', () => {
  it('returns a config with defaults', async () => {
    const config = await generateLineageTrackerConfig('my-svc');
    expect(config.serviceName).toBe('my-svc');
    expect(config.enableVisualization).toBe(true);
    expect(config.defaultFormat).toBe('mermaid');
    expect(config.maxEvents).toBe(10000);
    expect(config.retentionDays).toBe(30);
    expect(config.enableMetrics).toBe(true);
  });

  it('accepts a custom format', async () => {
    const config = await generateLineageTrackerConfig('my-svc', 'dot');
    expect(config.defaultFormat).toBe('dot');
  });
});

describe('generateTypeScriptLineageTracker', () => {
  it('generates files', async () => {
    const config = await generateLineageTrackerConfig('my-svc');
    const result = await generateTypeScriptLineageTracker(config);
    expect(result.files.length).toBeGreaterThan(0);
    const allContent = result.files.map(f => f.content).join('\n');
    expect(allContent.length).toBeGreaterThan(100);
  });
});

describe('generatePythonLineageTracker', () => {
  it('generates Python files', async () => {
    const config = await generateLineageTrackerConfig('my-svc');
    const result = await generatePythonLineageTracker(config);
    expect(result.files.length).toBeGreaterThan(0);
  });
});

describe('writeLineageTrackerFiles', () => {
  it('writes integration files and BUILD.md', async () => {
    const config = await generateLineageTrackerConfig('my-svc');
    const integration = await generateTypeScriptLineageTracker(config);
    const tmpDir = path.join(os.tmpdir(), `lineage-test-${Date.now()}`);
    await writeLineageTrackerFiles('my-svc', integration, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'BUILD.md'))).toBe(true);
    for (const file of integration.files) {
      expect(fs.existsSync(path.join(tmpDir, file.path))).toBe(true);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayLineageTrackerConfig', () => {
  it('logs config without throwing', async () => {
    const config = await generateLineageTrackerConfig('my-svc');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(displayLineageTrackerConfig(config)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
