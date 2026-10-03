import { peerChannelSchema, type PeerChannel, type RelayMessage, type RtcSignal, type RtcSignalKind } from '@re-shell/contracts';

/**
 * One peer-to-peer link between this participant and ONE other participant of a
 * shared session, for low-latency presence, cursors and pairing pings.
 *
 * Transport:
 *   1. WebRTC data channel. The control plane relays the offer / answer / ICE
 *      candidates between the two (authenticated, same session, same tenant) and
 *      is otherwise out of the data path. With no ICE servers configured (the
 *      default) only HOST candidates are gathered; STUN/TURN come from the
 *      server's configuration or an explicit override.
 *   2. FALLBACK: if the channel does not open in time, ICE fails, the channel
 *      closes, or WebRTC does not exist in this browser, messages go through the
 *      control plane's relay endpoint instead. The state says which is in use
 *      (`p2p` or `relay`); nothing is silently dropped.
 *
 * The side with the lexicographically smaller user id is the offerer, so two
 * peers that both press "connect" never produce a glare of crossing offers.
 */

export type PeerTransport = 'idle' | 'connecting' | 'p2p' | 'relay' | 'closed';

export interface PeerMessage {
  channel: PeerChannel;
  payload: Record<string, unknown>;
  via: 'p2p' | 'relay';
}

export interface PeerLinkOptions {
  selfId: string;
  remoteId: string;
  iceServers: RTCIceServer[];
  sendSignal: (input: {
    to: string;
    kind: RtcSignalKind;
    connectionId: string;
    payload: Record<string, unknown>;
  }) => Promise<{ delivered: boolean }>;
  sendRelay: (input: { to: string; channel: PeerChannel; payload: Record<string, unknown> }) => Promise<unknown>;
  onMessage: (message: PeerMessage) => void;
  onState: (state: PeerTransport, detail?: string) => void;
  /** How long to wait for the data channel before falling back to the relay. */
  connectTimeoutMs?: number;
  /** Test seam. Defaults to `new RTCPeerConnection(config)` when the browser has one. */
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
}

const CHANNEL_LABEL = 'rs-collab';
const MAX_MESSAGE_BYTES = 4 * 1024;

