import { SseHttpError, SseMessage, openSseStream } from '../sse-client.js';

/**
 * Test helper: consume an SSE stream in the background and let a test wait for
 * specific events with a timeout (so a missing event fails fast and loudly
 * instead of hanging).
 */
export class EventTap {
  readonly messages: SseMessage[] = [];
  ended = false;
  private waiters: Array<() => void> = [];
  private readonly abort = new AbortController();

  private constructor() {}

  static async open(url: string, token: string, lastEventId?: string): Promise<EventTap> {
    const tap = new EventTap();
    const stream = await openSseStream(url, { token, signal: tap.abort.signal, lastEventId });
    void (async () => {
      try {
        for await (const message of stream) {
          tap.messages.push(message);
          tap.notify();
        }
      } catch {
        // aborted or reset
      } finally {
        tap.ended = true;
        tap.notify();
      }
    })();
    return tap;
  }

  /** The HTTP error when the server refuses the stream (e.g. 403). */
  static async refused(url: string, token: string): Promise<SseHttpError> {
    try {
      await openSseStream(url, { token });
    } catch (error) {
      if (error instanceof SseHttpError) {
        return error;
      }
      throw error;
    }
    throw new Error('expected the stream to be refused');
  }

  private notify(): void {
    for (const waiter of this.waiters.splice(0)) {
      waiter();
    }
  }

  of(event: string): SseMessage[] {
    return this.messages.filter((m) => m.event === event);
  }

  json(event: string): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
    return this.of(event).map((m) => JSON.parse(m.data));
  }

  /** Wait until `predicate` holds over the messages received so far. */
  async waitFor(
    predicate: (messages: readonly SseMessage[]) => boolean,
    timeoutMs = 5000,
    what = 'condition'
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate(this.messages)) {
      if (this.ended) {
        throw new Error(`stream ended before ${what}; got: ${JSON.stringify(this.messages.map((m) => m.event))}`);
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`timed out waiting for ${what}; got: ${JSON.stringify(this.messages.map((m) => m.event))}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, Math.min(remaining, 100));
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  async waitForEvent(event: string, count = 1, timeoutMs = 5000): Promise<void> {
    await this.waitFor((m) => m.filter((x) => x.event === event).length >= count, timeoutMs, `${count}x "${event}"`);
  }

  async waitForEnd(timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!this.ended) {
      if (Date.now() > deadline) {
        throw new Error('timed out waiting for the stream to end');
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  close(): void {
    this.abort.abort();
  }
}
