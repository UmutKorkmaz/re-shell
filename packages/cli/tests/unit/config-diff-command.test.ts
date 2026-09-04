import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';
import { manageConfigDiff } from '../../src/commands/config-diff';
import { ConfigDiffer } from '../../src/utils/config-diff';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/config-diff.ts — the `config-diff` command group
// (748 lines): diff / merge / apply / interactive / default status dispatch.
// The ConfigDiffer engine is mocked (utils config-diff has its own coverage);
// fs-extra reads/writes a REAL temp dir so file-based diff/merge/apply
// exercise genuine filesystem round-trips. prompts is mocked for the
// interactive sub-flows.

const mocks = vi.hoisted(() => ({
  diff: vi.fn(),
  merge: vi.fn(),
  applyDiff: vi.fn(),
  diffFiles: vi.fn(),
  generateDiffReport: vi.fn(),
  prompts: vi.fn(),
  loadGlobalConfig: vi.fn(),
  loadProjectConfig: vi.fn(),
  loadWorkspaceConfig: vi.fn(),
  getMergedConfig: vi.fn(),
}));

vi.mock('../../src/utils/config-diff', () => {
  const instance = {
    diff: mocks.diff,
    merge: mocks.merge,
    applyDiff: mocks.applyDiff,
    diffFiles: mocks.diffFiles,
    generateDiffReport: mocks.generateDiffReport,
  };
  return {
    ConfigDiffer: vi.fn(() => instance),
    configDiffer: instance,
    MergeStrategies: {
      leftWins: vi.fn(() => ({ arrayMerge: 'replace', conflictResolution: 'left' })),
      rightWins: vi.fn(() => ({ arrayMerge: 'replace', conflictResolution: 'right' })),
      smartMerge: vi.fn(() => ({ arrayMerge: 'union', conflictResolution: 'right' })),
      conservative: vi.fn(() => ({ arrayMerge: 'concat', conflictResolution: 'left' })),
      interactive: vi.fn(() => ({ arrayMerge: 'union', conflictResolution: 'interactive' })),
    },
  };
});

vi.mock('../../src/utils/config', () => ({
  configManager: {
    loadGlobalConfig: mocks.loadGlobalConfig,
    loadProjectConfig: mocks.loadProjectConfig,
    loadWorkspaceConfig: mocks.loadWorkspaceConfig,
    getMergedConfig: mocks.getMergedConfig,
  },
}));

vi.mock('prompts', () => ({ default: mocks.prompts }));

/** A diff with one added, one removed and one changed entry. */
function diffFixture(total = 3): Record<string, unknown> {
  return {
    summary: { total, added: 1, removed: 1, changed: 1, moved: 0 },
    changes: [
      { type: 'added', path: 'theme', leftValue: undefined, rightValue: 'dark' },
      { type: 'removed', path: 'legacy', leftValue: true, rightValue: undefined },
      { type: 'changed', path: 'port', leftValue: 3000, rightValue: 4000 },
    ],
    metadata: {
      comparedAt: '2026-01-01T00:00:00.000Z',
      leftSource: 'left.json',
      rightSource: 'right.json',
      algorithm: 'deep-recursive',
    },
  };
}

/** A clean merge result with no conflicts or warnings. */
function mergeFixture(): Record<string, unknown> {
  return {
    merged: { theme: 'dark', port: 4000 },
    conflicts: [],
    warnings: [],
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;
let tmpDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  tmpDir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'config-diff-cmd-'));

  mocks.diff.mockResolvedValue(diffFixture());
  mocks.merge.mockResolvedValue(mergeFixture());
  mocks.applyDiff.mockResolvedValue({ theme: 'dark', port: 4000 });
  mocks.diffFiles.mockResolvedValue(diffFixture());
  mocks.generateDiffReport.mockReturnValue('TEXT REPORT');
  mocks.loadGlobalConfig.mockResolvedValue({ packageManager: 'pnpm' });
  mocks.loadProjectConfig.mockResolvedValue({ packageManager: 'npm' });
  mocks.loadWorkspaceConfig.mockResolvedValue({ packageManager: 'yarn' });
  mocks.getMergedConfig.mockResolvedValue({
    merged: { packageManager: 'yarn', framework: 'react', template: 'default' },
  });
});

