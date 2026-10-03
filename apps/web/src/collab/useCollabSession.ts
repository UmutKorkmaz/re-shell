import * as React from 'react';
import {
  SharedDocSync,
  type CollabConnection,
  type CollabSnapshot,
  type ConnectionStatus,
  type ControlPlaneClient,
} from '@re-shell/contracts';

export interface LiveSession {
  /** The live connection, once started (also usable to wait for state in tests). */
  connection: CollabConnection | null;
  /** The shared state, equal to the server's at `state.seq`. */
  state: CollabSnapshot | undefined;
  status: ConnectionStatus;
  error: string | null;
}

/**
 * Join the session and follow it live: a snapshot, then every ordered event
 * (the contracts reducer keeps `state` current), resuming from the last sequence
 * after a dropped connection. The user becomes a participant (idempotent).
 */
export function useCollabSession(
  client: ControlPlaneClient | null,
  tenantId: string | null,
  sessionId: string | null
): LiveSession {
  const [connection, setConnection] = React.useState<CollabConnection | null>(null);
  const [state, setState] = React.useState<CollabSnapshot | undefined>(undefined);
  const [status, setStatus] = React.useState<ConnectionStatus>('idle');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setState(undefined);
    setError(null);
    setConnection(null);
    if (!client || !tenantId || !sessionId) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    const conn = client.connect(tenantId, sessionId);
    const offs = [
      conn.on('state', (next) => {
        if (!cancelled) setState(next);
      }),
      conn.on('status', (next) => {
        if (!cancelled) setStatus(next);
      }),
      conn.on('error', (e) => {
        if (!cancelled) setError(e.message);
      }),
    ];
    client
      .joinSession(tenantId, sessionId)
      .catch((e: unknown) => {
        // An ended session cannot be joined but can still be watched; surface anything else.
        if (!cancelled && !(e instanceof Error && /SESSION_ENDED|ended/i.test(e.message))) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .then(() => conn.start())
      .then(() => {
        if (!cancelled) setConnection(conn);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      conn.close();
    };
  }, [client, tenantId, sessionId]);

  return { connection, state, status, error };
}

export interface SharedDocView {
  text: string;
  rev: number;
  dirty: boolean;
  /** The underlying sync object (cursor mapping subscribes to its change events). */
  doc: SharedDocSync | null;
  setText: (next: string) => void;
  error: string | null;
  /** Set when a resync discarded unsent local edits. */
  notice: string | null;
}

/** A collaborative text document (OT) bound to a live session connection. */
export function useSharedDoc(
  client: ControlPlaneClient | null,
  connection: CollabConnection | null,
  docId: string | null,
  exists: boolean
): SharedDocView {
  const [text, setTextState] = React.useState('');
  const [rev, setRev] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [doc, setDoc] = React.useState<SharedDocSync | null>(null);

  React.useEffect(() => {
    setError(null);
    setNotice(null);
    setDoc(null);
    if (!client || !connection || !docId || !exists) {
      setTextState('');
      return;
    }
    const sync = new SharedDocSync(client, connection, docId, { flushDelayMs: 120 });
    const refresh = (): void => {
      setTextState(sync.text);
      setRev(sync.rev);
      setDirty(sync.dirty);
    };
    const offs = [
      sync.on('change', refresh),
      sync.on('reset', (_t, info) => {
        refresh();
        if (info.lostLocalEdits) setNotice('The connection was out of sync; your unsent edits were discarded.');
      }),
      sync.on('error', (e) => setError(e.message)),
      // Acknowledgements change the revision and `dirty` without changing the text.
      connection.on('event', () => {
        setDirty(sync.dirty);
        setRev(sync.rev);
      }),
    ];
    refresh();
    setDoc(sync);
    return () => {
      offs.forEach((off) => off());
      sync.destroy();
    };
  }, [client, connection, docId, exists]);

  const setText = React.useCallback(
    (next: string): void => {
      doc?.setText(next);
    },
    [doc]
  );

  return { text, rev, dirty, doc, setText, error, notice };
}
