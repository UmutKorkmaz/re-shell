import type { PeerChannel, RtcSignal, RtcSignalKind } from '@re-shell/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PeerLink, type PeerMessage, type PeerTransport } from './peer-link';

/**
 * PeerLink against an in-memory WebRTC fake: two links negotiate through a fake
 * signaling relay, then exchange messages over the (fake) data channel. The fake
 * implements just the RTCPeerConnection surface PeerLink uses; the real browser
 * behaviour is covered by the Playwright spec.
 */

class FakeChannel {
  readyState: 'connecting' | 'open' | 'closed' = 'connecting';
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  peer: FakeChannel | undefined;
  sent: string[] = [];
  send(text: string): void {
    this.sent.push(text);
    this.peer?.onmessage?.({ data: text });
  }
  close(): void {
    this.readyState = 'closed';
  }
  open(): void {
    this.readyState = 'open';
    this.onopen?.(new Event('open'));
  }
}

let nextId = 0;
const registry = new Map<string, FakePC>();

class FakePC {
  id = `pc${(nextId += 1)}`;
  onicecandidate: ((e: { candidate: { candidate: string; toJSON(): object } | null }) => void) | null = null;
  ondatachannel: ((e: { channel: FakeChannel }) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  iceConnectionState = 'new';
  connectionState = 'new';
  channel: FakeChannel | undefined;
  remoteDescription: { type: string; sdp: string } | undefined;
  addedCandidates: unknown[] = [];
  closed = false;
  /** 'ok' completes negotiation; 'stall' never opens the channel. */
  static mode: 'ok' | 'stall' = 'ok';
  static created: FakePC[] = [];
  constructor(readonly config: RTCConfiguration) {
    registry.set(this.id, this);
    FakePC.created.push(this);
  }
  createDataChannel(): FakeChannel {
    this.channel = new FakeChannel();
    return this.channel;
  }
  async createOffer(): Promise<{ type: 'offer'; sdp: string }> {
    return { type: 'offer', sdp: `offer:${this.id}` };
  }
  async createAnswer(): Promise<{ type: 'answer'; sdp: string }> {
    return { type: 'answer', sdp: `answer:${this.remoteDescription?.sdp.split(':')[1]}:${this.id}` };
  }
  async setLocalDescription(): Promise<void> {
    // Gather one host candidate.
    queueMicrotask(() => this.onicecandidate?.({ candidate: { candidate: `candidate:host ${this.id}`, toJSON: () => ({ candidate: `candidate:host ${this.id}` }) } }));
  }
  async setRemoteDescription(desc: { type: string; sdp: string }): Promise<void> {
    this.remoteDescription = desc;
    if (desc.type === 'answer' && FakePC.mode === 'ok') {
      const [, offererId, answererId] = desc.sdp.split(':');
      const answerer = registry.get(answererId);
      if (offererId !== this.id || !answerer) return;
      // Both ends of the channel come up.
      const mine = this.channel as FakeChannel;
      const theirs = new FakeChannel();
      mine.peer = theirs;
      theirs.peer = mine;
      answerer.channel = theirs;
      answerer.ondatachannel?.({ channel: theirs });
      queueMicrotask(() => {
        mine.open();
        theirs.open();
      });
    }
  }
  async addIceCandidate(candidate: unknown): Promise<void> {
    this.addedCandidates.push(candidate);
  }
  close(): void {
    this.closed = true;
  }
}

interface Net {
  signals: Array<{ from: string; to: string; kind: RtcSignalKind; connectionId: string }>;
  relayed: Array<{ from: string; to: string; channel: PeerChannel; payload: Record<string, unknown> }>;
  links: Record<string, PeerLink>;
  states: Record<string, Array<{ state: PeerTransport; detail?: string }>>;
  inbox: Record<string, PeerMessage[]>;
  online: Record<string, boolean>;
}

function makeNet(ids: [string, string], options: { timeoutMs?: number; noWebRtc?: boolean; online?: boolean } = {}): Net {
  const net: Net = {
    signals: [],
    relayed: [],
    links: {},
    states: { [ids[0]]: [], [ids[1]]: [] },
    inbox: { [ids[0]]: [], [ids[1]]: [] },
    online: { [ids[0]]: true, [ids[1]]: options.online ?? true },
  };
  for (const [self, remote] of [
    [ids[0], ids[1]],
    [ids[1], ids[0]],
  ] as const) {
    net.links[self] = new PeerLink({
      selfId: self,
      remoteId: remote,
      iceServers: [],
      connectTimeoutMs: options.timeoutMs ?? 1000,
      createPeerConnection: options.noWebRtc ? () => undefined as never : (config) => new FakePC(config) as unknown as RTCPeerConnection,
      sendSignal: async (input) => {
        net.signals.push({ from: self, to: input.to, kind: input.kind, connectionId: input.connectionId });
        const delivered = net.online[input.to];
        if (delivered) {
          const signal: RtcSignal = { from: self, to: input.to, kind: input.kind, connectionId: input.connectionId, payload: input.payload, ts: 0 };
          // Deliver asynchronously, like the SSE stream would.
          setTimeout(() => void net.links[input.to].handleSignal(signal), 0);
        }
        return { delivered };
      },
      sendRelay: async (input) => {
        net.relayed.push({ from: self, to: input.to, channel: input.channel, payload: input.payload });
        if (net.online[input.to]) {
          setTimeout(
            () => net.links[input.to].handleRelay({ from: self, to: input.to, channel: input.channel, payload: input.payload, ts: 0 }),
            0
          );
        }
      },
      onMessage: (m) => net.inbox[self].push(m),
      onState: (state, detail) => net.states[self].push({ state, detail }),
    });
  }
  return net;
}

const flush = async (ms = 20): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
  FakePC.mode = 'ok';
  FakePC.created = [];
  registry.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PeerLink', () => {
  it('negotiates a direct data channel through the signaling relay and exchanges messages P2P', async () => {
    const net = makeNet(['alice', 'bob']);
    await net.links.alice.connect();
    await net.links.bob.connect();
    await flush();

    expect(net.links.alice.state).toBe('p2p');
    expect(net.links.bob.state).toBe('p2p');
    // alice (smaller id) offered; bob answered; candidates flowed both ways.
    expect(net.signals.filter((s) => s.kind === 'offer').map((s) => s.from)).toEqual(['alice']);
    expect(net.signals.filter((s) => s.kind === 'answer').map((s) => s.from)).toEqual(['bob']);
    expect(net.signals.some((s) => s.kind === 'candidate')).toBe(true);
    // Host candidates only: no ICE servers were configured.
    expect(FakePC.created.every((pc) => (pc.config.iceServers ?? []).length === 0)).toBe(true);

    expect(await net.links.alice.send('ping', { n: 1 })).toBe('p2p');
    expect(await net.links.bob.send('cursor', { docId: 'notes', index: 7 })).toBe('p2p');
    expect(net.inbox.bob).toEqual([{ channel: 'ping', payload: { n: 1 }, via: 'p2p' }]);
    expect(net.inbox.alice).toEqual([{ channel: 'cursor', payload: { docId: 'notes', index: 7 }, via: 'p2p' }]);
    expect(net.relayed).toEqual([]); // nothing needed the server
  });

