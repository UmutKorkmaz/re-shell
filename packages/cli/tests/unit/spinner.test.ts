import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  ProgressSpinner,
  createSpinner,
  flushOutput,
} from '../../src/utils/spinner';

/**
 * Spinner tests run in the default vitest environment which is non-interactive
 * (process.stdout.isTTY is undefined / falsy), so the spinner takes its
 * non-interactive code path: console.log for normal mode, process.stderr.write
 * for quiet/json mode. We spy on both sinks rather than reading real stdout.
 */

describe('ProgressSpinner (non-interactive mode)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('constructor', () => {
    it('routes the initial message to stdout when not in json/quiet mode', () => {
      new ProgressSpinner({ text: 'loading assets' });
      expect(logSpy).toHaveBeenCalled();
      const first = logSpy.mock.calls[0].join(' ');
      expect(first).toContain('loading assets');
    });

    it('routes the initial message to stderr when json:true', () => {
      stderrSpy.mockClear();
      new ProgressSpinner({ text: 'quiet load', json: true });
      expect(stderrSpy).toHaveBeenCalled();
      const written = stderrSpy.mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : ''))
        .join('');
      expect(written).toContain('quiet load');
      // stdout must not be touched in quiet mode
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('terminal-state methods return this for chaining', () => {
    it('succeed uses the default "Done" message and writes to stdout', () => {
      const s = new ProgressSpinner({ text: 'x' });
      logSpy.mockClear();
      const ret = s.succeed();
      expect(ret).toBe(s);
      // finalFlush appends a trailing `console.log('')` so scan all calls.
      const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(all).toContain('Done');
    });

    it('succeed accepts a custom message', () => {
      const s = new ProgressSpinner({ text: 'x' });
      logSpy.mockClear();
      s.succeed('all good');
      const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(all).toContain('all good');
    });

    it('fail defaults to "Failed" and routes to stdout in normal mode', () => {
      const s = new ProgressSpinner({ text: 'x' });
      logSpy.mockClear();
      const ret = s.fail();
      expect(ret).toBe(s);
      const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(all).toContain('Failed');
    });

    it('fail accepts a custom message', () => {
      const s = new ProgressSpinner({ text: 'x' });
      logSpy.mockClear();
      s.fail('boom');
      const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(all).toContain('boom');
    });

    it('warn defaults to "Warning"', () => {
      const s = new ProgressSpinner({ text: 'x' });
      logSpy.mockClear();
      s.warn();
      const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(all).toContain('Warning');
    });

    it('info defaults to "Info"', () => {
      const s = new ProgressSpinner({ text: 'x' });
      logSpy.mockClear();
      s.info();
      const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(all).toContain('Info');
    });

    it('stop is a no-op return this in non-interactive mode', () => {
      const s = new ProgressSpinner({ text: 'x' });
      expect(s.stop()).toBe(s);
    });

    it('clear is a no-op return this in non-interactive mode', () => {
      const s = new ProgressSpinner({ text: 'x' });
      expect(s.clear()).toBe(s);
    });

    it('render is a no-op return this in non-interactive mode', () => {
      const s = new ProgressSpinner({ text: 'x' });
      expect(s.render()).toBe(s);
    });
  });

  describe('setText', () => {
    it('logs the new text to stdout in normal mode', () => {
      const s = new ProgressSpinner({ text: 'old' });
      logSpy.mockClear();
      const ret = s.setText('new text');
      expect(ret).toBe(s);
      const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(all).toContain('new text');
    });

    it('writes the new text to stderr in json mode', () => {
      stderrSpy.mockClear();
      const s = new ProgressSpinner({ text: 'old', json: true });
      s.setText('quiet update');
      const written = stderrSpy.mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : ''))
        .join('');
      expect(written).toContain('quiet update');
    });
  });

  describe('setColor', () => {
    it('is a no-op return this in non-interactive mode', () => {
      const s = new ProgressSpinner({ text: 'x' });
      expect(s.setColor('red')).toBe(s);
      expect(s.setColor('green')).toBe(s);
    });
  });

  describe('quiet/json mode terminal states', () => {
    it('succeed routes to stderr and never touches stdout', () => {
      stderrSpy.mockClear();
      const s = new ProgressSpinner({ text: 'x', json: true });
      logSpy.mockClear();
      s.succeed('done!');
      expect(logSpy).not.toHaveBeenCalled();
      const written = stderrSpy.mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : ''))
        .join('');
      expect(written).toContain('done!');
    });

    it('fail route to stderr in quiet mode', () => {
      stderrSpy.mockClear();
      const s = new ProgressSpinner({ text: 'x', json: true });
      s.fail('err');
      const written = stderrSpy.mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : ''))
        .join('');
      expect(written).toContain('err');
    });

    it('warn route to stderr in quiet mode', () => {
      stderrSpy.mockClear();
      const s = new ProgressSpinner({ text: 'x', json: true });
      s.warn('careful');
      const written = stderrSpy.mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : ''))
        .join('');
      expect(written).toContain('careful');
    });

    it('info route to stderr in quiet mode', () => {
      stderrSpy.mockClear();
      const s = new ProgressSpinner({ text: 'x', json: true });
      s.info('note');
      const written = stderrSpy.mock.calls
        .map((c) => (typeof c[0] === 'string' ? c[0] : ''))
        .join('');
      expect(written).toContain('note');
    });
  });

  describe('start', () => {
    it('returns this instance (no-op in non-interactive mode)', () => {
      const s = new ProgressSpinner({ text: 'x' });
      expect(s.start()).toBe(s);
    });
  });
});