afterEach(() => {
  fsReal.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** All logged console output joined. */
function logged(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

describe('config-diff — command', () => {
  describe('diff', () => {
    it('throws a ValidationError when --left is missing', async () => {
      await expect(
        manageConfigDiff({ diff: true, right: 'global' })
      ).rejects.toThrow(ValidationError);
      await expect(
        manageConfigDiff({ diff: true, right: 'global' })
      ).rejects.toThrow('Both --left and --right');
    });

    it('throws a ValidationError when --right is missing', async () => {
      await expect(
        manageConfigDiff({ diff: true, left: 'global' })
      ).rejects.toThrow('Both --left and --right');
    });

    it('diffs two JSON files and renders the summary', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, JSON.stringify({ port: 3000 }));
      fsReal.writeFileSync(right, JSON.stringify({ port: 4000, theme: 'dark' }));

      await manageConfigDiff({ diff: true, left, right });

      expect(mocks.diff).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('TEXT REPORT');
      expect(logged()).toContain('Diff Summary');
      expect(logged()).toContain('Total changes: 3');
      expect(logged()).toContain('Added: 1 items');
      expect(logged()).toContain('Removed: 1 items');
      expect(logged()).toContain('Changed: 1 items');
    });

    it('diffs two YAML files', async () => {
      const left = path.join(tmpDir, 'a.yml');
      const right = path.join(tmpDir, 'b.yml');
      fsReal.writeFileSync(left, 'port: 3000\n');
      fsReal.writeFileSync(right, 'port: 4000\n');

      await manageConfigDiff({ diff: true, left, right });

      expect(mocks.diff).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('Total changes: 3');
    });

    it('renders identical-configurations message for a zero-change diff', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, '{}');
      fsReal.writeFileSync(right, '{}');
      mocks.diff.mockResolvedValueOnce(diffFixture(0));

      await manageConfigDiff({ diff: true, left, right });

      expect(logged()).toContain('Configurations are identical!');
    });

    it('emits the raw diff payload in json mode', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, '{}');
      fsReal.writeFileSync(right, '{}');

      await manageConfigDiff({ diff: true, left, right, json: true });

      const parsed = JSON.parse(
        logSpy.mock.calls.map(c => c.map(String).join('')).join('')
      );
      expect(parsed.summary.total).toBe(3);
    });

    it('writes an HTML report when format is html and output is set', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      const out = path.join(tmpDir, 'report.html');
      fsReal.writeFileSync(left, '{}');
      fsReal.writeFileSync(right, '{}');
      mocks.generateDiffReport.mockReturnValueOnce('<html>REPORT</html>');

      await manageConfigDiff({ diff: true, left, right, format: 'html', output: out });

      expect(fsReal.existsSync(out)).toBe(true);
      expect(fsReal.readFileSync(out, 'utf8')).toBe('<html>REPORT</html>');
      expect(logged()).toContain('HTML diff report saved');
    });

    it('rejects unknown file extensions', async () => {
      const bad = path.join(tmpDir, 'config.toml');
      fsReal.writeFileSync(bad, 'port = 3000\n');

      await expect(
        manageConfigDiff({ diff: true, left: bad, right: bad })
      ).rejects.toThrow('Unsupported file format');
    });

    it('rejects missing configuration sources', async () => {
      await expect(
        manageConfigDiff({
          diff: true,
          left: path.join(tmpDir, 'missing.json'),
          right: path.join(tmpDir, 'also-missing.json'),
        })
      ).rejects.toThrow('Configuration source not found');
    });

    it('resolves the project source and fails when absent', async () => {
      mocks.loadProjectConfig.mockResolvedValueOnce(null);
      await expect(
        manageConfigDiff({ diff: true, left: 'global', right: 'project' })
      ).rejects.toThrow('No project configuration found');
    });

    it('resolves the workspace:source and fails when absent', async () => {
      mocks.loadWorkspaceConfig.mockResolvedValueOnce(null);
      await expect(
        manageConfigDiff({ diff: true, left: 'global', right: 'workspace:/nope' })
      ).rejects.toThrow('No workspace configuration found');
    });
  });

  describe('merge', () => {
    it('throws a ValidationError when sources are missing', async () => {
      await expect(manageConfigDiff({ merge: true })).rejects.toThrow(
        'Both --left and --right'
      );
    });

    it('merges two files and renders the merged config with no-conflict summary', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, '{"port":3000}');
      fsReal.writeFileSync(right, '{"port":4000}');

      await manageConfigDiff({ merge: true, left, right });

      expect(mocks.merge).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('Merged Configuration');
      expect(logged()).toContain('No conflicts detected');
    });

    it('writes the merged config to --output as JSON', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      const out = path.join(tmpDir, 'merged.json');
      fsReal.writeFileSync(left, '{"port":3000}');
      fsReal.writeFileSync(right, '{"port":4000}');

      await manageConfigDiff({ merge: true, left, right, output: out });

      const written = JSON.parse(fsReal.readFileSync(out, 'utf8'));
      expect(written.theme).toBe('dark');
      expect(logged()).toContain('Merged configuration saved');
    });

    it('writes the merged config to --output as YAML for other extensions', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      const out = path.join(tmpDir, 'merged.yaml');
      fsReal.writeFileSync(left, '{"port":3000}');
      fsReal.writeFileSync(right, '{"port":4000}');

      await manageConfigDiff({ merge: true, left, right, output: out });

      expect(fsReal.readFileSync(out, 'utf8')).toContain('theme: dark');
      expect(logged()).toContain('Merged configuration saved');
    });

    it('lists conflicts and warnings in the merge summary', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, '{"port":3000}');
      fsReal.writeFileSync(right, '{"port":4000}');
      mocks.merge.mockResolvedValueOnce({
        merged: { port: 4000 },
        conflicts: [
          {
            path: 'port',
            reason: 'both sides changed',
            resolution: 'right',
            leftValue: 3000,
            rightValue: 4000,
          },
        ],
        warnings: ['array order differs'],
      });

      await manageConfigDiff({ merge: true, left, right });

      expect(logged()).toContain('Conflicts: 1');
      expect(logged()).toContain('port: both sides changed (right)');
      expect(logged()).toContain('Warnings: 1');
      expect(logged()).toContain('array order differs');
    });

    it('rejects unknown merge strategies', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, '{}');
      fsReal.writeFileSync(right, '{}');

      await expect(
        manageConfigDiff({ merge: true, left, right, strategy: 'bogus' })
      ).rejects.toThrow('Unknown merge strategy: bogus');
    });

    it('resolves conflicts interactively when the strategy demands it', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, '{"port":3000}');
      fsReal.writeFileSync(right, '{"port":4000}');
      mocks.merge.mockResolvedValueOnce({
        merged: { port: 3000 },
        conflicts: [
          {
            path: 'port',
            reason: 'both sides changed',
            resolution: 'unresolved',
            leftValue: 3000,
            rightValue: 4000,
          },
        ],
        warnings: [],
      });

      mocks.prompts
        .mockResolvedValueOnce({ resolution: 'left' });
      await manageConfigDiff({ merge: true, left, right, strategy: 'interactive' });

      // The conflict prompt runs and the left value is applied to merged.
      expect(mocks.prompts).toHaveBeenCalled();
      expect(mocks.merge.mock.calls[0][2]).toMatchObject({
        conflictResolution: 'interactive',
      });
    });
  });

  describe('apply', () => {
    it('falls through to status when --apply has no --left', async () => {
      await manageConfigDiff({ apply: true });
      // The status view itself diffs global vs project for the inheritance
      // analysis, so diff runs once — but applyDiff never does.
      expect(mocks.applyDiff).not.toHaveBeenCalled();
      expect(logged()).toContain('Configuration Status');
    });

    it('applies a JSON diff file to a base config and writes the result', async () => {
      const base = path.join(tmpDir, 'base.json');
      const diffFile = path.join(tmpDir, 'patch.json');
      const out = path.join(tmpDir, 'applied.json');
      fsReal.writeFileSync(base, '{"port":3000}');
      fsReal.writeFileSync(
        diffFile,
        JSON.stringify({
          summary: { total: 2, added: 1, removed: 0, changed: 1, moved: 0 },
          changes: [],
          metadata: {},
        })
      );

      await manageConfigDiff({ apply: true, left: base, right: diffFile, output: out });

      expect(mocks.applyDiff).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fsReal.readFileSync(out, 'utf8')).theme).toBe('dark');
      expect(logged()).toContain('Applied 2 changes from diff');
    });

    it('prints the applied config as YAML when the output has a non-json extension', async () => {
      const base = path.join(tmpDir, 'base.json');
      const diffFile = path.join(tmpDir, 'patch.json');
      const out = path.join(tmpDir, 'applied.yaml');
      fsReal.writeFileSync(base, '{"port":3000}');
      fsReal.writeFileSync(
        diffFile,
        JSON.stringify({
          summary: { total: 1, added: 0, removed: 0, changed: 1, moved: 0 },
          changes: [],
          metadata: {},
        })
      );

      await manageConfigDiff({ apply: true, left: base, right: diffFile, output: out });

      expect(fsReal.readFileSync(out, 'utf8')).toContain('theme: dark');
    });

    it('rethrows malformed diff JSON as a parse error', async () => {
      const baseFile = path.join(tmpDir, 'base.json');
      const diffFile = path.join(tmpDir, 'bad.json');
      fsReal.writeFileSync(baseFile, '{"port":3000}');
      fsReal.writeFileSync(diffFile, 'not json');

      await expect(
        manageConfigDiff({ apply: true, left: baseFile, right: diffFile })
      ).rejects.toThrow();
    });
  });

  describe('interactive', () => {
    it('dispatches to the diff flow when diff is chosen', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      fsReal.writeFileSync(left, '{"port":3000}');
      fsReal.writeFileSync(right, '{"port":4000}');
      mocks.prompts
        .mockResolvedValueOnce({ operation: 'diff' })
        .mockResolvedValueOnce({ left, right, format: 'text', ignoreOrder: false, output: undefined });

      await manageConfigDiff({ interactive: true });

      expect(mocks.diff).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('Total changes: 3');
    });

    it('dispatches to the merge flow when merge is chosen', async () => {
      const left = path.join(tmpDir, 'left.json');
      const right = path.join(tmpDir, 'right.json');
      const out = path.join(tmpDir, 'merged.json');
      fsReal.writeFileSync(left, '{"port":3000}');
      fsReal.writeFileSync(right, '{"port":4000}');
      mocks.prompts
        .mockResolvedValueOnce({ operation: 'merge' })
        .mockResolvedValueOnce({ left, right, strategy: 'smart', output: out });

      await manageConfigDiff({ interactive: true });

      expect(mocks.merge).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('Merged configuration saved');
    });

    it('dispatches to the apply flow when apply is chosen', async () => {
      const base = path.join(tmpDir, 'base.json');
      const diffFile = path.join(tmpDir, 'patch.json');
      const out = path.join(tmpDir, 'applied.json');
      fsReal.writeFileSync(base, '{"port":3000}');
      fsReal.writeFileSync(
        diffFile,
        JSON.stringify({
          summary: { total: 1, added: 0, removed: 0, changed: 1, moved: 0 },
          changes: [],
          metadata: {},
        })
      );
      mocks.prompts
        .mockResolvedValueOnce({ operation: 'apply' })
        .mockResolvedValueOnce({ config: base, diff: diffFile, output: out });

      await manageConfigDiff({ interactive: true });

      expect(mocks.applyDiff).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('Applied 1 changes from diff');
    });

    it('dispatches to the levels flow when levels is chosen', async () => {
      mocks.prompts
        .mockResolvedValueOnce({ operation: 'levels' })
        .mockResolvedValueOnce({ workspace: '/tmp/ws' });

      await manageConfigDiff({ interactive: true });

      expect(mocks.diff).toHaveBeenCalledTimes(2);
      expect(logged()).toContain('Global vs Project');
      expect(logged()).toContain('Project vs Workspace');
      expect(logged()).toContain('Final Configuration Source');
      expect(logged()).toContain('Package Manager: yarn (from workspace)');
    });

    it('dispatches to the patch flow when patch is chosen', async () => {
      const original = path.join(tmpDir, 'original.json');
      const modified = path.join(tmpDir, 'modified.json');
      const patchOut = path.join(tmpDir, 'config.patch.json');
      fsReal.writeFileSync(original, '{"port":3000}');
      fsReal.writeFileSync(modified, '{"port":4000}');
      mocks.prompts
        .mockResolvedValueOnce({ operation: 'patch' })
        .mockResolvedValueOnce({ original, modified, output: patchOut });

      await manageConfigDiff({ interactive: true });

      expect(mocks.diffFiles).toHaveBeenCalledWith(original, modified);
      expect(JSON.parse(fsReal.readFileSync(patchOut, 'utf8')).summary.total).toBe(3);
      expect(logged()).toContain('Patch created');
    });

    it('does nothing when the operation prompt is cancelled', async () => {
      mocks.prompts.mockResolvedValueOnce({});
      await manageConfigDiff({ interactive: true });
      expect(mocks.diff).not.toHaveBeenCalled();
      expect(mocks.merge).not.toHaveBeenCalled();
    });
  });
});
