import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useJob } from './useJob';

/**
 * Minimal fake WebSocket that records sent frames and lets the test drive
 * inbound server messages. It mirrors only the surface WsClient touches.
 */
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
    // Open on the next tick so the hook can register handlers first.
    queueMicrotask(() => this.onopen?.());
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  emit(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

describe('useJob', () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.restoreAllMocks();
  });

  it('reads msg.content (not output) and redacts secrets in displayed lines', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const { result } = renderHook(() =>
      useJob('workspace.health', undefined, { baseUrl: 'http://127.0.0.1:3333' })
    );

    act(() => {
      result.current.start();
    });

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];

    // Wait for the start frame to be sent once the socket is open.
    await waitFor(() => expect(socket.sent.length).toBeGreaterThan(0));
    const startFrame = JSON.parse(socket.sent[0]);
    expect(startFrame).toMatchObject({ type: 'start', commandId: 'workspace.health' });
    expect(startFrame.id).toMatch(/^job_/);

    // A frame whose payload lives under `content` (NOT `output`) plus a secret.
    act(() => {
      socket.emit({
        type: 'stdout',
        id: startFrame.id,
        content: 'connecting with token=supersecretvalue123',
        // An `output` field must be ignored — the hook reads `content`.
        output: 'IGNORED_OUTPUT_FIELD',
      });
    });

    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    const line = result.current.lines[0];
    expect(line.stream).toBe('stdout');
    expect(line.text).toContain('connecting with token=');
    expect(line.text).toContain('[REDACTED]');
    expect(line.text).not.toContain('supersecretvalue123');
    expect(line.text).not.toContain('IGNORED_OUTPUT_FIELD');
    expect(result.current.status).toBe('running');

    // Exit frame drives status + exitCode.
    act(() => {
      socket.emit({ type: 'exit', id: startFrame.id, code: 0 });
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.exitCode).toBe(0);
  });

  it('sends a cancel frame for the active job id', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const { result } = renderHook(() => useJob('analyze', { type: 'all' }));

    act(() => {
      result.current.start();
    });

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    await waitFor(() => expect(socket.sent.length).toBeGreaterThan(0));
    const jobId = JSON.parse(socket.sent[0]).id;

    act(() => {
      result.current.cancel();
    });

    const cancelFrame = JSON.parse(socket.sent[socket.sent.length - 1]);
    expect(cancelFrame).toEqual({ type: 'cancel', id: jobId });
    expect(result.current.status).toBe('cancelled');
  });
});
