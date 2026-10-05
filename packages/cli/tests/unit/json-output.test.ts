import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ok,
  fail,
  jsonError,
  jsonSuccess,
  emitJson,
  enableJsonMode,
  isJsonModeActive,
} from '../../src/utils/json-output';

describe('json-output', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];
  let errWritten: string[];

  beforeEach(() => {
    written = [];
    errWritten = [];
    errSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        errWritten.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    writeSpy.mockRestore();
    errSpy.mockRestore();
    process.exitCode = undefined;
  });

  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    // Exactly one single-line JSON object terminated by a newline.
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw.trimEnd().includes('\n')).toBe(false);
    return JSON.parse(raw);
  }

  describe('ok()', () => {
    it('emits a success envelope { ok: true, data, warnings }', () => {
      ok({ count: 3 });

      const env = lastJson();
      expect(env).toEqual({ ok: true, data: { count: 3 }, warnings: [] });
    });

    it('passes through provided warnings', () => {
      ok({ value: 1 }, ['heads up']);

      const env = lastJson();
      expect(env.warnings).toEqual(['heads up']);
    });

    it('does not set process.exitCode', () => {
      ok({ value: 1 });
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('fail()', () => {
    it('emits an error envelope with code and message', () => {
      fail('DOCTOR_ERROR', 'something broke');

      const env = lastJson() as {
        ok: boolean;
        error: { code: string; message: string };
        warnings: string[];
      };
      expect(env.ok).toBe(false);
      expect(env.error.code).toBe('DOCTOR_ERROR');
      expect(env.error.message).toBe('something broke');
      expect(env.warnings).toEqual([]);
    });

    it('sets process.exitCode = 1', () => {
      fail('ANALYZE_ERROR', 'boom');
      expect(process.exitCode).toBe(1);
    });

    it('omits details when undefined', () => {
      fail('HEALTH_CHECK_ERROR', 'no details');

      const env = lastJson() as { error: Record<string, unknown> };
      expect('details' in env.error).toBe(false);
    });

    it('includes details when provided', () => {
      fail('TEMPLATES_LIST_ERROR', 'with details', { reason: 'missing' });

      const env = lastJson() as { error: { details?: unknown } };
      expect(env.error.details).toEqual({ reason: 'missing' });
    });
  });

  describe('jsonSuccess()', () => {
    it('emits a success envelope mirroring ok()', () => {
      jsonSuccess([1, 2], ['warn']);

      const env = lastJson();
      expect(env).toEqual({ ok: true, data: [1, 2], warnings: ['warn'] });
    });
  });

  describe('jsonError()', () => {
    it('always includes warnings array', () => {
      jsonError('COMMANDS_LIST_ERROR', 'failed');

      const env = lastJson() as { warnings: unknown };
      expect(env.warnings).toEqual([]);
    });

    it('sets process.exitCode = 1', () => {
      jsonError('COMMANDS_LIST_ERROR', 'failed');
      expect(process.exitCode).toBe(1);
    });

    it('omits details when undefined', () => {
      jsonError('WORKSPACE_SUMMARY_ERROR', 'no details');

      const env = lastJson() as { error: Record<string, unknown> };
      expect('details' in env.error).toBe(false);
    });
  });

  describe('enableJsonMode()', () => {
    afterEach(() => {
      // Guard: ensure stdout.write is the spy again even if a test path fails to
      // restore (enableJsonMode replaces it).
    });

    it('suppresses all incidental stdout but lets the explicit emitter through, then restores', () => {
      const restore = enableJsonMode();
      try {
        // Incidental writes are swallowed unconditionally — no prefix sniffing.
        // A JSON-looking string written outside emitJson is NOT a sanctioned
        // emit and must be suppressed.
        process.stdout.write('plain noise');
        process.stdout.write('{"json":1}');
        // Buffers and multi-line text are swallowed too (the old sniff dropped
        // these silently or, worse, leaked them).
        process.stdout.write(Buffer.from('binary-ish'));
        process.stdout.write('line1\nline2');
        // The single sanctioned emitter passes through regardless of content.
        emitJson({ ok: true, data: { sanctioned: true }, warnings: [] });
      } finally {
        restore();
      }

      const out = written.join('');
      expect(out).not.toContain('plain noise');
      expect(out).not.toContain('{"json":1}');
      expect(out).not.toContain('binary-ish');
      expect(out).not.toContain('line1');
      // ...and none of it was dropped: it all went to stderr instead.
      const err = errWritten.join('');
      expect(err).toContain('plain noise');
      expect(err).toContain('{"json":1}');
      expect(err).toContain('binary-ish');
      expect(err).toContain('line1\nline2');
      // Exactly the emitted envelope reached stdout.
      expect(out).toBe('{"ok":true,"data":{"sanctioned":true},"warnings":[]}\n');
    });

    it('emits exactly one parseable document and nothing else under JSON mode', () => {
      const restore = enableJsonMode();
      try {
        process.stdout.write('banner');
        ok({ value: 42 });
        process.stdout.write('trailing noise');
      } finally {
        restore();
      }
      const out = written.join('');
      const lines = out.split('\n').filter(l => l.length > 0);
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0])).toEqual({ ok: true, data: { value: 42 }, warnings: [] });
    });

    it('reports active state and restores it', () => {
      expect(isJsonModeActive()).toBe(false);
      const restore = enableJsonMode();
      expect(isJsonModeActive()).toBe(true);
      restore();
      expect(isJsonModeActive()).toBe(false);
    });

    it('is re-entrant: a nested enable is a no-op restore', () => {
      const outer = enableJsonMode();
      const innerRestore = enableJsonMode();
      // Inner restore must NOT tear down the outer patch.
      innerRestore();
      expect(isJsonModeActive()).toBe(true);
      try {
        process.stdout.write('still suppressed');
        ok({ nested: true });
      } finally {
        outer();
      }
      const out = written.join('');
      expect(out).not.toContain('still suppressed');
      expect(errWritten.join('')).toContain('still suppressed');
      expect(out).toBe('{"ok":true,"data":{"nested":true},"warnings":[]}\n');
      expect(isJsonModeActive()).toBe(false);
    });

    it('keeps console.warn/console.error on stderr and redirects (never drops) stdout writes', () => {
      const restore = enableJsonMode();
      try {
        console.warn('a warning');
        console.error('real', 'failure');
        process.stdout.write('library chatter');
      } finally {
        restore();
      }
      // vitest owns the global console, so only the direct write is observable on
      // the spied streams here; the CLI-level behavior (console.log -> stderr) is
      // covered by tests/integration/json-hygiene-cli.test.ts.
      expect(errWritten.join('')).toContain('library chatter');
      expect(written.join('')).toBe('');
    });
  });
});
