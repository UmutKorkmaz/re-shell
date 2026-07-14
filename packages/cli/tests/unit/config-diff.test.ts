import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  ConfigDiffer,
  MergeStrategies,
  configDiffer,
  type MergeStrategy,
} from '../../src/utils/config-diff';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-cfgdiff-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('ConfigDiffer', () => {
  describe('diff', () => {
    it('should report no changes for identical objects', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff({ a: 1 }, { a: 1 });
      expect(result.summary.total).toBe(0);
      expect(result.changes).toHaveLength(0);
    });

    it('should detect added property', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff({ a: 1 }, { a: 1, b: 2 });
      expect(result.summary.added).toBe(1);
      expect(result.changes.some(c => c.operation === 'add' && c.path === 'b')).toBe(true);
    });

    it('should detect removed property', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff({ a: 1, b: 2 }, { a: 1 });
      expect(result.summary.removed).toBe(1);
      expect(result.changes.some(c => c.operation === 'remove' && c.path === 'b')).toBe(true);
    });

    it('should detect changed primitive value', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff({ a: 1 }, { a: 2 });
      expect(result.summary.changed).toBe(1);
      const change = result.changes.find(c => c.operation === 'change');
      expect(change).toBeDefined();
      expect(change!.oldValue).toBe(1);
      expect(change!.newValue).toBe(2);
    });

    it('should detect type change', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff({ a: 1 }, { a: 'hello' });
      const change = result.changes.find(c => c.operation === 'change');
      expect(change).toBeDefined();
      expect(change!.type).toContain('number');
      expect(change!.type).toContain('string');
    });

    it('should diff nested objects', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff(
        { obj: { a: 1, b: 2 } },
        { obj: { a: 1, b: 3 } },
      );
      const change = result.changes.find(c => c.path === 'obj.b');
      expect(change).toBeDefined();
      expect(change!.operation).toBe('change');
    });

    it('should diff arrays with order', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff(
        { arr: [1, 2, 3] },
        { arr: [1, 2, 4] },
      );
      const change = result.changes.find(c => c.path === 'arr[2]');
      expect(change).toBeDefined();
    });

    it('should diff arrays ignoring order when configured', async () => {
      const differ = new ConfigDiffer({ ignoreOrder: true });
      const result = await differ.diff(
        { arr: [1, 2, 3] },
        { arr: [3, 2, 1] },
      );
      expect(result.summary.total).toBe(0);
    });

    it('should detect added array element (ignoreOrder)', async () => {
      const differ = new ConfigDiffer({ ignoreOrder: true });
      const result = await differ.diff(
        { arr: [1, 2] },
        { arr: [1, 2, 3] },
      );
      expect(result.summary.added).toBe(1);
    });

    it('should detect removed array element (ignoreOrder)', async () => {
      const differ = new ConfigDiffer({ ignoreOrder: true });
      const result = await differ.diff(
        { arr: [1, 2, 3] },
        { arr: [1, 2] },
      );
      expect(result.summary.removed).toBe(1);
    });

    it('should ignore paths when configured', async () => {
      const differ = new ConfigDiffer({ ignorePaths: ['meta'] });
      const result = await differ.diff(
        { meta: { version: 1 }, data: 'same' },
        { meta: { version: 2 }, data: 'same' },
      );
      expect(result.summary.total).toBe(0);
    });

    it('should set critical severity for version path', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff({ version: 1 }, { version: 2 });
      const change = result.changes[0];
      expect(change.severity).toBe('critical');
    });

    it('should set metadata with sources', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.diff({ a: 1 }, { a: 2 }, 'left.yml', 'right.yml');
      expect(result.metadata.leftSource).toBe('left.yml');
      expect(result.metadata.rightSource).toBe('right.yml');
      expect(result.metadata.algorithm).toBe('deep-recursive');
    });
  });

  describe('merge', () => {
    it('should merge with left-wins strategy', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.merge(
        { a: 1 },
        { a: 2 },
        MergeStrategies.leftWins(),
      );
      expect(result.merged.a).toBe(1);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].resolution).toBe('left');
    });

    it('should merge with right-wins strategy', async () => {
      const differ = new ConfigDiffer();
      const result = await defer_merge(differ, { a: 1 }, { a: 2 }, MergeStrategies.rightWins());
      expect(result.merged.a).toBe(2);
      expect(result.conflicts[0].resolution).toBe('right');
    });

    it('should merge non-conflicting keys from both', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.merge(
        { a: 1 },
        { b: 2 },
        MergeStrategies.leftWins(),
      );
      expect(result.merged).toEqual({ a: 1, b: 2 });
      expect(result.conflicts).toHaveLength(0);
    });

    it('should merge arrays with concat strategy', async () => {
      const differ = new ConfigDiffer();
      const strategy: MergeStrategy = {
        arrayMerge: 'concat',
        conflictResolution: 'left',
        preserveComments: true,
        preserveOrder: true,
      };
      const result = await differ.merge({ arr: [1, 2] }, { arr: [3, 4] }, strategy);
      expect(result.merged.arr).toEqual([1, 2, 3, 4]);
    });

    it('should merge arrays with union strategy', async () => {
      const differ = new ConfigDiffer();
      const strategy: MergeStrategy = {
        arrayMerge: 'union',
        conflictResolution: 'left',
        preserveComments: true,
        preserveOrder: true,
      };
      const result = await differ.merge({ arr: [1, 2] }, { arr: [2, 3] }, strategy);
      expect(result.merged.arr).toHaveLength(3);
      expect(result.merged.arr).toContain(1);
      expect(result.merged.arr).toContain(2);
      expect(result.merged.arr).toContain(3);
    });

    it('should merge arrays with replace strategy', async () => {
      const differ = new ConfigDiffer();
      const strategy: MergeStrategy = {
        arrayMerge: 'replace',
        conflictResolution: 'right',
        preserveComments: true,
        preserveOrder: true,
      };
      const result = await differ.merge({ arr: [1, 2] }, { arr: [3, 4] }, strategy);
      expect(result.merged.arr).toEqual([3, 4]);
    });

    it('should merge arrays with intersect strategy', async () => {
      const differ = new ConfigDiffer();
      const strategy: MergeStrategy = {
        arrayMerge: 'intersect',
        conflictResolution: 'left',
        preserveComments: true,
        preserveOrder: true,
      };
      const result = await differ.merge({ arr: [1, 2, 3] }, { arr: [2, 3, 4] }, strategy);
      expect(result.merged.arr).toHaveLength(2);
      expect(result.merged.arr).toContain(2);
      expect(result.merged.arr).toContain(3);
    });

    it('should handle type mismatch conflicts in merge', async () => {
      const differ = new ConfigDiffer();
      const result = await differ.merge(
        { a: 1 },
        { a: 'string' },
        MergeStrategies.leftWins(),
      );
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].reason).toContain('Type mismatch');
    });

    it('should use custom resolver when provided', async () => {
      const differ = new ConfigDiffer();
      const strategy: MergeStrategy = {
        arrayMerge: 'custom',
        conflictResolution: 'custom',
        preserveComments: true,
        preserveOrder: true,
        customResolver: (left, right) => `${left}-${right}`,
      };
      const result = await differ.merge({ a: 'hello' }, { a: 'world' }, strategy);
      expect(result.merged.a).toBe('hello-world');
    });
  });

  describe('diffFiles', () => {
    it('should diff two YAML files', async () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'left.yaml'), 'a: 1\nb: 2\n');
      writeFileSync(join(dir, 'right.yaml'), 'a: 1\nb: 3\n');

      const differ = new ConfigDiffer();
      const result = await differ.diffFiles(
        join(dir, 'left.yaml'),
        join(dir, 'right.yaml'),
      );
      expect(result.summary.changed).toBe(1);
    });

    it('should throw on missing file', async () => {
      const differ = new ConfigDiffer();
      await expect(differ.diffFiles('/nonexistent1', '/nonexistent2')).rejects.toThrow();
    });
  });

  describe('applyDiff', () => {
    it('should apply add operations', async () => {
      const differ = new ConfigDiffer();
      const diff = await differ.diff({ a: 1 }, { a: 1, b: 2 });
      const result = await differ.applyDiff({ a: 1 }, diff);
      expect((result as any).b).toBe(2);
    });

    it('should apply remove operations', async () => {
      const differ = new ConfigDiffer();
      const diff = await differ.diff({ a: 1, b: 2 }, { a: 1 });
      const result = await differ.applyDiff({ a: 1, b: 2 }, diff);
      expect((result as any).b).toBeUndefined();
    });

    it('should apply change operations', async () => {
      const differ = new ConfigDiffer();
      const diff = await differ.diff({ a: 1 }, { a: 2 });
      const result = await differ.applyDiff({ a: 1 }, diff);
      expect((result as any).a).toBe(2);
    });
  });

  describe('generateDiffReport', () => {
    it('should generate text report', async () => {
      const differ = new ConfigDiffer();
      const diff = await differ.diff({ a: 1 }, { a: 2 });
      const report = differ.generateDiffReport(diff, 'text');
      expect(report).toContain('Configuration Diff Report');
      expect(report).toContain('Summary');
    });

    it('should generate JSON report', async () => {
      const differ = new ConfigDiffer();
      const diff = await differ.diff({ a: 1 }, { a: 2 });
      const report = differ.generateDiffReport(diff, 'json');
      const parsed = JSON.parse(report);
      expect(parsed.summary.changed).toBe(1);
    });

    it('should generate HTML report', async () => {
      const differ = new ConfigDiffer();
      const diff = await differ.diff({ a: 1 }, { a: 2 });
      const report = differ.generateDiffReport(diff, 'html');
      expect(report).toContain('<html>');
      expect(report).toContain('Configuration Diff Report');
    });
  });

  describe('MergeStrategies', () => {
    it('should create leftWins strategy', () => {
      const strategy = MergeStrategies.leftWins();
      expect(strategy.conflictResolution).toBe('left');
      expect(strategy.arrayMerge).toBe('replace');
    });

    it('should create rightWins strategy', () => {
      const strategy = MergeStrategies.rightWins();
      expect(strategy.conflictResolution).toBe('right');
    });

    it('should create smartMerge strategy', () => {
      const strategy = MergeStrategies.smartMerge();
      expect(strategy.arrayMerge).toBe('union');
      expect(strategy.preserveOrder).toBe(false);
    });

    it('should create conservative strategy', () => {
      const strategy = MergeStrategies.conservative();
      expect(strategy.arrayMerge).toBe('concat');
      expect(strategy.conflictResolution).toBe('left');
    });

    it('should create interactive strategy', () => {
      const strategy = MergeStrategies.interactive();
      expect(strategy.conflictResolution).toBe('interactive');
    });
  });

  describe('singleton instance', () => {
    it('should be a ConfigDiffer instance', () => {
      expect(configDiffer).toBeInstanceOf(ConfigDiffer);
    });
  });
});

// Helper to avoid name shadowing
async function defer_merge(
  differ: ConfigDiffer,
  left: any,
  right: any,
  strategy: MergeStrategy,
) {
  return differ.merge(left, right, strategy);
}
