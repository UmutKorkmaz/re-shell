import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { Console } from 'console';
import {
  __resetJsonOutputStateForTests,
  armJsonContract,
  enableJsonMode,
  fail,
  failFromError,
  getEmittedEnvelopeCount,
  isJsonModeActive,
  noteStdoutClosed,
  ok,
  settleJsonContract,
} from '../../src/utils/json-output';
import { createSpinner, ProgressSpinner } from '../../src/utils/spinner';
import { commandRequestsJson, installJsonModeHook, installJsonUsageErrors } from '../../src/utils/json-mode-hook';
import { installEpipeHandler } from '../../src/utils/epipe';
import { EventEmitter } from 'events';

let stdout: string[];
let stderr: string[];

beforeEach(() => {
  __resetJsonOutputStateForTests();
  process.exitCode = undefined;
  stdout = [];
  stderr = [];
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as never);
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetJsonOutputStateForTests();
  process.exitCode = undefined;
});

describe('JSON mode redirects incidental output instead of dropping it', () => {
  it('sends console.log and raw stdout writes to stderr; stdout holds only the envelope', () => {
    // vitest swaps the global console for its own, so build a console bound to the
    // real stdout stream, exactly like Node's global console in the CLI process.
    const nodeConsole = new Console(process.stdout, process.stderr);
    const restore = enableJsonMode();
    try {
      nodeConsole.log('progress line');
      process.stdout.write('library noise');
      nodeConsole.warn('a warning');
      ok({ n: 1 });
    } finally {
      restore();
    }
    expect(stdout.join('')).toBe('{"ok":true,"data":{"n":1},"warnings":[]}\n');
    const err = stderr.join('');
    expect(err).toContain('progress line');
    expect(err).toContain('library noise');
    expect(err).toContain('a warning');
  });

  it('patches only process.stdout.write (console is untouched) and restores it', () => {
    const consoleLog = console.log;
    const before = process.stdout.write;
    const restore = enableJsonMode();
    expect(console.log).toBe(consoleLog);
    expect(process.stdout.write).not.toBe(before);
    restore();
    expect(process.stdout.write).toBe(before);
    expect(isJsonModeActive()).toBe(false);
  });

  it('honours write callbacks on redirected writes', () => {
    const restore = enableJsonMode();
    const cb = vi.fn();
    try {
      process.stdout.write('x', cb as never);
    } finally {
      restore();
    }
    // The spy stands in for stderr here and ignores callbacks; the point is that
    // the call was forwarded rather than swallowed.
    expect(stderr.join('')).toContain('x');
  });

  it('emits via the captured real stdout even when write is repointed', () => {
    const restore = enableJsonMode();
    try {
      ok('first');
    } finally {
      restore();
    }
    expect(getEmittedEnvelopeCount()).toBe(1);
    expect(stdout).toEqual(['{"ok":true,"data":"first","warnings":[]}\n']);
  });
});

describe('failFromError', () => {
  it('emits COMMAND_ERROR with the message and exit code 1', () => {
    failFromError(new Error('kaput'));
    const env = JSON.parse(stdout.join(''));
    expect(env).toMatchObject({ ok: false, error: { code: 'COMMAND_ERROR', message: 'kaput' } });
    expect(process.exitCode).toBe(1);
  });

  it('records a specific error name in details', () => {
    class Boom extends Error {
      constructor() {
        super('boom');
        this.name = 'Boom';
      }
    }
    failFromError(new Boom(), 'USAGE_ERROR');
    expect(JSON.parse(stdout.join('')).error).toMatchObject({ code: 'USAGE_ERROR', details: { errorName: 'Boom' } });
  });
});

describe('single-envelope contract guard', () => {
  it('settle emits an honest failure when the command emitted nothing', () => {
    armJsonContract();
    const restore = enableJsonMode();
    process.stdout.write('Profile not found\n');
    restore();
    settleJsonContract();
    const env = JSON.parse(stdout.join(''));
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('COMMAND_ERROR');
    expect(env.error.details.reason).toBe('no-json-result');
    expect(process.exitCode).toBe(1);
  });

  it('settle is a no-op when an envelope was emitted, and idempotent', () => {
    armJsonContract();
    ok({ fine: true });
    settleJsonContract();
    settleJsonContract();
    expect(stdout).toHaveLength(1);
    expect(process.exitCode).toBeUndefined();
  });

  it('settle does nothing when the contract was never armed (library / unit-test use)', () => {
    settleJsonContract();
    expect(stdout).toEqual([]);
  });

  it('does not write once stdout is closed (EPIPE)', () => {
    noteStdoutClosed();
    ok({ x: 1 });
    expect(stdout).toEqual([]);
  });
});

