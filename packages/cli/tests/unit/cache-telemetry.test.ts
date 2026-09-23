import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  readCacheTelemetry,
  resetCacheTelemetry,
  recordCacheTelemetry,
} from '../../src/utils/cache-telemetry';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-tel-'));
});

afterEach(async () => {
  await fs.remove(tmpDir);
});

describe('readCacheTelemetry', () => {
  it('returns zeros when telemetry file does not exist', async () => {
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 0, misses: 0 });
  });

  it('reads persisted counters from file', async () => {
    await fs.writeJson(path.join(tmpDir, 'telemetry.json'), {
      hits: 42,
      misses: 7,
    });
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 42, misses: 7 });
  });

  it('returns zeros when file is malformed JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'telemetry.json'), 'not json');
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 0, misses: 0 });
  });

  it('clamps negative hits to zero', async () => {
    await fs.writeJson(path.join(tmpDir, 'telemetry.json'), {
      hits: -10,
      misses: 5,
    });
    const result = await readCacheTelemetry(tmpDir);
    expect(result.hits).toBe(0);
    expect(result.misses).toBe(5);
  });

  it('clamps negative misses to zero', async () => {
    await fs.writeJson(path.join(tmpDir, 'telemetry.json'), {
      hits: 5,
      misses: -3,
    });
    const result = await readCacheTelemetry(tmpDir);
    expect(result.hits).toBe(5);
    expect(result.misses).toBe(0);
  });

  it('returns zeros when hits/misses are non-numeric', async () => {
    await fs.writeJson(path.join(tmpDir, 'telemetry.json'), {
      hits: 'abc',
      misses: null,
    });
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 0, misses: 0 });
  });
});

describe('resetCacheTelemetry', () => {
  it('removes the telemetry file', async () => {
    await fs.writeJson(path.join(tmpDir, 'telemetry.json'), {
      hits: 10,
      misses: 5,
    });
    await resetCacheTelemetry(tmpDir);
    const exists = await fs.pathExists(path.join(tmpDir, 'telemetry.json'));
    expect(exists).toBe(false);
  });

  it('does not throw when file does not exist', async () => {
    await expect(resetCacheTelemetry(tmpDir)).resolves.toBeUndefined();
  });

  it('does not throw when directory does not exist', async () => {
    const gone = path.join(tmpDir, 'nonexistent');
    await expect(resetCacheTelemetry(gone)).resolves.toBeUndefined();
  });
});

describe('recordCacheTelemetry', () => {
  it('creates telemetry file with initial deltas', async () => {
    await recordCacheTelemetry(tmpDir, { hits: 3, misses: 1 });
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 3, misses: 1 });
  });

  it('accumulates deltas on existing counters', async () => {
    await fs.writeJson(path.join(tmpDir, 'telemetry.json'), {
      hits: 10,
      misses: 5,
    });
    await recordCacheTelemetry(tmpDir, { hits: 5, misses: 2 });
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 15, misses: 7 });
  });

  it('is a no-op when both deltas are zero', async () => {
    await recordCacheTelemetry(tmpDir, { hits: 0, misses: 0 });
    const exists = await fs.pathExists(path.join(tmpDir, 'telemetry.json'));
    expect(exists).toBe(false);
  });

  it('records only hits when misses is zero', async () => {
    await recordCacheTelemetry(tmpDir, { hits: 4, misses: 0 });
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 4, misses: 0 });
  });

  it('records only misses when hits is zero', async () => {
    await recordCacheTelemetry(tmpDir, { hits: 0, misses: 6 });
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 0, misses: 6 });
  });

  it('accumulates across multiple calls', async () => {
    await recordCacheTelemetry(tmpDir, { hits: 1, misses: 1 });
    await recordCacheTelemetry(tmpDir, { hits: 2, misses: 3 });
    await recordCacheTelemetry(tmpDir, { hits: 0, misses: 1 });
    const result = await readCacheTelemetry(tmpDir);
    expect(result).toEqual({ hits: 3, misses: 5 });
  });

  it('creates parent directory if it does not exist', async () => {
    const nested = path.join(tmpDir, 'nested', 'cache');
    await recordCacheTelemetry(nested, { hits: 1, misses: 0 });
    const result = await readCacheTelemetry(nested);
    expect(result).toEqual({ hits: 1, misses: 0 });
  });
});
