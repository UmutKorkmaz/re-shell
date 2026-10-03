import * as React from 'react';
import type { CollabConnection, ControlPlaneClient, PeerChannel } from '@re-shell/contracts';

import { PeerLink, type PeerMessage, type PeerTransport } from './peer-link';

export interface PeerView {
  userId: string;
  transport: PeerTransport;
  detail?: string;
}

export interface PingRecord {
  from: string;
  /** Local receive time (ms). */
  at: number;
  via: 'p2p' | 'relay';
  n: number;
}

export interface RemoteCursor {
  docId: string;
  index: number;
  via: 'p2p' | 'relay';
}

export interface PeersApi {
  peers: Record<string, PeerView>;
  pings: PingRecord[];
  cursors: Record<string, RemoteCursor>;
  /** Send a ping to one peer (p2p when open, relay otherwise). */
  ping: (userId: string) => Promise<'p2p' | 'relay' | 'none'>;
  /** Share the caret position of a document with every peer. */
  shareCursor: (docId: string, index: number) => void;
  /** (Re)attempt a direct connection to a peer. */
  reconnect: (userId: string) => void;
}

const MAX_PEERS = 8;

/**
 * Keeps one {@link PeerLink} per other online participant of the session:
 * signaling flows through the session stream, messages go over the data channel
 * with the server relay as fallback.
 */
export function usePeers(options: {
  client: ControlPlaneClient | null;
  connection: CollabConnection | null;
  tenantId: string | null;
  sessionId: string | null;
  selfId: string | null;
  online: readonly string[];
  /** ICE servers for this session (server-provided, or the user's override). Empty = host candidates only. */
  iceServers: RTCIceServer[];
  connectTimeoutMs?: number;
  /** Test seam passed through to each link. */
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
}): PeersApi {
  const { client, connection, tenantId, sessionId, selfId, online, iceServers, connectTimeoutMs, createPeerConnection } = options;
  const [peers, setPeers] = React.useState<Record<string, PeerView>>({});
  const [pings, setPings] = React.useState<PingRecord[]>([]);
  const [cursors, setCursors] = React.useState<Record<string, RemoteCursor>>({});
  const links = React.useRef(new Map<string, PeerLink>());
  const previouslyOnline = React.useRef(new Set<string>());
  const iceKey = JSON.stringify(iceServers);

  const ensureLink = React.useCallback(
    (userId: string): PeerLink | undefined => {
      if (!client || !tenantId || !sessionId || !selfId) return undefined;
      const existing = links.current.get(userId);
      if (existing) return existing;
      if (links.current.size >= MAX_PEERS) return undefined;
      const link = new PeerLink({
        selfId,
        remoteId: userId,
        iceServers,
        connectTimeoutMs,
        createPeerConnection,
        sendSignal: (input) => client.signal(tenantId, sessionId, input),
        sendRelay: (input) => client.relay(tenantId, sessionId, input),
        onState: (transport, detail) =>
          setPeers((prev) => ({ ...prev, [userId]: { userId, transport, ...(detail ? { detail } : {}) } })),
        onMessage: (message: PeerMessage) => {
          if (message.channel === 'ping') {
            const n = typeof message.payload.n === 'number' ? message.payload.n : 0;
            setPings((prev) => [...prev.slice(-19), { from: userId, at: Date.now(), via: message.via, n }]);
          } else if (message.channel === 'cursor') {
            const { docId, index } = message.payload;
            if (typeof docId === 'string' && typeof index === 'number' && Number.isFinite(index) && index >= 0) {
              setCursors((prev) => ({ ...prev, [userId]: { docId, index, via: message.via } }));
            }
          }
        },
      });
      links.current.set(userId, link);
      setPeers((prev) => ({ ...prev, [userId]: { userId, transport: 'idle' } }));
      return link;
    },
    // iceKey stands in for the iceServers array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, tenantId, sessionId, selfId, iceKey, connectTimeoutMs, createPeerConnection]
  );

  // Route signaling and relayed messages from the stream to the right link.
  React.useEffect(() => {
    if (!connection) return;
    const offs = [
      connection.on('signal', (signal) => {
        void ensureLink(signal.from)?.handleSignal(signal);
      }),
      connection.on('relay', (message) => {
        ensureLink(message.from)?.handleRelay(message);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [connection, ensureLink]);

  // Open a link to everybody who is online; (re)try when a peer comes online.
  React.useEffect(() => {
    if (!selfId) return;
    const present = new Set(online.filter((u) => u !== selfId));
    for (const userId of present) {
      const link = ensureLink(userId);
      if (!link) continue;
      const cameOnline = !previouslyOnline.current.has(userId);
      if (link.state === 'idle' || (cameOnline && (link.state === 'relay' || link.state === 'closed'))) {
        void link.connect();
      }
    }
    // Close links of peers that WERE online and left. A link created on demand by an incoming offer for a
    // peer whose presence has not arrived yet is left alone.
    for (const userId of previouslyOnline.current) {
      const link = links.current.get(userId);
      if (link && !present.has(userId)) {
        link.close();
        links.current.delete(userId);
        setPeers((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
        setCursors((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    }
    previouslyOnline.current = present;
  }, [online, selfId, ensureLink]);

  // Tear everything down when the session or connection goes away.
  React.useEffect(() => {
    const current = links.current;
    return () => {
      for (const link of current.values()) link.close();
      current.clear();
      previouslyOnline.current = new Set();
      setPeers({});
      setCursors({});
    };
  }, [connection, sessionId]);

  const pingCounter = React.useRef(0);
  const ping = React.useCallback(async (userId: string): Promise<'p2p' | 'relay' | 'none'> => {
    const link = links.current.get(userId);
    if (!link) return 'none';
    pingCounter.current += 1;
    return link.send('ping', { n: pingCounter.current });
  }, []);

  const lastCursorSent = React.useRef(0);
  const shareCursor = React.useCallback((docId: string, index: number): void => {
    const now = Date.now();
    if (now - lastCursorSent.current < 250) return;
    lastCursorSent.current = now;
    for (const link of links.current.values()) {
      const channel: PeerChannel = 'cursor';
      void link.send(channel, { docId, index }).catch(() => undefined);
    }
  }, []);

  const reconnect = React.useCallback((userId: string): void => {
    const link = links.current.get(userId);
    if (link && link.state !== 'connecting' && link.state !== 'p2p') void link.connect();
  }, []);

  return { peers, pings, cursors, ping, shareCursor, reconnect };
}
