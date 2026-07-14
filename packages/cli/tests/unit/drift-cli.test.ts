import { describe, expect, it, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runDriftCheck } from '../../src/commands/workspace-policy';

const tempDirs: string[] = [];

function createTempMonorepo(
  workspaces: Array<{ name: string; deps?: Record<string, string> }>
): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-drift-cli-'));
  tempDirs.push(dir);

  const wsPatterns: string[] = [];
  for (const ws of workspaces) {
    mkdirSync(join(dir, ws.name), { recursive: true });
    writeFileSync(
      join(dir, ws.name, 'package.json'),
      JSON.stringify({ name: ws.name, version: '1.0.0', dependencies: ws.deps || {} }, null, 2)
    );
    wsPatterns.push(ws.name);
  }

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'test-monorepo',
      version: '1.0.0',
      private: true,
      workspaces: wsPatterns,
    }, null, 2)
  );

  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('runDriftCheck', () => {
  it('should display alignment score in default mode', async () => {
    const dir = createTempMonorepo([
      { name: 'apps/web', deps: { react: '^18.0.0' } },
      { name: 'apps/api', deps: { react: '^18.0.0' } },
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runDriftCheck({ cwd: dir });
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    logSpy.mockRestore();

    expect(output).toContain('Alignment score');
    expect(output).toContain('100');
  });

  it('should display drift entries with suggestions when drift exists', async () => {
    const dir = createTempMonorepo([
      { name: 'apps/web', deps: { react: '^17.0.0' } },
      { name: 'apps/api', deps: { react: '^18.0.0' } },
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runDriftCheck({ cwd: dir });
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    logSpy.mockRestore();

    expect(output).toContain('react');
    expect(output).toContain('^17.0.0');
    expect(output).toContain('^18.0.0');
    expect(output).toContain('Suggest');
    expect(output).toContain('confidence');
  });

  it('should output only the score with --score flag', async () => {
    const dir = createTempMonorepo([
      { name: 'apps/web', deps: { react: '^18.0.0' } },
      { name: 'apps/api', deps: { react: '^18.0.0' } },
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runDriftCheck({ cwd: dir, score: true });
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n').trim();
    logSpy.mockRestore();

    expect(output).toBe('100');
  });

  it('should output lower score with --score when drift exists', async () => {
    const dir = createTempMonorepo([
      { name: 'a', deps: { lodash: '^3.0.0' } },
      { name: 'b', deps: { lodash: '^4.0.0' } },
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runDriftCheck({ cwd: dir, score: true });
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n').trim();
    logSpy.mockRestore();

    const score = parseInt(output, 10);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should output markdown report with --report flag', async () => {
    const dir = createTempMonorepo([
      { name: 'a', deps: { express: '^3.0.0' } },
      { name: 'b', deps: { express: '^4.0.0' } },
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runDriftCheck({ cwd: dir, report: true, workspaceName: 'my-mono' });
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    logSpy.mockRestore();

    expect(output).toContain('# Dependency Drift Report');
    expect(output).toContain('my-mono');
    expect(output).toContain('express');
    expect(output).toContain('Suggestion');
    expect(output).toContain('major');
  });

  it('should show no-drift message with --report when aligned', async () => {
    const dir = createTempMonorepo([
      { name: 'a', deps: { lodash: '^4.17.21' } },
      { name: 'b', deps: { lodash: '^4.17.21' } },
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runDriftCheck({ cwd: dir, report: true, workspaceName: 'clean-mono' });
    const output = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    logSpy.mockRestore();

    expect(output).toContain('100');
    expect(output).toContain('No drift');
  });
});