function randomId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class PeerLink {
  private _state: PeerTransport = 'idle';
  private detail: string | undefined;
  private pc: RTCPeerConnection | undefined;
  private channel: RTCDataChannel | undefined;
  private connectionId: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private generation = 0;

  constructor(private readonly options: PeerLinkOptions) {}

  get state(): PeerTransport {
    return this._state;
  }

  get remoteId(): string {
    return this.options.remoteId;
  }

  private get isOfferer(): boolean {
    return this.options.selfId < this.options.remoteId;
  }

  private setState(state: PeerTransport, detail?: string): void {
    if (this._state === state && this.detail === detail) return;
    this._state = state;
    this.detail = detail;
    this.options.onState(state, detail);
  }

  private makePeerConnection(): RTCPeerConnection | undefined {
    const config: RTCConfiguration = { iceServers: this.options.iceServers };
    if (this.options.createPeerConnection) return this.options.createPeerConnection(config);
    if (typeof RTCPeerConnection === 'undefined') return undefined;
    return new RTCPeerConnection(config);
  }

  /** Begin (or restart) the attempt to open a direct channel. Safe to call again after a fallback. */
  async connect(): Promise<void> {
    if (this._state === 'connecting' || this._state === 'p2p') return;
    this.teardown();
    const generation = ++this.generation;
    this.connectionId = randomId();
    this.setState('connecting');
    this.armTimeout(generation);
    if (!this.isOfferer) {
      // Wait for the offerer's offer; handleSignal builds the connection.
      return;
    }
    const pc = this.makePeerConnection();
    if (!pc) {
      this.fallback('webrtc-unavailable', generation);
      return;
    }
    this.attach(pc, generation);
    try {
      this.setupChannel(pc.createDataChannel(CHANNEL_LABEL, { ordered: true }), generation);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (generation !== this.generation) return;
      const sent = await this.options.sendSignal({
        to: this.options.remoteId,
        kind: 'offer',
        connectionId: this.connectionId as string,
        payload: { type: 'offer', sdp: offer.sdp ?? '' },
      });
      if (!sent.delivered && generation === this.generation) {
        // The peer has no live stream yet: nobody to answer. The timeout will fall back to the relay,
        // and a later connect() (when the peer appears) starts over.
        this.detail = 'waiting-for-peer';
      }
    } catch (error) {
      this.fallback(`offer-failed: ${error instanceof Error ? error.message : String(error)}`, generation);
    }
  }

  private armTimeout(generation: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.fallback('timeout', generation);
    }, this.options.connectTimeoutMs ?? 8000);
  }

  private attach(pc: RTCPeerConnection, generation: number): void {
    this.pc = pc;
    pc.onicecandidate = (event) => {
      if (!event.candidate || generation !== this.generation || !this.connectionId) return;
      void this.options
        .sendSignal({
          to: this.options.remoteId,
          kind: 'candidate',
          connectionId: this.connectionId,
          payload: { candidate: event.candidate.toJSON ? event.candidate.toJSON() : { candidate: event.candidate.candidate } },
        })
        .catch(() => undefined);
    };
    pc.ondatachannel = (event) => this.setupChannel(event.channel, generation);
    pc.oniceconnectionstatechange = () => {
      if (generation !== this.generation) return;
      if (pc.iceConnectionState === 'failed') this.fallback('ice-failed', generation);
    };
    pc.onconnectionstatechange = () => {
      if (generation !== this.generation) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.fallback(`connection-${pc.connectionState}`, generation);
      }
    };
  }

  private setupChannel(channel: RTCDataChannel, generation: number): void {
    this.channel = channel;
    channel.onopen = () => {
      if (generation !== this.generation) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      this.setState('p2p');
    };
    channel.onclose = () => {
      if (generation !== this.generation) return;
      if (this._state === 'p2p' || this._state === 'connecting') this.fallback('channel-closed', generation);
    };
    channel.onerror = () => {
      if (generation !== this.generation) return;
      this.fallback('channel-error', generation);
    };
    channel.onmessage = (event) => this.onChannelMessage(event.data);
    if (channel.readyState === 'open') channel.onopen?.(new Event('open'));
  }

  private onChannelMessage(data: unknown): void {
    if (typeof data !== 'string' || data.length > MAX_MESSAGE_BYTES) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) return;
    const { channel, payload } = parsed as { channel?: unknown; payload?: unknown };
    const ch = peerChannelSchema.safeParse(channel);
    if (!ch.success || typeof payload !== 'object' || payload === null || Array.isArray(payload)) return;
    this.options.onMessage({ channel: ch.data, payload: payload as Record<string, unknown>, via: 'p2p' });
  }

  /** Feed a signaling message addressed to this link (from the session stream). */
  async handleSignal(signal: RtcSignal): Promise<void> {
    if (signal.from !== this.options.remoteId) return;
    if (signal.kind === 'bye') {
      if (signal.connectionId === this.connectionId) this.fallback('peer-closed', this.generation);
      return;
    }
    if (signal.kind === 'offer') {
      if (this.isOfferer) return; // glare: the smaller id offers; ignore a stray offer
      const sdp = typeof signal.payload.sdp === 'string' ? signal.payload.sdp : undefined;
      if (!sdp) return;
      // A new offer always starts a new attempt.
      this.teardown();
      const generation = ++this.generation;
      this.connectionId = signal.connectionId;
      this.setState('connecting');
      this.armTimeout(generation);
      const pc = this.makePeerConnection();
      if (!pc) {
        this.fallback('webrtc-unavailable', generation);
        return;
      }
      this.attach(pc, generation);
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp });
        this.remoteDescriptionSet = true;
        await this.flushCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (generation !== this.generation) return;
        await this.options.sendSignal({
          to: this.options.remoteId,
          kind: 'answer',
          connectionId: signal.connectionId,
          payload: { type: 'answer', sdp: answer.sdp ?? '' },
        });
      } catch (error) {
        this.fallback(`answer-failed: ${error instanceof Error ? error.message : String(error)}`, generation);
      }
      return;
    }
    if (signal.connectionId !== this.connectionId || !this.pc) return;
    if (signal.kind === 'answer') {
      const sdp = typeof signal.payload.sdp === 'string' ? signal.payload.sdp : undefined;
      if (!sdp) return;
      try {
        await this.pc.setRemoteDescription({ type: 'answer', sdp });
        this.remoteDescriptionSet = true;
        await this.flushCandidates(this.pc);
      } catch (error) {
        this.fallback(`answer-rejected: ${error instanceof Error ? error.message : String(error)}`, this.generation);
      }
      return;
    }
    if (signal.kind === 'candidate') {
      const candidate = signal.payload.candidate;
      if (typeof candidate !== 'object' || candidate === null) return;
      const init = candidate as RTCIceCandidateInit;
      if (typeof init.candidate !== 'string') return;
      if (!this.remoteDescriptionSet) {
        this.pendingCandidates.push(init);
        return;
      }
      try {
        await this.pc.addIceCandidate(init);
      } catch {
        // A stale or malformed candidate is not fatal; the timeout covers a connection that never forms.
      }
    }
  }

  private async flushCandidates(pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // see handleSignal
      }
    }
  }

  /** Deliver a message the server relayed to us (the sender could not use a data channel). */
  handleRelay(message: RelayMessage): void {
    if (message.from !== this.options.remoteId) return;
    this.options.onMessage({ channel: message.channel, payload: message.payload, via: 'relay' });
  }

  /** Send over the data channel when it is open, otherwise through the control plane relay. */
  async send(channel: PeerChannel, payload: Record<string, unknown>): Promise<'p2p' | 'relay'> {
    if (this.channel && this.channel.readyState === 'open') {
      const text = JSON.stringify({ channel, payload });
      if (text.length <= MAX_MESSAGE_BYTES) {
        this.channel.send(text);
        return 'p2p';
      }
    }
    await this.options.sendRelay({ to: this.options.remoteId, channel, payload });
    return 'relay';
  }

  private fallback(reason: string, generation: number): void {
    if (generation !== this.generation || this._state === 'closed') return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.closeConnection();
    this.setState('relay', reason);
  }

  private closeConnection(): void {
    const channel = this.channel;
    const pc = this.pc;
    this.channel = undefined;
    this.pc = undefined;
    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];
    try {
      if (channel) {
        channel.onopen = channel.onclose = channel.onerror = channel.onmessage = null;
        channel.close();
      }
    } catch {
      // already closed
    }
    try {
      if (pc) {
        pc.onicecandidate = pc.ondatachannel = pc.oniceconnectionstatechange = pc.onconnectionstatechange = null;
        pc.close();
      }
    } catch {
      // already closed
    }
  }

  private teardown(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.closeConnection();
  }

  /** Tell the peer, release the connection and stop. */
  close(): void {
    const id = this.connectionId;
    this.generation += 1;
    this.teardown();
    if (id && this._state !== 'closed' && this._state !== 'idle') {
      void this.options
        .sendSignal({ to: this.options.remoteId, kind: 'bye', connectionId: id, payload: {} })
        .catch(() => undefined);
    }
    this.setState('closed');
  }
}
