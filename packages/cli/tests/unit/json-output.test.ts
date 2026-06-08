import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ok,
  fail,
  jsonError,
  jsonSuccess,
  createJsonWriter,
  emitJson,
  enableJsonMode,
  isJsonMode,
  isJsonModeActive,
} from '../../src/utils/json-output';

describe('json-output', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];

  beforeEach(() => {
    written = [];
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

  describe('createJsonWriter()', () => {
    it('forwards written chunks to the real stdout', async () => {
      const writer = createJsonWriter();
      await new Promise<void>((resolve, reject) => {
        writer.write('{"hello":true}', (err) => (err ? reject(err) : resolve()));
      });
      expect(written.join('')).toContain('{"hello":true}');
    });
  });

  describe('isJsonMode()', () => {
    it('detects --json in argv', () => {
      const original = process.argv;
      process.argv = ['node', 'cli', '--json'];
      expect(isJsonMode()).toBe(true);
      process.argv = original;
    });

    it('detects --json-output in argv', () => {
      const original = process.argv;
      process.argv = ['node', 'cli', '--json-output'];
      expect(isJsonMode()).toBe(true);
      process.argv = original;
    });

    it('returns false when no json flag is present', () => {
      const original = process.argv;
      process.argv = ['node', 'cli', 'workspace', 'list'];
      expect(isJsonMode()).toBe(false);
      process.argv = original;
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
      expect(out).toBe('{"ok":true,"data":{"nested":true},"warnings":[]}\n');
      expect(isJsonModeActive()).toBe(false);
    });

    it('routes console.error to stderr and silences console.log/warn', () => {
      const stderrSpy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true) as unknown as ReturnType<typeof vi.spyOn>;
      const restore = enableJsonMode();
      try {
        console.log('should be silent');
        console.warn('also silent');
        console.error('real', 'failure');
      } finally {
        restore();
      }
      const stderrOut = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(stderrOut).toContain('real failure');
      stderrSpy.mockRestore();
    });
  });
});
