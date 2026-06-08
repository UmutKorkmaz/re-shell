/**
 * Buffer `content` chunks keyed by job id and emit a parsed object only once the
 * accumulated buffer is a complete JSON document. A chunk-split or multi-line
 * `--json` payload therefore reassembles into exactly one parsed value.
 *
 * Shared by the SSE and WS hub clients so both reassemble identically. Streams
 * whose events carry no id fall back to a single default bucket.
 */
export class JsonReassembler {
  private buffers = new Map<string, string>();
  private static readonly DEFAULT_KEY = '__default__';

  private keyFor(id?: string): string {
    return id ?? JsonReassembler.DEFAULT_KEY;
  }

  /**
   * Append a chunk to the buffer for `id`, then attempt to parse the whole
   * buffer as one JSON document. On success the buffer is cleared and the parsed
   * value returned; on incomplete JSON null is returned and the buffer is kept.
   */
  append(id: string | undefined, chunk: string): unknown | null {
    const key = this.keyFor(id);
    const next = (this.buffers.get(key) ?? '') + chunk;
    const trimmed = next.trim();
    if (trimmed === '') {
      this.buffers.set(key, next);
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      this.buffers.delete(key);
      return parsed;
    } catch {
      // Not yet a complete document — keep buffering.
      this.buffers.set(key, next);
      return null;
    }
  }

  /**
   * Flush the buffer for `id` (e.g. on exit). Returns the parsed value if the
   * remaining buffer is valid JSON, otherwise null. The buffer is always cleared.
   */
  flush(id?: string): unknown | null {
    const key = this.keyFor(id);
    const remaining = (this.buffers.get(key) ?? '').trim();
    this.buffers.delete(key);
    if (remaining === '') {
      return null;
    }
    try {
      return JSON.parse(remaining);
    } catch {
      return null;
    }
  }
}