describe('createSpinner factory', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('returns a ProgressSpinner that writes the initial text to stdout', () => {
    const s = createSpinner('hello');
    expect(s).toBeInstanceOf(ProgressSpinner);
    expect(logSpy.mock.calls[0].join(' ')).toContain('hello');
  });

  it('accepts a color argument without error', () => {
    const s = createSpinner('colored', 'magenta');
    expect(s).toBeInstanceOf(ProgressSpinner);
  });

  it('accepts { json: true } options and routes output to stderr', () => {
    stderrSpy.mockClear();
    const s = createSpinner('quiet', undefined, { json: true });
    expect(s).toBeInstanceOf(ProgressSpinner);
    const written = stderrSpy.mock.calls
      .map((c) => (typeof c[0] === 'string' ? c[0] : ''))
      .join('');
    expect(written).toContain('quiet');
  });

  it('supports method chaining from the constructed instance', () => {
    const s = createSpinner('chain');
    expect(s.succeed('done').stop()).toBe(s);
  });
});

describe('flushOutput', () => {
  it('does not throw even when stdout/stderr writes fail', () => {
    // We can't easily force the inner writes to fail, but we can at least
    // confirm flushOutput is a no-throw sync function.
    expect(() => flushOutput()).not.toThrow();
  });

  it('returns undefined', () => {
    expect(flushOutput()).toBeUndefined();
  });
});

describe('ProgressSpinner interactive path (forced)', () => {
  // Force the interactive branch by stubbing the TTY / env signals the ctor
  // consults. We restore them in afterEach to avoid leaking state.
  let origTTY: boolean;
  let origTerm: string | undefined;
  let origCI: string | undefined;
  let origNoSpinner: string | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    origTTY = Boolean(process.stdout.isTTY);
    origTerm = process.env.TERM;
    origCI = process.env.CI;
    origNoSpinner = process.env.RE_SHELL_NO_SPINNER;

    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    });
    process.env.TERM = 'xterm-256color';
    delete process.env.CI;
    delete process.env.RE_SHELL_NO_SPINNER;

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: origTTY,
      configurable: true,
    });
    if (origTerm === undefined) delete process.env.TERM;
    else process.env.TERM = origTerm;
    if (origCI === undefined) delete process.env.CI;
    else process.env.CI = origCI;
    if (origNoSpinner === undefined) delete process.env.RE_SHELL_NO_SPINNER;
    else process.env.RE_SHELL_NO_SPINNER = origNoSpinner;
    logSpy.mockRestore();
  });

  it('enters interactive mode when stdout is a TTY and CI is unset', () => {
    // In interactive mode the ctor uses ora, not console.log, for the initial
    // frame - so logSpy must NOT have been called.
    const s = new ProgressSpinner({ text: 'interactive' });
    expect(logSpy).not.toHaveBeenCalled();
    // start() should not throw even without a real terminal backing ora.
    expect(() => s.start()).not.toThrow();
  });

  it('RE_SHELL_NO_SPINNER env var disables interactive mode', () => {
    process.env.RE_SHELL_NO_SPINNER = '1';
    const s = new ProgressSpinner({ text: 'forced off' });
    // When disabled, the ctor logs to stdout - so logSpy must have fired.
    expect(logSpy).toHaveBeenCalled();
    const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(all).toContain('forced off');
  });

  it('CI env var disables interactive mode', () => {
    process.env.CI = 'true';
    const s = new ProgressSpinner({ text: 'ci mode' });
    expect(logSpy).toHaveBeenCalled();
    const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(all).toContain('ci mode');
  });

  it('TERM=dumb disables interactive mode', () => {
    process.env.TERM = 'dumb';
    const s = new ProgressSpinner({ text: 'dumb term' });
    expect(logSpy).toHaveBeenCalled();
    const all = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(all).toContain('dumb term');
  });
});