  it('only the smaller user id offers, so two simultaneous connects never produce crossing offers', async () => {
    const net = makeNet(['zoe', 'adam']);
    await Promise.all([net.links.zoe.connect(), net.links.adam.connect()]);
    await flush();
    expect(net.signals.filter((s) => s.kind === 'offer').map((s) => s.from)).toEqual(['adam']);
    expect(net.links.zoe.state).toBe('p2p');
  });

  it('falls back to the server relay when the channel does not open in time, and says why', async () => {
    FakePC.mode = 'stall';
    const net = makeNet(['alice', 'bob'], { timeoutMs: 500 });
    await net.links.alice.connect();
    await net.links.bob.connect();
    await flush(100);
    expect(net.links.alice.state).toBe('connecting');
    await flush(600);
    expect(net.links.alice.state).toBe('relay');
    expect(net.states.alice[net.states.alice.length - 1]).toEqual({ state: 'relay', detail: 'timeout' });
    expect(FakePC.created.every((pc) => pc.closed)).toBe(true);

    // Messages still arrive: through the relay.
    expect(await net.links.alice.send('ping', { n: 2 })).toBe('relay');
    await flush();
    expect(net.relayed).toEqual([{ from: 'alice', to: 'bob', channel: 'ping', payload: { n: 2 } }]);
    expect(net.inbox.bob).toEqual([{ channel: 'ping', payload: { n: 2 }, via: 'relay' }]);
  });

  it('falls back immediately when WebRTC is not available in the browser', async () => {
    const net = makeNet(['alice', 'bob'], { noWebRtc: true });
    await net.links.alice.connect();
    expect(net.links.alice.state).toBe('relay');
    expect(net.states.alice[net.states.alice.length - 1].detail).toBe('webrtc-unavailable');
    expect(await net.links.alice.send('ping', { n: 1 })).toBe('relay');
  });

  it('falls back when ICE fails, and again when an open channel closes', async () => {
    const net = makeNet(['alice', 'bob']);
    await net.links.alice.connect();
    await net.links.bob.connect();
    await flush();
    expect(net.links.alice.state).toBe('p2p');
    const pc = FakePC.created[0];
    pc.iceConnectionState = 'failed';
    pc.oniceconnectionstatechange?.();
    expect(net.links.alice.state).toBe('relay');
    expect(net.states.alice[net.states.alice.length - 1].detail).toBe('ice-failed');

    // A fresh attempt works again.
    await net.links.alice.connect();
    await flush();
    expect(net.links.alice.state).toBe('p2p');
    const channel = FakePC.created[FakePC.created.length - 2].channel as FakeChannel;
    channel.readyState = 'closed';
    channel.onclose?.(new Event('close'));
    expect(net.links.alice.state).toBe('relay');
  });

