import { describe, it, expect } from 'vitest';
import {
  buildCommandArgv,
  isHubRunnable,
  buildCommandText,
  type CommandCatalogEntry,
  type CommandFormState,
} from './commandCatalog';

/**
 * Tests for buildCommandArgv / isHubRunnable — the argv assembly + hub gating
 * used by the Command Builder. Previously only covered indirectly through the
 * screen test (one happy-path assertion).
 */

function entry(overrides: Partial<CommandCatalogEntry> = {}): CommandCatalogEntry {
  return {
    path: 'workspace summary',
    aliases: [],
    description: '',
    args: [],
    flags: [],
    supportsJson: false,
    supportsDryRun: false,
    destructive: false,
    ...overrides,
  };
}

function state(overrides: Partial<CommandFormState> = {}): CommandFormState {
  return { args: {}, flags: {}, ...overrides };
}

describe('buildCommandArgv', () => {
  it('emits re-shell + path tokens', () => {
    expect(buildCommandArgv(entry({ path: 'doctor' }), state())).toEqual(['re-shell', 'doctor']);
  });

  it('splits multi-token paths', () => {
    expect(buildCommandArgv(entry({ path: 'workspace summary' }), state())).toEqual([
      're-shell', 'workspace', 'summary',
    ]);
  });

  it('appends positional args in declared order', () => {
    const e = entry({ args: [{ name: 'name', required: true }, { name: 'target', required: false }] });
    expect(buildCommandArgv(e, state({ args: { name: 'myapp', target: 'legacy' } }))).toEqual([
      're-shell', 'workspace', 'summary', 'myapp', 'legacy',
    ]);
  });

  it('drops empty positional args (no blank tokens)', () => {
    const e = entry({ args: [{ name: 'name', required: true }, { name: 'target', required: false }] });
    expect(buildCommandArgv(e, state({ args: { name: 'myapp', target: '' } }))).toEqual([
      're-shell', 'workspace', 'summary', 'myapp',
    ]);
  });

  it('emits value flags as --flag value pairs', () => {
    const e = entry({ flags: [{ name: '--scope', description: '', takesValue: true }] });
    expect(buildCommandArgv(e, state({ flags: { '--scope': 'apps' } }))).toEqual([
      're-shell', 'workspace', 'summary', '--scope', 'apps',
    ]);
  });

  it('drops empty value-flag strings', () => {
    const e = entry({ flags: [{ name: '--scope', description: '', takesValue: true }] });
    expect(buildCommandArgv(e, state({ flags: { '--scope': '' } }))).toEqual([
      're-shell', 'workspace', 'summary',
    ]);
  });

  it('emits switches as bare --flag only when true', () => {
    const e = entry({ flags: [{ name: '--force', description: '', takesValue: false }] });
    expect(buildCommandArgv(e, state({ flags: { '--force': true } }))).toContain('--force');
    expect(buildCommandArgv(e, state({ flags: { '--force': false } }))).not.toContain('--force');
  });

  it('preserves arg-then-flag ordering', () => {
    const e = entry({
      args: [{ name: 'name', required: true }],
      flags: [{ name: '--json', description: '', takesValue: false }, { name: '--port', description: '', takesValue: true }],
    });
    const argv = buildCommandArgv(e, state({
      args: { name: 'myapp' },
      flags: { '--json': true, '--port': '3000' },
    }));
    expect(argv).toEqual(['re-shell', 'workspace', 'summary', 'myapp', '--json', '--port', '3000']);
  });
});

describe('isHubRunnable', () => {
  it('returns true for allow-listed paths', () => {
    expect(isHubRunnable(entry({ path: 'doctor' }))).toBe(true);
    expect(isHubRunnable(entry({ path: 'workspace summary' }))).toBe(true);
    expect(isHubRunnable(entry({ path: 'templates list' }))).toBe(true);
  });

  it('returns false for non-allow-listed paths', () => {
    expect(isHubRunnable(entry({ path: 'workspace remove' }))).toBe(false);
    expect(isHubRunnable(entry({ path: 'create' }))).toBe(false);
  });
});

describe('buildCommandText', () => {
  it('delegates to formatCommand(buildCommandArgv(...))', () => {
    const text = buildCommandText(
      entry({ path: 'doctor', flags: [{ name: '--json', description: '', takesValue: false }] }),
      state({ flags: { '--json': true } }),
    );
    expect(text).toContain('re-shell');
    expect(text).toContain('doctor');
    expect(text).toContain('--json');
  });
});
