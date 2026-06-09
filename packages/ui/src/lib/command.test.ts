import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  copyTextToClipboard,
  createCommandSpec,
  createReShellCommand,
  formatCommand,
  formatCommandSpec,
  normalizeFlagName,
  quoteShellArg,
} from './command';

describe('command helpers', () => {
  it('formats safe command arrays as shell text', () => {
    expect(formatCommand(['re-shell', 'workspace', 'health', '--json'])).toBe('re-shell workspace health --json');
  });

  it('quotes arguments with spaces and single quotes', () => {
    expect(quoteShellArg('apps/admin portal')).toBe("'apps/admin portal'");
    expect(quoteShellArg("team's app")).toBe("'team'\\''s app'");
  });

  it('creates re-shell commands with boolean and value flags', () => {
    expect(
      createReShellCommand(['create', 'admin'], {
        template: 'react',
        json: true,
        dryRun: true,
        port: '3001'
      })
    ).toEqual([
      're-shell',
      'create',
      'admin',
      '--template',
      'react',
      '--json',
      '--dry-run',
      '--port',
      '3001'
    ]);
  });

  it('normalizes option keys into CLI flag names', () => {
    expect(normalizeFlagName('dryRun')).toBe('dry-run');
    expect(normalizeFlagName('health_url')).toBe('health-url');
    expect(normalizeFlagName('--json')).toBe('json');
  });

  it('adds commandText to command specs', () => {
    expect(
      createCommandSpec({
        id: 'health',
        title: 'Health',
        command: ['re-shell', 'workspace', 'health', '--json'],
        cwd: '/repo',
        dryRunSupported: false,
        destructive: false,
        requiresConfirmation: false
      }).commandText
    ).toBe('re-shell workspace health --json');
  });

  it('keeps explicit commandText when provided', () => {
    expect(
      createCommandSpec({
        id: 'custom',
        title: 'Custom',
        command: ['re-shell', 'workspace', 'health'],
        commandText: 're-shell workspace health --json',
        cwd: '/repo',
        dryRunSupported: true,
        destructive: false,
        requiresConfirmation: false
      }).commandText
    ).toBe('re-shell workspace health --json');
  });

  it('quotes an empty string argument', () => {
    expect(quoteShellArg('')).toBe("''");
  });

  it('formats a command spec from its command array', () => {
    expect(
      formatCommandSpec({ command: ['re-shell', 'doctor', '--json'] })
    ).toBe('re-shell doctor --json');
  });

  it('emits single-dash flags for single-character option keys', () => {
    expect(createReShellCommand(['build'], { v: true, x: 'y' })).toEqual([
      're-shell',
      'build',
      '-v',
      '-x',
      'y'
    ]);
  });

  it('skips undefined, null, and false option values', () => {
    expect(
      createReShellCommand(['list'], {
        keep: 'yes',
        drop: false,
        gone: undefined,
        // null is filtered at runtime even though the typed surface excludes it.
        absent: null as unknown as undefined
      })
    ).toEqual(['re-shell', 'list', '--keep', 'yes']);
  });

  it('passes through single-character flag names unchanged', () => {
    expect(normalizeFlagName('v')).toBe('v');
    expect(normalizeFlagName('-v')).toBe('v');
  });
});

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyTextToClipboard('hello')).toBe(false);
  });

  it('writes to the clipboard and returns true on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyTextToClipboard('copied')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('copied');
  });

  it('returns false when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyTextToClipboard('nope')).toBe(false);
  });
});
