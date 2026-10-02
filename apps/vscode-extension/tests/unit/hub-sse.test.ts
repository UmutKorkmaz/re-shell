import { describe, it, expect } from 'vitest';

import {
  HubJobCollector,
  SseParser,
  parseJobEnvelope,
} from '../../src/core/hub-client.js';

/** Frame one hub event exactly as apps/web/src/hub-server.ts writes it. */
function frame(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe('SseParser', () => {
  it('returns the data payload of each complete event', () => {
    const parser = new SseParser();
    const out = parser.push(frame({ type: 'stdout', content: 'a' }) + frame({ type: 'exit', code: 0 }));
    expect(out.map((p) => JSON.parse(p))).toEqual([
      { type: 'stdout', content: 'a' },
      { type: 'exit', code: 0 },
    ]);
  });

  it('reassembles an event split at every possible byte boundary', () => {
    const wire = frame({ type: 'stdout', content: 'héllo — wörld' }) + frame({ type: 'exit', code: 3 });
    for (let cut = 1; cut < wire.length; cut += 1) {
      const parser = new SseParser();
      const events = [...parser.push(wire.slice(0, cut)), ...parser.push(wire.slice(cut))];
      expect(events.map((p) => JSON.parse(p))).toEqual([
        { type: 'stdout', content: 'héllo — wörld' },
        { type: 'exit', code: 3 },
      ]);
    }
  });

  it('ignores `: ping` keepalive comments', () => {
    const parser = new SseParser();
    const out = parser.push(`: ping\n\n${frame({ type: 'exit', code: 0 })}: ping\n\n`);
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0])).toEqual({ type: 'exit', code: 0 });
  });

  it('accepts CRLF line endings, even when CR and LF arrive in separate chunks', () => {
    const parser = new SseParser();
    const first = parser.push('data: {"type":"exit","code":0}\r');
    expect(first).toEqual([]);
    const second = parser.push('\n\r\n');
    expect(second).toEqual(['{"type":"exit","code":0}']);
  });

  it('joins multi-line data fields with a newline and ignores other fields', () => {
    const parser = new SseParser();
    expect(parser.push('event: custom\nid: 7\ndata: one\ndata: two\n\n')).toEqual(['one\ntwo']);
  });

  it('does not emit an event until the blank line terminator arrives', () => {
    const parser = new SseParser();
    expect(parser.push('data: {"type":"stdout","content":"x"}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual(['{"type":"stdout","content":"x"}']);
  });
});

describe('HubJobCollector', () => {
  it('folds stdout, stderr and the exit code into a result', () => {
    const collector = new HubJobCollector();
    expect(collector.done).toBe(false);
    expect(collector.result()).toBeUndefined();

    collector.feed(JSON.stringify({ type: 'stdout', content: '{"ok":' }));
    collector.feed(JSON.stringify({ type: 'stderr', content: 'warn 1' }));
    collector.feed(JSON.stringify({ type: 'stdout', content: 'true}' }));
    collector.feed(JSON.stringify({ type: 'stderr', content: 'warn 2' }));
    collector.feed(JSON.stringify({ type: 'exit', code: 0 }));

    expect(collector.done).toBe(true);
    expect(collector.result()).toEqual({
      exitCode: 0,
      stdout: '{"ok":true}',
      stderr: 'warn 1\nwarn 2',
    });
  });

  it('concatenates stdout without a separator so a chunk-split JSON value survives', () => {
    // The hub splits child output at pipe-chunk boundaries and emits each piece
    // as its own event; a separator would corrupt the value split across them.
    const collector = new HubJobCollector();
    const doc = JSON.stringify({ ok: true, data: { name: 'a-very-long-workspace-name' }, warnings: [] });
    collector.feed(JSON.stringify({ type: 'stdout', content: doc.slice(0, 31) }));
    collector.feed(JSON.stringify({ type: 'stdout', content: doc.slice(31) }));
    collector.feed(JSON.stringify({ type: 'exit', code: 0 }));
    expect(JSON.parse(collector.result()!.stdout)).toEqual(JSON.parse(doc));
  });

  it('carries a non-zero exit code', () => {
    const collector = new HubJobCollector();
    collector.feed(JSON.stringify({ type: 'exit', code: 1 }));
    expect(collector.result()?.exitCode).toBe(1);
  });

  it('records malformed and unknown events as protocol problems instead of throwing', () => {
    const collector = new HubJobCollector();
    expect(collector.feed('not json')).toBeUndefined();
    expect(collector.feed(JSON.stringify({ type: 'bogus' }))).toBeUndefined();
    expect(collector.protocolProblems).toHaveLength(2);
    expect(collector.done).toBe(false);
  });

  it('ignores heartbeat events', () => {
    const collector = new HubJobCollector();
    collector.feed(JSON.stringify({ type: 'heartbeat', ts: '2026-01-01T00:00:00.000Z' }));
    expect(collector.done).toBe(false);
    expect(collector.protocolProblems).toEqual([]);
  });
});

describe('parseJobEnvelope', () => {
  it('returns the data of an ok envelope', () => {
    const parsed = parseJobEnvelope(JSON.stringify({ ok: true, data: { n: 1 }, warnings: ['w'] }));
    expect(parsed).toEqual({ ok: true, data: { n: 1 }, warnings: ['w'] });
  });

  it('surfaces the CLI error code and message of an ok:false envelope', () => {
    const parsed = parseJobEnvelope(
      JSON.stringify({
        ok: false,
        error: { code: 'WORKSPACE_NOT_FOUND', message: 'No workspace configuration found' },
        warnings: [],
      })
    );
    expect(parsed).toEqual({
      ok: false,
      error: '[WORKSPACE_NOT_FOUND] No workspace configuration found',
      code: 'WORKSPACE_NOT_FOUND',
    });
  });

  it('rejects empty output, non-JSON, and JSON that is not the envelope', () => {
    expect(parseJobEnvelope('   ').ok).toBe(false);
    expect(parseJobEnvelope('hello').ok).toBe(false);
    expect(parseJobEnvelope(JSON.stringify({ hello: 'world' })).ok).toBe(false);
    expect(parseJobEnvelope(JSON.stringify({ ok: true, data: 1 })).ok).toBe(false); // warnings missing
  });
});
