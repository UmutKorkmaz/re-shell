/**
 * A small Server-Sent Events client built on `fetch`, used by execution workers
 * (policy sync) and by the test suites. It sends the bearer token as a header —
 * the browser `EventSource` API cannot, so browser clients should use
 * `fetch` streaming with this same framing.
 */

export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

/** Parse an SSE byte stream into messages (comments and `retry:` are skipped). */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        const separator = /^\r?\n\r?\n/.exec(buffer.slice(boundary));
        buffer = buffer.slice(boundary + (separator ? separator[0].length : 2));
        const message = parseFrame(frame);
        if (message) {
          yield message;
        }
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseFrame(frame: string): SseMessage | undefined {
  let event = 'message';
  let id: string | undefined;
  const data: string[] = [];
  let sawField = false;
  for (const line of frame.split(/\r?\n/)) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      event = value;
      sawField = true;
    } else if (field === 'data') {
      data.push(value);
      sawField = true;
    } else if (field === 'id') {
      id = value;
    }
  }
  if (!sawField) {
    return undefined;
  }
  return { event, data: data.join('\n'), ...(id !== undefined ? { id } : {}) };
}

export interface OpenSseOptions {
  token: string;
  signal?: AbortSignal;
  lastEventId?: string;
}

/**
 * Open an SSE endpoint. Resolves with the parsed message stream, or throws an
 * error carrying the HTTP status when the server refused (e.g. 401/403).
 */
export async function openSseStream(
  url: string,
  options: OpenSseOptions
): Promise<AsyncGenerator<SseMessage>> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${options.token}`,
  };
  if (options.lastEventId) {
    headers['Last-Event-ID'] = options.lastEventId;
  }
  const response = await fetch(url, { headers, signal: options.signal });
  if (!response.ok || !response.body) {
    let text = '';
    try {
      text = await response.text();
    } catch {
      // ignore
    }
    throw new SseHttpError(response.status, text);
  }
  return parseSse(response.body);
}

export class SseHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`SSE request failed with HTTP ${status}`);
    this.name = 'SseHttpError';
  }
}
