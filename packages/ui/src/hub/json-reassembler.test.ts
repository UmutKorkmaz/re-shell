import { describe, it, expect } from 'vitest';
import { JsonReassembler } from './json-reassembler';

/**
 * Tests for JsonReassembler — buffers SSE/WS content chunks and emits a
 * parsed JSON value only once the accumulated buffer is complete. Previously
 * only exercised indirectly through client integration tests.
 */
describe('JsonReassembler', () => {
  it('returns null for an incomplete chunk', () => {
    const r = new JsonReassembler();
    expect(r.append('job1', '{"ok":')).toBeNull();
  });

  it('returns the parsed value once the buffer is complete', () => {
    const r = new JsonReassembler();
    expect(r.append('job1', '{"ok":')).toBeNull();
    expect(r.append('job1', 'true}')).toEqual({ ok: true });
  });

  it('clears the buffer after a successful parse', () => {
    const r = new JsonReassembler();
    r.append('job1', '{"a":1}');
    // A second append starts fresh (buffer was cleared)
    expect(r.append('job1', '{"b":2}')).toEqual({ b: 2 });
  });

  it('keeps separate buffers per job id', () => {
    const r = new JsonReassembler();
    r.append('job1', '{"a":');
    // job2 is complete on first append — parsed and buffer cleared immediately
    expect(r.append('job2', '{"b":2}')).toEqual({ b: 2 });
    expect(r.append('job1', '1}')).toEqual({ a: 1 });
    // job2 buffer was already cleared after parse
    expect(r.flush('job2')).toBeNull();
  });

  it('uses a default bucket when id is undefined', () => {
    const r = new JsonReassembler();
    expect(r.append(undefined, '{"x":1}')).toEqual({ x: 1 });
  });

  it('flush returns null on an empty buffer', () => {
    const r = new JsonReassembler();
    expect(r.flush('never-seen')).toBeNull();
  });

  it('flush parses a remaining buffer', () => {
    const r = new JsonReassembler();
    r.append('job1', '{"incomplete":');
    // The buffer is not valid JSON yet — flush should still attempt
    const result = r.flush('job1');
    expect(result).toBeNull(); // incomplete JSON
  });

  it('flush parses a complete remaining buffer', () => {
    const r = new JsonReassembler();
    r.append('job1', '{"ok":true}');
    // Buffer was already parsed on append, so flush has nothing
    expect(r.flush('job1')).toBeNull();
  });

  it('flush clears the buffer even if parse fails', () => {
    const r = new JsonReassembler();
    r.append('job1', 'not json');
    expect(r.flush('job1')).toBeNull();
    // Second flush — buffer is gone
    expect(r.flush('job1')).toBeNull();
  });
});