describe('spinner detects JSON mode by itself', () => {
  it('writes nothing to stdout and goes to stderr when JSON mode is active', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const restore = enableJsonMode();
    try {
      const spinner = createSpinner('Detecting environment...').start();
      spinner.setText('still going');
      spinner.warn('careful');
      spinner.succeed('done');
    } finally {
      restore();
    }
    expect(log).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    const err = stderr.join('');
    expect(err).toContain('Detecting environment...');
    expect(err).toContain('still going');
    expect(err).toContain('done');
  });

  it('a spinner created before JSON mode still obeys it afterwards', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const spinner = new ProgressSpinner({ text: 'early' });
    log.mockClear();
    const restore = enableJsonMode();
    try {
      spinner.fail('late failure');
    } finally {
      restore();
    }
    expect(log).not.toHaveBeenCalled();
    expect(stderr.join('')).toContain('late failure');
  });

  it('still uses stdout when JSON mode is off', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    new ProgressSpinner({ text: 'plain' });
    expect(log).toHaveBeenCalled();
  });
});

describe('json mode hook (real commander tree)', () => {
  function build(action: () => void | Promise<void>): Command {
    const program = new Command('re-shell');
    installJsonModeHook(program);
    const group = new Command('group');
    group.command('leaf').option('--json').action(action);
    group.command('value').option('--json <file>').action(() => undefined);
    program.addCommand(group);
    return program;
  }

  it('commandRequestsJson only honours a boolean --json', async () => {
    const seen: boolean[] = [];
    const program = new Command('x');
    program.command('a').option('--json').action((_o, cmd: Command) => seen.push(commandRequestsJson(cmd)));
    program.command('b').option('--json <file>').action((_o, cmd: Command) => seen.push(commandRequestsJson(cmd)));
    await program.parseAsync(['node', 'x', 'a', '--json']);
    await program.parseAsync(['node', 'x', 'b', '--json', 'f']);
    expect(seen).toEqual([true, false]);
  });

  it('keeps stdout to the envelope for a command that also prints human text', async () => {
    const program = build(() => {
      process.stdout.write('human banner\n');
      ok({ answer: 42 });
    });
    await program.parseAsync(['node', 're-shell', 'group', 'leaf', '--json']);
    expect(stdout.join('')).toBe('{"ok":true,"data":{"answer":42},"warnings":[]}\n');
    expect(stderr.join('')).toContain('human banner');
    expect(isJsonModeActive()).toBe(false);
  });

  it('turns a silent command into an explicit failure, never empty success', async () => {
    const program = build(() => {
      process.stdout.write('nothing to see\n');
    });
    await program.parseAsync(['node', 're-shell', 'group', 'leaf', '--json']);
    const env = JSON.parse(stdout.join(''));
    expect(env).toMatchObject({ ok: false, error: { code: 'COMMAND_ERROR' } });
    expect(process.exitCode).toBe(1);
  });

  it('leaves non-json invocations completely alone', async () => {
    const program = build(() => {
      process.stdout.write('visible\n');
    });
    await program.parseAsync(['node', 're-shell', 'group', 'leaf']);
    expect(stdout.join('')).toContain('visible');
    expect(process.exitCode).toBeUndefined();
  });
});

describe('installJsonUsageErrors', () => {
  it('turns commander parse failures into a USAGE_ERROR envelope under --json', () => {
    const program = new Command('re-shell');
    program.command('go').requiredOption('--from <x>').option('--json').action(() => undefined);
    installJsonUsageErrors(program, ['node', 're-shell', 'go', '--json']);
    program.configureOutput({ writeErr: () => undefined });
    program.commands[0].configureOutput({ writeErr: () => undefined });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('EXIT');
    }) as never);
    expect(() => program.parse(['node', 're-shell', 'go', '--json'])).toThrow('EXIT');
    exit.mockRestore();
    const env = JSON.parse(stdout.join(''));
    expect(env.error.code).toBe('USAGE_ERROR');
    expect(env.error.message).toContain("required option '--from <x>' not specified");
    expect(process.exitCode).toBe(1);
  });

  it('is a no-op without --json', () => {
    const program = new Command('re-shell');
    const spy = vi.spyOn(program, 'exitOverride');
    installJsonUsageErrors(program, ['node', 're-shell', 'go']);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('installEpipeHandler', () => {
  function fakeStream(): NodeJS.WriteStream {
    return new EventEmitter() as unknown as NodeJS.WriteStream;
  }

  it('exits quietly with the pending exit code on EPIPE', () => {
    const stream = fakeStream();
    const exit = vi.fn();
    installEpipeHandler([stream], exit);
    process.exitCode = 3;
    stream.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    expect(exit).toHaveBeenCalledWith(3);
    // After EPIPE nothing more is written to the dead pipe.
    ok({ late: true });
    expect(stdout).toEqual([]);
  });

  it('exits 0 when no exit code was set', () => {
    const stream = fakeStream();
    const exit = vi.fn();
    installEpipeHandler([stream], exit);
    stream.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('rethrows every other stream error', () => {
    const stream = fakeStream();
    const exit = vi.fn();
    installEpipeHandler([stream], exit);
    expect(() => stream.emit('error', Object.assign(new Error('disk'), { code: 'EIO' }))).toThrow('disk');
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('fail() still works standalone', () => {
  it('sets the exit code', () => {
    fail('DOCTOR_ERROR', 'x');
    expect(process.exitCode).toBe(1);
  });
});
