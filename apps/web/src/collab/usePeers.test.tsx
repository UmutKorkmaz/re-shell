import type { CollabConnection, ControlPlaneClient, RelayMessage, RtcSignal } from '@re-shell/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePeers } from './usePeers';

/** A stand-in for a CollabConnection that lets the test push signals and relays. */
function fakeConnection() {
  const handlers = { signal: new Set<(s: RtcSignal) => void>(), relay: new Set<(m: RelayMessage) => void>() };
  const connection = {
    on(event: 'signal' | 'relay', handler: never) {
      (handlers[event] as Set<unknown>).add(handler);
      return () => (handlers[event] as Set<unknown>).delete(handler);
    },
  } as unknown as CollabConnection;
  return {
    connection,
    signal: (s: RtcSignal) => handlers.signal.forEach((h) => h(s)),
    relay: (m: RelayMessage) => handlers.relay.forEach((h) => h(m)),
  };
}

function fakeClient() {
  const calls = { signal: [] as unknown[], relay: [] as unknown[] };
  const client = {
    signal: async (_t: string, _s: string, input: unknown) => {
      calls.signal.push(input);
      return { delivered: true };
    },
    relay: async (_t: string, _s: string, input: unknown) => {
      calls.relay.push(input);
      return { delivered: 1 };
    },
  } as unknown as ControlPlaneClient;
  return { client, calls };
}

describe('usePeers', () => {
  it('opens a link per online peer, falls back to the relay without WebRTC, and routes relayed messages', async () => {
    const { client, calls } = fakeClient();
    const conn = fakeConnection();
    const { result, rerender } = renderHook(
      (props: { online: string[] }) =>
        usePeers({
          client,
          connection: conn.connection,
          tenantId: 'acme',
          sessionId: 's1',
          selfId: 'alice',
          online: props.online,
          iceServers: [],
          // jsdom has no RTCPeerConnection: the link must fall back instead of failing.
          createPeerConnection: () => undefined as never,
        }),
      { initialProps: { online: ['alice'] } }
    );
    expect(result.current.peers).toEqual({});

    rerender({ online: ['alice', 'bob'] });
    await waitFor(() => expect(result.current.peers.bob?.transport).toBe('relay'));
    expect(result.current.peers.bob.detail).toBe('webrtc-unavailable');

    // A ping goes through the server relay and says so.
    let via: string | undefined;
    await act(async () => {
      via = await result.current.ping('bob');
    });
    expect(via).toBe('relay');
    expect(calls.relay).toEqual([{ to: 'bob', channel: 'ping', payload: { n: 1 } }]);

    // Messages relayed from bob arrive as pings and cursors.
    act(() => {
      conn.relay({ from: 'bob', to: 'alice', channel: 'ping', payload: { n: 7 }, ts: 0 });
      conn.relay({ from: 'bob', to: null, channel: 'cursor', payload: { docId: 'notes', index: 12 }, ts: 0 });
      conn.relay({ from: 'bob', to: null, channel: 'cursor', payload: { docId: 'notes', index: -5 }, ts: 0 });
    });
    expect(result.current.pings).toMatchObject([{ from: 'bob', via: 'relay', n: 7 }]);
    expect(result.current.cursors).toEqual({ bob: { docId: 'notes', index: 12, via: 'relay' } });

    // The cursor is shared with every peer (throttled).
    act(() => result.current.shareCursor('notes', 3));
    await waitFor(() => expect(calls.relay).toContainEqual({ to: 'bob', channel: 'cursor', payload: { docId: 'notes', index: 3 } }));

    // When bob goes offline his link and cursor disappear.
    rerender({ online: ['alice'] });
    await waitFor(() => expect(result.current.peers.bob).toBeUndefined());
    expect(result.current.cursors.bob).toBeUndefined();
    expect(await result.current.ping('bob')).toBe('none');
  });

  it('answers an incoming offer even before presence lists the sender', async () => {
    const { client, calls } = fakeClient();
    const conn = fakeConnection();
    const online = ['zoe'];
    const { result } = renderHook(() =>
      usePeers({
        client,
        connection: conn.connection,
        tenantId: 'acme',
        sessionId: 's1',
        selfId: 'zoe',
        online,
        iceServers: [],
        createPeerConnection: () => undefined as never,
      })
    );
    act(() => conn.signal({ from: 'adam', to: 'zoe', kind: 'offer', connectionId: 'c1', payload: { sdp: 'x' }, ts: 0 }));
    await waitFor(() => expect(result.current.peers.adam?.transport).toBe('relay'));
    expect(calls.signal).toEqual([]); // no WebRTC here, so no answer was produced
  });

  it('does nothing without a client or identity', () => {
    const conn = fakeConnection();
    const { result } = renderHook(() =>
      usePeers({ client: null, connection: conn.connection, tenantId: null, sessionId: null, selfId: null, online: ['x'], iceServers: [] })
    );
    expect(result.current.peers).toEqual({});
  });
});
