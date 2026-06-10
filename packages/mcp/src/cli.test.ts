import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCli } from './cli.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('resolveCli', () => {
  const original = process.env.RE_SHELL_BIN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.RE_SHELL_BIN;
    } else {
      process.env.RE_SHELL_BIN = original;
    }
  });

  it('uses RE_SHELL_BIN when it points at an existing file', () => {
    // This source file is guaranteed to exist; use it as a stand-in entry.
    const entry = fileURLToPath(import.meta.url);
    process.env.RE_SHELL_BIN = entry;
    const invocation = resolveCli();
    expect(invocation.strategy).toBe('RE_SHELL_BIN');
    expect(invocation.entry).toBe(path.resolve(entry));
    expect(invocation.prefix[0]).toBe(process.execPath);
    expect(invocation.prefix[1]).toBe(path.resolve(entry));
  });

  it('throws when RE_SHELL_BIN points at a missing file', () => {
    process.env.RE_SHELL_BIN = path.join(here, 'definitely-not-a-real-file.js');
    expect(() => resolveCli()).toThrow(/missing file/);
  });

  it('always runs the CLI under the current Node executable, never a shell', () => {
    const entry = fileURLToPath(import.meta.url);
    process.env.RE_SHELL_BIN = entry;
    const invocation = resolveCli();
    expect(invocation.prefix[0]).toBe(process.execPath);
  });
});
