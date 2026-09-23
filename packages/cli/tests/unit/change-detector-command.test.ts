import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';
import { manageChangeDetector } from '../../src/commands/change-detector';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/change-detector.ts — the `change-detector` command group
// (762 lines): scan / status / stats / check / clear / watch / compare /
// interactive dispatch. The ChangeDetector engine is mocked (its own 23-test
// suite covers the util); fs.pathExists reads a REAL temp dir so the
// path-validation and verbose cache-stat branches exercise genuine filesystem
// checks. The watch subcommand registers an interval + SIGINT handler — tested
// via fake timers, and the handler is removed after each test.

const mocks = vi.hoisted(() => ({
  detectChanges: vi.fn(),
  createChangeDetector: vi.fn(),
  hasFileChanged: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/change-detector', () => ({
  detectChanges: mocks.detectChanges,
  createChangeDetector: mocks.createChangeDetector,
}));

vi.mock('prompts', () => ({ default: mocks.prompts }));

/** A healthy scan-result fixture. */
function scanFixture(): Record<string, unknown> {
  return {
    totalChanges: 3,
    added: ['src/new-file.ts', 'src/other.ts'],
    modified: ['src/changed.ts'],
    deleted: [],
    moved: [{ from: 'a.ts', to: 'b.ts' }],
    scanTime: 120,
    hashingTime: 40,
  };
}

/** A green cache-stats fixture. */
function statsFixture(): Record<string, unknown> {
  return {
    cacheSize: 12,
    totalFiles: 34,
    memoryUsage: 1024,
    hitRate: 87.5,
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;
let tmpDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  tmpDir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'change-det-cmd-'));

  mocks.createChangeDetector.mockResolvedValue({
    getCacheStats: vi.fn().mockReturnValue(statsFixture()),
    detectChanges: vi.fn().mockResolvedValue(scanFixture()),
    hasFileChanged: vi.fn().mockResolvedValue(false),
    getFileChanges: vi.fn().mockResolvedValue(null),
    getFileHash: vi.fn().mockResolvedValue(null),
    clearCache: vi.fn().mockResolvedValue(undefined),
  });

  mocks.detectChanges.mockResolvedValue(scanFixture());
});

afterEach(() => {
  // Remove any SIGINT handlers the watch subcommand registered.
  process.removeAllListeners('SIGINT');
  vi.useRealTimers();
  vi.restoreAllMocks();
  fsReal.rmSync(tmpDir, { recursive: true, force: true });
});