  it('treats a peer that is not online as "waiting" and starts over when asked again', async () => {
    const net = makeNet(['alice', 'bob'], { online: false, timeoutMs: 300 });
    await net.links.alice.connect();
    await flush(400);
    expect(net.links.alice.state).toBe('relay');
    net.online.bob = true;
    await net.links.alice.connect();
    await net.links.bob.connect();
    await flush();
    expect(net.links.alice.state).toBe('p2p');
  });

  it('ignores signals from other users, stale connection ids and stray offers', async () => {
    const net = makeNet(['alice', 'bob']);
    await net.links.bob.connect();
    const offer = (from: string, connectionId: string) =>
      net.links.bob.handleSignal({ from, to: 'bob', kind: 'offer', connectionId, payload: { sdp: 'offer:pcX' }, ts: 0 });
    await offer('mallory', 'c1');
    expect(FakePC.created).toHaveLength(0);
    // alice (smaller id) is the offerer: a stray offer FROM bob to alice is ignored.
    await net.links.alice.handleSignal({ from: 'bob', to: 'alice', kind: 'offer', connectionId: 'c2', payload: { sdp: 'x' }, ts: 0 });
    expect(FakePC.created).toHaveLength(0);
    // An answer for an unknown connection id changes nothing.
    await net.links.alice.connect();
    const before = FakePC.created[0];
    await net.links.alice.handleSignal({ from: 'bob', to: 'alice', kind: 'answer', connectionId: 'stale', payload: { sdp: 'answer:x:y' }, ts: 0 });
    expect(before.remoteDescription).toBeUndefined();
  });

  it('queues candidates that arrive before the remote description', async () => {
    const net = makeNet(['alice', 'bob']);
    await net.links.alice.connect();
    const alicePc = FakePC.created[0];
    const connectionId = net.signals.find((s) => s.kind === 'offer')?.connectionId as string;
    await net.links.alice.handleSignal({
      from: 'bob',
      to: 'alice',
      kind: 'candidate',
      connectionId,
      payload: { candidate: { candidate: 'candidate:early' } },
      ts: 0,
    });
    expect(alicePc.addedCandidates).toEqual([]);
    await net.links.alice.handleSignal({ from: 'bob', to: 'alice', kind: 'answer', connectionId, payload: { sdp: 'answer:none:none' }, ts: 0 });
    expect(alicePc.addedCandidates).toEqual([{ candidate: 'candidate:early' }]);
    // Malformed candidates are dropped.
    await net.links.alice.handleSignal({ from: 'bob', to: 'alice', kind: 'candidate', connectionId, payload: { candidate: 'nope' }, ts: 0 });
    await net.links.alice.handleSignal({ from: 'bob', to: 'alice', kind: 'candidate', connectionId, payload: { candidate: { notCandidate: 1 } }, ts: 0 });
    expect(alicePc.addedCandidates).toHaveLength(1);
  });

  it('drops malformed or oversized data-channel messages', async () => {
    const net = makeNet(['alice', 'bob']);
    await net.links.alice.connect();
    await net.links.bob.connect();
    await flush();
    const channel = FakePC.created[0].channel as FakeChannel;
    const bobSide = channel.peer as FakeChannel;
    for (const raw of ['not json', JSON.stringify({ channel: 'shell', payload: {} }), JSON.stringify({ channel: 'ping', payload: [] }), JSON.stringify('x'), 'x'.repeat(5000), 42]) {
      bobSide.onmessage?.({ data: raw });
      channel.onmessage?.({ data: raw });
    }
    expect(net.inbox.alice).toEqual([]);
    expect(net.inbox.bob).toEqual([]);
  });

  it('closing tells the peer (bye) and the peer drops to the relay', async () => {
    const net = makeNet(['alice', 'bob']);
    await net.links.alice.connect();
    await net.links.bob.connect();
    await flush();
    net.links.alice.close();
    await flush();
    expect(net.links.alice.state).toBe('closed');
    expect(net.signals.some((s) => s.kind === 'bye' && s.from === 'alice')).toBe(true);
    expect(net.links.bob.state).toBe('relay');
    expect(net.states.bob[net.states.bob.length - 1].detail).toBe('peer-closed');
  });

  it('delivers relayed messages only from its own peer', () => {
    const net = makeNet(['alice', 'bob']);
    net.links.alice.handleRelay({ from: 'bob', to: 'alice', channel: 'ping', payload: { n: 1 }, ts: 0 });
    net.links.alice.handleRelay({ from: 'eve', to: 'alice', channel: 'ping', payload: { n: 2 }, ts: 0 });
    expect(net.inbox.alice).toEqual([{ channel: 'ping', payload: { n: 1 }, via: 'relay' }]);
  });
});
