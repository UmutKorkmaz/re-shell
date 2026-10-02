import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Server-Sent Events plumbing: headers, framing, keep-alive pings, and slow-
 * consumer protection. Event names are always server-chosen constants and data
 * is always `JSON.stringify` output (which never contains a raw newline), so a
 * frame cannot be split or spoofed by event content.
 */

export interface SseStream {
  /** Send one event. Returns false once the stream is closed. */
  send(event: string, data: unknown, id?: string | number): boolean;
  /** End the stream from the server side. */
  close(): void;
  readonly closed: boolean;
  /** Register a callback for when the stream closes (client gone or server ended it). */
  onClose(callback: () => void): void;
}

export interface OpenSseOptions {
  /** Interval for `: ping` comments that keep proxies from idling the stream out. */
  keepAliveMs?: number;
  /** A client that lets more than this many bytes pile up is disconnected. */
  maxBufferedBytes?: number;
  /** Extra response headers (e.g. CORS) applied to the stream response. */
  headers?: Record<string, string | string[]>;
}

export function openSse(
  req: IncomingMessage,
  res: ServerResponse,
  options: OpenSseOptions = {}
): SseStream {
  const keepAliveMs = options.keepAliveMs ?? 15_000;
  const maxBuffered = options.maxBufferedBytes ?? 1024 * 1024;
  const callbacks: Array<() => void> = [];
  let closed = false;
  let timer: NodeJS.Timeout | undefined;

  const finish = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    if (timer) {
      clearInterval(timer);
    }
    for (const callback of callbacks.splice(0)) {
      try {
        callback();
      } catch {
        // A cleanup callback must never prevent the others from running.
      }
    }
  };

  res.writeHead(200, {
    ...(options.headers ?? {}),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    // Tell nginx-style proxies not to buffer the stream.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  // NOTE: do not listen to `req.on('close')` — on modern Node it fires when the
  // REQUEST has been fully read (immediately, for a GET), not when the client
  // disconnects. The response's 'close' is the real signal.
  void req;
  res.on('close', finish);
  res.on('error', finish);

  timer = setInterval(() => {
    if (!closed) {
      res.write(': ping\n\n');
    }
  }, keepAliveMs);
  timer.unref();

  const stream: SseStream = {
    send(event, data, id) {
      if (closed) {
        return false;
      }
      let frame = '';
      if (id !== undefined) {
        frame += `id: ${String(id).replace(/[\r\n]/g, '')}\n`;
      }
      frame += `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(frame);
      if (res.writableLength > maxBuffered) {
        // Slow consumer: drop it rather than buffer unboundedly.
        res.destroy();
        finish();
        return false;
      }
      return true;
    },
    close() {
      if (closed) {
        return;
      }
      res.end();
      finish();
    },
    get closed() {
      return closed;
    },
    onClose(callback) {
      if (closed) {
        callback();
      } else {
        callbacks.push(callback);
      }
    },
  };
  return stream;
}
