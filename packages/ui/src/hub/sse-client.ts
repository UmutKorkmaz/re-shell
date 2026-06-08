import { sseEventSchema, type SseEvent } from '@umutkorkmaz/contracts';
import { JsonReassembler } from './json-reassembler.js';

export interface SseClientOptions {
  url: string;
  /**
   * Raw, schema-validated SSE event callback. Fires once per `data:` frame after
   * the frame parses against {@link sseEventSchema}. Frames that fail validation
   * are surfaced via {@link onError}, never silently dropped.
   */
  onEvent?: (event: SseEvent) => void;
  /**
   * Reassembled-JSON callback. The hub may split a single `--json` payload across
   * many `stdout` chunks; this fires only once a buffered `content` stream parses
   * into a complete JSON document (or is flushed on `exit`).
   */
  onJson?: (parsed: unknown) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
  retries?: number;
  /**
   * Per-launch session token enforced by the hub on every route. When omitted,
   * it is read from the VITE_RE_SHELL_UI_HUB_TOKEN build-time env var.
   */
  token?: string;
}

/**
 * Resolve the hub session token from an explicit option or the Vite build env.
 * Returns undefined when neither is available.
 */
function resolveHubToken(explicit?: string): string | undefined {
  if (explicit) {
    return explicit;
  }
  // Direct member access so Vite inlines the value at build time; indirecting
  // through a local var defeats the static replacement (value would be undefined).
  const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;
  return env === undefined ? undefined : import.meta.env.VITE_RE_SHELL_UI_HUB_TOKEN;
}

export class SseClient {
  private controller: AbortController;
  private retries: number;
  private attempts: number = 0;
  private token: string | undefined;
  private reassembler = new JsonReassembler();

  constructor(private opts: SseClientOptions) {
    this.controller = new AbortController();
    this.retries = opts.retries ?? 3;
    this.token = resolveHubToken(opts.token);
  }

  async connect(): Promise<void> {
    try {
      // The hub requires a non-simple Accept header (or Sec-Fetch metadata) plus
      // the session token to authorize the SSE GET.
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
      };
      if (this.token) {
        headers['X-Re-Shell-UI-Hub-Token'] = this.token;
      }

      const response = await fetch(this.opts.url, {
        signal: this.controller.signal,
        headers,
      });

      if (!response.ok) {
        throw new Error(`SSE error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            this.handleFrame(line.slice(6));
          }
        }
      }

      // Stream ended: flush any buffered JSON that never closed with an exit.
      this.flushReassembly();
      this.opts.onDone?.();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;

      this.attempts++;
      if (this.attempts < this.retries) {
        await new Promise((r) => setTimeout(r, 1000 * this.attempts));
        return this.connect();
      }
      this.opts.onError?.(err as Error);
    }
  }

  /**
   * Validate a single SSE `data:` frame against the contract schema, surface raw
   * events, accumulate stdout for JSON reassembly, and flush on exit. Parse and
   * validation failures are reported via onError rather than swallowed.
   */
  private handleFrame(raw: string): void {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.opts.onError?.(new Error(`SSE frame is not valid JSON: ${raw}`));
      return;
    }

    const result = sseEventSchema.safeParse(json);
    if (!result.success) {
      this.opts.onError?.(new Error(`SSE frame failed schema validation: ${result.error.message}`));
      return;
    }

    const event = result.data;
    this.opts.onEvent?.(event);

    if (event.type === 'stdout' && event.content !== undefined) {
      const parsed = this.reassembler.append(event.id, event.content);
      if (parsed !== null) {
        this.opts.onJson?.(parsed);
      }
      return;
    }

    if (event.type === 'exit') {
      const parsed = this.reassembler.flush(event.id);
      if (parsed !== null) {
        this.opts.onJson?.(parsed);
      }
    }
  }

  /**
   * Flush the default (id-less) buffer when the stream ends without an exit.
   */
  private flushReassembly(): void {
    const parsed = this.reassembler.flush();
    if (parsed !== null) {
      this.opts.onJson?.(parsed);
    }
  }

  close(): void {
    this.controller.abort();
  }
}
