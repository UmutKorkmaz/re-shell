import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCommand } from '../../src/utils/cli-adapters';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cli-adapters-test-'));
  tempDirs.push(dir);
  return dir;
}

describe('cli-adapters', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('runCommand', () => {
    it('returns code 1 when cwd does not exist', async () => {
      const nonExistentPath = '/this/path/does/not/exist';
      const onLine = vi.fn();
      const onError = vi.fn();

      const code = await runCommand(
        ['echo', 'hello'],
        { cwd: nonExistentPath },
        onLine,
        onError
      );

      expect(code).toBe(1);
      expect(onError).toHaveBeenCalledWith(
        `Working directory does not exist: ${nonExistentPath}`
      );
      expect(onLine).not.toHaveBeenCalled();
    });

    it('sets NO_COLOR and FORCE_COLOR env vars', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      // Create a test script that prints env vars
      const testScript = join(cwd, 'print-env.sh');
      writeFileSync(testScript, '#!/bin/sh\necho "NO_COLOR=$NO_COLOR"\necho "FORCE_COLOR=$FORCE_COLOR"\necho "NODE_ENV=$NODE_ENV"');
      
      const code = await runCommand(
        ['sh', testScript],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(0);
      // The output should show that NO_COLOR and FORCE_COLOR are set
      const output = onLine.mock.calls.map(([line]) => line);
      expect(output.some((line: string) => line.includes('NO_COLOR=1'))).toBe(true);
      expect(output.some((line: string) => line.includes('FORCE_COLOR=0'))).toBe(true);
    });

    it('sets NODE_ENV to production if not already set', async () => {
      // Clear NODE_ENV for this test
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const testScript = join(cwd, 'print-node-env.sh');
      writeFileSync(testScript, '#!/bin/sh\necho "NODE_ENV=$NODE_ENV"');
      
      const code = await runCommand(
        ['sh', testScript],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(0);
      const output = onLine.mock.calls.map(([line]) => line);
      expect(output.some((line: string) => line.includes('NODE_ENV=production'))).toBe(true);

      // Restore original NODE_ENV
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('preserves existing NODE_ENV', async () => {
      process.env.NODE_ENV = 'development';

      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const testScript = join(cwd, 'print-node-env.sh');
      writeFileSync(testScript, '#!/bin/sh\necho "NODE_ENV=$NODE_ENV"');
      
      const code = await runCommand(
        ['sh', testScript],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(0);
      const output = onLine.mock.calls.map(([line]) => line);
      expect(output.some((line: string) => line.includes('NODE_ENV=development'))).toBe(true);

      // Clean up
      delete process.env.NODE_ENV;
    });

    it('streams stdout lines via onLine callback', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const code = await runCommand(
        ['printf', 'line1\nline2\nline3\n'],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(0);
      expect(onLine).toHaveBeenCalledTimes(3);
      expect(onLine).toHaveBeenCalledWith('line1');
      expect(onLine).toHaveBeenCalledWith('line2');
      expect(onLine).toHaveBeenCalledWith('line3');
    });

    it('passes only the line to onLine (no index/array args)', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const code = await runCommand(
        ['printf', 'solo\n'],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(0);
      expect(onLine).toHaveBeenCalledTimes(1);
      // Spy must receive exactly one argument (the line), not (line, index, arr)
      expect(onLine.mock.calls[0]).toEqual(['solo']);
    });

    it('streams stderr lines via onError callback', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const code = await runCommand(
        ['sh', '-c', 'echo error >&2'],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(0);
      expect(onError).toHaveBeenCalledWith('error');
    });

    it('returns non-zero exit code on command failure', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const code = await runCommand(
        ['sh', '-c', 'exit 42'],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(42);
    });

    it('handles timeout and kills child process', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const code = await runCommand(
        ['sh', '-c', 'while true; do sleep 1; done'],
        { cwd, timeout: 500 },
        onLine,
        onError
      );

      // A SIGTERM kill leaves no exit code; we surface 124 (timed out).
      expect(code).toBe(124);
      expect(onError).toHaveBeenCalledWith('Command timed out after 500ms');
    });

    it('does not set timeout when timeout is 0', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      // This should complete without timing out
      const code = await runCommand(
        ['echo', 'quick'],
        { cwd, timeout: 0 },
        onLine,
        onError
      );

      expect(code).toBe(0);
      expect(onLine).toHaveBeenCalledWith('quick');
    });

    it('filters empty lines from output', async () => {
      const cwd = createTempDir();
      const onLine = vi.fn();
      const onError = vi.fn();

      const code = await runCommand(
        ['printf', 'line1\n\nline2\n\n\nline3\n'],
        { cwd },
        onLine,
        onError
      );

      expect(code).toBe(0);
      expect(onLine).toHaveBeenCalledTimes(3);
    });
  });
});
