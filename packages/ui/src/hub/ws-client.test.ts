import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WsClient } from './ws-client';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];

  constructor(
    public url: string,
    public protocols?: string | string[]
  ) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

function last(): FakeWebSocket {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
}

describe('WsClient', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('smuggles the token via the Sec-WebSocket-Protocol argument', () => {
    const client = new WsClient({ url: 'ws://h/jobs', token: 'tok', onMessage: vi.fn() });
    client.connect();
    expect(last().protocols).toBe('re-shell-token.tok');
  });

  it('connects without a protocol when no token is set', () => {
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn() });
    client.connect();
    expect(last().protocols).toBeUndefined();
  });

  it('fires onOpen and resets reconnect attempts', () => {
    const onOpen = vi.fn();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn(), onOpen });
    client.connect();
    last().onopen?.();
    expect(onOpen).toHaveBeenCalled();
  });

  it('reports non-string frames via onError', () => {
    const onError = vi.fn();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn(), onError });
    client.connect();
    last().onmessage?.({ data: 123 });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/not a string/i) }));
  });

  it('reports invalid-JSON frames via onError', () => {
    const onError = vi.fn();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn(), onError });
    client.connect();
    last().onmessage?.({ data: 'oops' });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/not valid JSON/i) }));
  });

  it('reports schema-invalid frames via onError', () => {
    const onError = vi.fn();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn(), onError });
    client.connect();
    last().onmessage?.({ data: JSON.stringify({ type: 'nope' }) });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/schema validation/i) }));
  });

  it('reassembles stdout frames and flushes on exit', () => {
    const onJson = vi.fn();
    const onMessage = vi.fn();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage, onJson });
    client.connect();
    const payload = JSON.stringify({ v: 1 });
    const half = Math.ceil(payload.length / 2);
    last().onmessage?.({ data: JSON.stringify({ type: 'stdout', id: 'j1', content: payload.slice(0, half) }) });
    last().onmessage?.({ data: JSON.stringify({ type: 'stdout', id: 'j1', content: payload.slice(half) }) });
    last().onmessage?.({ data: JSON.stringify({ type: 'exit', id: 'j1', code: 0 }) });
    expect(onJson).toHaveBeenCalledWith('j1', { v: 1 });
    expect(onMessage).toHaveBeenCalled();
  });

  it('surfaces transport errors', () => {
    const onError = vi.fn();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn(), onError });
    client.connect();
    last().onerror?.();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/transport error/i) }));
  });

  it('sends a frame only when the socket is open', () => {
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn() });
    client.connect();
    client.send({ type: 'start', id: 'j1', commandId: 'doctor' });
    expect(last().sent).toEqual([JSON.stringify({ type: 'start', id: 'j1', commandId: 'doctor' })]);

    last().readyState = FakeWebSocket.CLOSED;
    client.send({ type: 'cancel', id: 'j2' });
    expect(last().sent).toHaveLength(1); // not sent while closed
  });

  it('reconnects on close when reconnect is enabled', () => {
    vi.useFakeTimers();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn(), reconnect: true });
    client.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    last().close();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('close() disables reconnect and closes the socket', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const client = new WsClient({ url: 'ws://h/jobs', onMessage: vi.fn(), reconnect: true, onClose });
    client.connect();
    client.close();
    vi.advanceTimersByTime(5000);
    // close() set reconnect = false, so no second socket is created.
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(onClose).toHaveBeenCalled();
  });
});
