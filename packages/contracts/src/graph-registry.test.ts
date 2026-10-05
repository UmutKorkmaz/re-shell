import { describe, expect, it } from 'vitest';

import { listRegisteredCommands, resolveCommand } from './command-registry.js';

describe('workspace.status / workspace.graph.diff registry entries (P9-L)', () => {
  it('builds the fixed argv for workspace.status', () => {
    expect(resolveCommand('workspace.status', {})).toEqual({
      ok: true,
      commandId: 'workspace.status',
      args: ['workspace', 'status', '--json'],
      cwd: undefined,
    });
  });

  it('builds argv for workspace.graph.diff with base only and with base+head', () => {
    const baseOnly = resolveCommand('workspace.graph.diff', { base: 'main' });
    expect(baseOnly.ok && baseOnly.args).toEqual(['workspace', 'graph', 'diff', '--base', 'main', '--json']);
    expect(resolveCommand('workspace.graph.diff', { base: 'origin/main', head: 'feature/x@1', cwd: '/repo' })).toEqual({
      ok: true,
      commandId: 'workspace.graph.diff',
      args: ['workspace', 'graph', 'diff', '--base', 'origin/main', '--head', 'feature/x@1', '--json'],
      cwd: '/repo',
    });
  });

  it('accepts HEAD~N, tags, shas and relative json files', () => {
    for (const base of ['HEAD~3', 'v1.2.3', 'a1b2c3d4e5', 'HEAD^', 'graphs/base.json', 'release-2024.01']) {
      expect(resolveCommand('workspace.graph.diff', { base }).ok, base).toBe(true);
    }
  });

  it('rejects unsafe refs: options, absolute paths, traversal, ranges, shell metacharacters', () => {
    const bad = [
      '--upload-pack=evil',
      '-h',
      '/etc/passwd.json',
      '../secret.json',
      'a..b',
      'main; rm -rf ~',
      'main && id',
      '$(id)',
      '`id`',
      'ref with space',
      'x\nreflog',
      'HEAD@{1}',
      'a//b',
      'trailing/',
      '',
      'a'.repeat(201),
    ];
    for (const base of bad) {
      expect(resolveCommand('workspace.graph.diff', { base }).ok, JSON.stringify(base)).toBe(false);
    }
    expect(resolveCommand('workspace.graph.diff', { base: 'main', head: '-x' }).ok).toBe(false);
    expect(resolveCommand('workspace.graph.diff', {}).ok).toBe(false);
    expect(resolveCommand('workspace.graph.diff', { base: 'main', extra: 1 }).ok).toBe(false);
  });

  it('flags diff as needing params while status runs with none', () => {
    const list = listRegisteredCommands();
    expect(list.find((c) => c.id === 'workspace.graph.diff')?.runnableWithoutParams).toBe(false);
    expect(list.find((c) => c.id === 'workspace.status')?.runnableWithoutParams).toBe(true);
  });
});