/** All logged console output joined. */
function logged(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

/** The most recent detector instance the factory resolved with. */
async function detector(): Promise<Record<string, ReturnType<typeof vi.fn>>> {
  const result = mocks.createChangeDetector.mock.results.at(-1);
  if (!result) throw new Error('createChangeDetector was not called');
  return (await result.value) as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

/** A fresh detector-instance stub (matches the beforeEach default). */
function detectorStub(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    getCacheStats: vi.fn().mockReturnValue(statsFixture()),
    detectChanges: vi.fn().mockResolvedValue(scanFixture()),
    hasFileChanged: vi.fn().mockResolvedValue(false),
    getFileChanges: vi.fn().mockResolvedValue(null),
    getFileHash: vi.fn().mockResolvedValue(null),
    clearCache: vi.fn().mockResolvedValue(undefined),
  };
}

describe('change-detector — command', () => {
  describe('scan (explicit and default)', () => {
    it('throws a ValidationError when the target path does not exist', async () => {
      await expect(
        manageChangeDetector({ scan: true, path: '/nonexistent-dir-xyz' })
      ).rejects.toThrow(ValidationError);
      await expect(
        manageChangeDetector({ scan: true, path: '/nonexistent-dir-xyz' })
      ).rejects.toThrow('Path does not exist');
    });

    it('renders added/modified/moved sections and performance metrics', async () => {
      await manageChangeDetector({ scan: true, path: tmpDir });
      expect(logged()).toContain('Change Detection Results');
      expect(logged()).toContain('Total changes: 3');
      expect(logged()).toContain('Added files:');
      expect(logged()).toContain('+ src/new-file.ts');
      expect(logged()).toContain('Modified files:');
      expect(logged()).toContain('~ src/changed.ts');
      expect(logged()).toContain('Moved files:');
      expect(logged()).toContain('a.ts → b.ts');
      expect(logged()).toContain('Performance:');
      expect(logged()).toContain('Scan time:');
    });

    it('renders the no-changes message for a clean scan', async () => {
      mocks.detectChanges.mockResolvedValueOnce({
        ...scanFixture(),
        totalChanges: 0,
        added: [],
        modified: [],
        deleted: [],
        moved: [],
      });
      await manageChangeDetector({ scan: true, path: tmpDir });
      expect(logged()).toContain('No changes detected');
    });

    it('defaults to a scan when no subcommand is given', async () => {
      await manageChangeDetector({ path: tmpDir });
      expect(logged()).toContain('Change Detection Results');
    });

    it('emits the raw result as JSON in json mode', async () => {
      await manageChangeDetector({ scan: true, path: tmpDir, json: true });
      const parsed = JSON.parse(
        logSpy.mock.calls.map(c => c.map(String).join('')).join('')
      );
      expect(parsed.totalChanges).toBe(3);
      expect(parsed.added).toEqual(['src/new-file.ts', 'src/other.ts']);
    });

    it('passes merged detection options to the engine', async () => {
      await manageChangeDetector({
        scan: true,
        path: tmpDir,
        useHashing: false,
        metadataOnly: true,
        maxDepth: 3,
        algorithm: 'md5',
      });
      expect(mocks.detectChanges).toHaveBeenCalledWith(
        tmpDir,
        expect.objectContaining({
          useContentHashing: false,
          useMetadataOnly: true,
          recursiveDepth: 3,
          hashingOptions: expect.objectContaining({ algorithm: 'md5' }),
        })
      );
    });

    it('wraps engine failures in the spinner failure', async () => {
      mocks.detectChanges.mockRejectedValueOnce(new Error('fs blew up'));
      await expect(
        manageChangeDetector({ scan: true, path: tmpDir })
      ).rejects.toThrow('fs blew up');
    });
  });

  describe('status', () => {
    it('renders cache statistics for the target path', async () => {
      await manageChangeDetector({ status: true, path: tmpDir });
      expect(logged()).toContain('Change Detector Status');
      expect(logged()).toContain(`Target path: ${tmpDir}`);
      expect(logged()).toContain('Cached files: 12');
      expect(logged()).toContain('Total tracked: 34');
      expect(logged()).toContain('Cache hit rate: 87.5%');
    });

    it('emits the status envelope as JSON in json mode', async () => {
      await manageChangeDetector({ status: true, path: tmpDir, json: true });
      const parsed = JSON.parse(
        logSpy.mock.calls.map(c => c.map(String).join('')).join('')
      );
      expect(parsed.path).toBe(tmpDir);
      expect(parsed.cacheEnabled).toBe(true);
      expect(parsed.stats.cacheSize).toBe(12);
    });

    it('reports the cache file as not-created in verbose mode', async () => {
      await manageChangeDetector({ status: true, path: tmpDir, verbose: true });
      expect(logged()).toContain('Not created yet');
    });

    it('reports the cache file size when the cache file exists', async () => {
      const cachePath = path.join(tmpDir, '.re-shell', 'change-cache.json');
      fsReal.mkdirSync(path.dirname(cachePath), { recursive: true });
      fsReal.writeFileSync(cachePath, '{}');
      await manageChangeDetector({ status: true, path: tmpDir, verbose: true });
      expect(logged()).toContain('Cache file size:');
      expect(logged()).toContain('Last updated:');
    });
  });

  describe('stats', () => {
    it('renders cache performance, last scan and files-per-second', async () => {
      await manageChangeDetector({ stats: true, path: tmpDir });
      expect(logged()).toContain('Change Detection Statistics');
      expect(logged()).toContain('Hit rate: 87.5%');
      expect(logged()).toContain('Total changes: 3');
      expect(logged()).toContain('Files/second:');
      expect(logged()).toContain('Hashing efficiency: 33.3%');
    });

    it('emits cacheStats + lastScan as JSON in json mode', async () => {
      await manageChangeDetector({ stats: true, path: tmpDir, json: true });
      const parsed = JSON.parse(
        logSpy.mock.calls.map(c => c.map(String).join('')).join('')
      );
      expect(parsed.cacheStats.cacheSize).toBe(12);
      expect(parsed.lastScan.totalChanges).toBe(3);
    });
  });

  describe('check', () => {
    it('returns silently when the interactive check prompt yields no path', async () => {
      // The dispatch gate `if (options.check)` means an empty/undefined check
      // string never reaches checkFileChanges directly — the only reachable
      // no-path route is checkFileInteractive bailing on its prompt answer.
      mocks.prompts
        .mockResolvedValueOnce({ action: 'check' })
        .mockResolvedValueOnce({});
      await manageChangeDetector({ interactive: true, path: tmpDir });
      expect(mocks.createChangeDetector).not.toHaveBeenCalled();
    });

    it('renders the unchanged status when the file is clean', async () => {
      await manageChangeDetector({ check: 'src/a.ts', path: tmpDir });
      expect(logged()).toContain('File Change Analysis');
      expect(logged()).toContain('File: src/a.ts');
      expect(logged()).toContain('Changed: No');
    });

    it('renders hash, size, mtime and change details when present', async () => {
      mocks.createChangeDetector.mockReset().mockResolvedValue({
        ...detectorStub(),
        hasFileChanged: vi.fn().mockResolvedValue(true),
        getFileHash: vi.fn().mockResolvedValue({
          hash: 'abcdef1234567890abcdef',
          size: 2048,
          mtime: 1700000000000,
        }),
        getFileChanges: vi.fn().mockResolvedValue({
          type: 'modified',
          oldHash: '1111111111111111',
          hash: '2222222222222222',
          metadata: { size: 2048 },
          timestamp: 1700000000000,
        }),
      });
      await manageChangeDetector({ check: 'src/a.ts', path: tmpDir });
      expect(logged()).toContain('Changed: Yes');
      // The command truncates hashes to 16 chars and appends a literal '...'.
      expect(logged()).toContain('Current hash: abcdef1234567890...');
      expect(logged()).toContain('Size: 2 KB');
      expect(logged()).toContain('Change type: 📝 modified');
      expect(logged()).toContain('Hash changed: 1111111111111111...');
    });

    it('emits the file analysis as JSON in json mode', async () => {
      await manageChangeDetector({ check: 'src/a.ts', path: tmpDir, json: true });
      const parsed = JSON.parse(
        logSpy.mock.calls.map(c => c.map(String).join('')).join('')
      );
      expect(parsed.file).toBe('src/a.ts');
      expect(parsed.hasChanged).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears the cache and confirms', async () => {
      await manageChangeDetector({ clear: true, path: tmpDir });
      const d = await detector();
      expect(d.clearCache).toHaveBeenCalledTimes(1);
      expect(logged()).toContain('cache cleared successfully');
    });
  });

  describe('watch', () => {
    it('announces monitoring and reports changes on each interval tick', async () => {
      const p = manageChangeDetector({ watch: true, path: tmpDir });
      await vi.advanceTimersByTimeAsync(0);
      expect(logged()).toContain('Watching for changes');
      await vi.advanceTimersByTimeAsync(5000);
      expect(logged()).toContain('Changes detected: 3');
      await p;
    });

    it('stays quiet between ticks when nothing changed (non-verbose)', async () => {
      mocks.createChangeDetector.mockResolvedValueOnce({
        ...detectorStub(),
        detectChanges: vi.fn().mockResolvedValue({
          ...scanFixture(),
          totalChanges: 0,
          added: [],
          modified: [],
          deleted: [],
          moved: [],
        }),
      });
      const p = manageChangeDetector({ watch: true, path: tmpDir });
      await vi.advanceTimersByTimeAsync(5000);
      expect(logged()).not.toContain('Changes detected');
      await p;
    });

    it('logs the no-change heartbeat in verbose mode', async () => {
      mocks.createChangeDetector.mockResolvedValueOnce({
        ...detectorStub(),
        detectChanges: vi.fn().mockResolvedValue({
          ...scanFixture(),
          totalChanges: 0,
          added: [],
          modified: [],
          deleted: [],
          moved: [],
        }),
      });
      const p = manageChangeDetector({ watch: true, path: tmpDir, verbose: true });
      await vi.advanceTimersByTimeAsync(5000);
      expect(logged()).toContain('No changes');
      await p;
    });
  });

  describe('compare', () => {
    it('runs two scans, reports both change counts and the delta', async () => {
      const p = manageChangeDetector({ compare: true, path: tmpDir });
      // compare awaits a real 2s setTimeout — flush it under fake timers.
      await vi.advanceTimersByTimeAsync(2000);
      await p;
      expect((await detector()).detectChanges).toHaveBeenCalledTimes(2);
      expect(logged()).toContain('Change Comparison');
      expect(logged()).toContain('First scan changes: 3');
      expect(logged()).toContain('Second scan changes: 3');
      expect(logged()).toContain('Changes detected during comparison window');
    });

    it('reports no-additional-changes when the second scan is clean', async () => {
      mocks.createChangeDetector.mockResolvedValueOnce({
        ...detectorStub(),
        detectChanges: vi
          .fn()
          .mockResolvedValueOnce(scanFixture())
          .mockResolvedValueOnce({
            ...scanFixture(),
            totalChanges: 0,
            added: [],
            modified: [],
            deleted: [],
            moved: [],
          }),
      });
      const p = manageChangeDetector({ compare: true, path: tmpDir });
      await vi.advanceTimersByTimeAsync(2000);
      await p;
      expect(logged()).toContain('No additional changes detected');
    });
  });

  describe('interactive', () => {
    it('dispatches to scan when scan is chosen', async () => {
      mocks.prompts
        .mockResolvedValueOnce({ action: 'scan' })
        // scanInteractive then prompts for path/hashing/moves/depth; the path
        // answer must be truthy or the sub-prompt returns early.
        .mockResolvedValueOnce({ path: tmpDir, useHashing: true, trackMoves: true, maxDepth: 10 });
      await manageChangeDetector({ interactive: true, path: tmpDir });
      expect(logged()).toContain('Change Detection Results');
    });

    it('dispatches to status when status is chosen', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'status' });
      await manageChangeDetector({ interactive: true, path: tmpDir });
      expect(logged()).toContain('Change Detector Status');
    });

    it('does nothing when the prompt is cancelled', async () => {
      mocks.prompts.mockResolvedValueOnce({});
      await manageChangeDetector({ interactive: true, path: tmpDir });
      expect(mocks.detectChanges).not.toHaveBeenCalled();
      expect(mocks.createChangeDetector).not.toHaveBeenCalled();
    });
  });
});
