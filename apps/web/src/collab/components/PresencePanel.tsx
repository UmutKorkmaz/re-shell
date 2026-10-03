import * as React from 'react';
import { Badge, Button, cn } from '@re-shell/ui';
import type { CollabSnapshot } from '@re-shell/contracts';
import { Radio } from 'lucide-react';

import type { PeerView, PingRecord, RemoteCursor } from '../usePeers';
import { Panel } from './shared';

export interface PresencePanelProps {
  state: CollabSnapshot;
  selfId: string | null;
  peers: Record<string, PeerView>;
  pings: PingRecord[];
  cursors: Record<string, RemoteCursor>;
  /** Text of the document a cursor refers to, to show line:column. */
  docText: (docId: string) => string | undefined;
  onPing: (userId: string) => void;
  onReconnect: (userId: string) => void;
}

const TRANSPORT_LABEL: Record<string, string> = {
  idle: 'not connected',
  connecting: 'connecting...',
  p2p: 'direct (WebRTC)',
  relay: 'via server relay',
  closed: 'closed',
};

function lineColumn(text: string | undefined, index: number): string {
  if (text === undefined) return `offset ${index}`;
  const before = text.slice(0, Math.min(index, text.length));
  const line = before.split('\n').length;
  const column = before.length - (before.lastIndexOf('\n') + 1) + 1;
  return `line ${line}, col ${column}`;
}

/** Who is here, who is driving, and the state of each direct (WebRTC) link. */
export function PresencePanel(props: PresencePanelProps): React.ReactElement {
  const { state, selfId, peers, pings, cursors } = props;
  const online = new Set(state.online);
  const lastPing = pings[pings.length - 1];

  return (
    <Panel
      testId="collab-presence"
      icon={<Radio className="size-3.5 text-signal" />}
      title="Presence"
      description="Direct peer links carry cursors and pings; if a direct link cannot be made they fall back to the server relay."
    >
      <ul className="grid gap-3" data-testid="collab-participants">
        {state.participants.map((p) => {
          const peer = peers[p.userId];
          const isSelf = p.userId === selfId;
          const cursor = cursors[p.userId];
          return (
            <li
              key={p.userId}
              data-testid={`collab-participant-${p.userId}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 rounded-full', online.has(p.userId) ? 'bg-healthy' : 'bg-border-strong')}
                  />
                  <span className="font-medium">{p.userId}</span>
                  {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                  <Badge variant={p.role === 'driver' ? 'info' : 'outline'}>{p.role}</Badge>
                  <span className="sr-only">{online.has(p.userId) ? 'online' : 'offline'}</span>
                </div>
                {!isSelf ? (
                  <p className="mt-1 text-xs text-muted-foreground" data-testid={`collab-peer-${p.userId}`}>
                    link: <span data-testid={`collab-peer-transport-${p.userId}`}>{peer ? peer.transport : 'idle'}</span>
                    {' · '}
                    {TRANSPORT_LABEL[peer?.transport ?? 'idle']}
                    {peer?.detail ? ` (${peer.detail})` : ''}
                    {cursor ? ` · cursor in "${cursor.docId}" at ${lineColumn(props.docText(cursor.docId), cursor.index)}` : ''}
                  </p>
                ) : null}
              </div>
              {!isSelf ? (
                <div className="flex gap-2">
                  {peer && (peer.transport === 'relay' || peer.transport === 'idle') ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      data-testid={`collab-reconnect-${p.userId}`}
                      onClick={() => props.onReconnect(p.userId)}
                      disabled={!online.has(p.userId)}
                    >
                      Retry direct link
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`collab-ping-${p.userId}`}
                    onClick={() => props.onPing(p.userId)}
                    disabled={!online.has(p.userId)}
                  >
                    Ping
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
        {state.participants.length === 0 ? <li className="text-sm text-muted-foreground">Nobody has joined yet.</li> : null}
      </ul>
      <p className="mt-3 text-sm" data-testid="collab-last-ping" aria-live="polite">
        {lastPing ? (
          <>
            Ping from <span className="font-medium">{lastPing.from}</span> via{' '}
            <span data-testid="collab-last-ping-via">{lastPing.via === 'p2p' ? 'direct data channel' : 'server relay'}</span>{' '}
            (#{lastPing.n})
          </>
        ) : (
          <span className="text-muted-foreground">No pings yet.</span>
        )}
      </p>
    </Panel>
  );
}
