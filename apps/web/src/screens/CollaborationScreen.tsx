import * as React from 'react';
import { ControlPlaneError } from '@re-shell/contracts';
import { Button } from '@re-shell/ui';

import { AnalyticsPanel, RANGE_MS, type AnalyticsRange } from '../collab/components/AnalyticsPanel';
import { ConnectionPanel } from '../collab/components/ConnectionPanel';
import { ConsolePanel } from '../collab/components/ConsolePanel';
import { EditorPanel } from '../collab/components/EditorPanel';
import { PresencePanel } from '../collab/components/PresencePanel';
import { SessionsPanel } from '../collab/components/SessionsPanel';
import { InlineError } from '../collab/components/shared';
import { parseIceOverride } from '../collab/connection-settings';
import { useCollabSession, useSharedDoc } from '../collab/useCollabSession';
import { ControlPlaneProvider, useControlPlane } from '../collab/useControlPlane';
import { usePeers } from '../collab/usePeers';
import { useAnalytics, useEffectiveCommands, useSessionsList, useWorkspaces } from '../collab/useTenantData';

function describe(error: unknown): string {
  if (error instanceof ControlPlaneError) return `${error.message} (${error.code})`;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Collaboration: real-time pair programming on the hosted control plane. A shared
 * command console (output synchronized across participants), presence with direct
 * WebRTC links, a shared OT editor and team analytics. Everything here talks to the
 * control plane with the user's own token; nothing runs on the local hub.
 */
export function CollaborationScreen({ fetchImpl }: { fetchImpl?: typeof fetch } = {}): React.ReactElement {
  return (
    <ControlPlaneProvider fetchImpl={fetchImpl}>
      <CollaborationContent />
    </ControlPlaneProvider>
  );
}

function CollaborationContent(): React.ReactElement {
  const cp = useControlPlane();
  const { client, tenantId, identity } = cp;
  const connected = cp.status === 'connected' && client !== null && tenantId !== null;

  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [docId, setDocId] = React.useState<string>('notes');
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [docError, setDocError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [range, setRange] = React.useState<AnalyticsRange>('7d');

  // Forget the open session when the connection changes.
  React.useEffect(() => {
    if (!connected) setSessionId(null);
  }, [connected]);

  const list = useSessionsList(connected ? client : null, tenantId);
  const workspaces = useWorkspaces(connected ? client : null, tenantId);
  const live = useCollabSession(connected ? client : null, tenantId, sessionId);
  const state = live.state;
  const commandIds = useEffectiveCommands(connected ? client : null, tenantId, state?.session.workspaceId ?? null);
  const analytics = useAnalytics(connected ? client : null, tenantId, RANGE_MS[range]);

  const docs = state?.docs ?? [];
  const activeDocId = docs.some((d) => d.id === docId) ? docId : (docs[0]?.id ?? null);
  const view = useSharedDoc(
    connected ? client : null,
    live.connection,
    activeDocId,
    activeDocId !== null && state?.session.status === 'active'
  );

  // Read-only history for ended sessions: show the stored text without live editing.
  const endedDoc = state?.session.status === 'ended' ? docs.find((d) => d.id === activeDocId) : undefined;
  const effectiveView = endedDoc ? { ...view, text: endedDoc.content, rev: endedDoc.rev, dirty: false } : view;

  const override = parseIceOverride(cp.settings.iceServers);
  const iceServers = React.useMemo<RTCIceServer[]>(() => {
    const fromServer = (state?.rtc.iceServers ?? []) as RTCIceServer[];
    return override.ok && override.servers.length > 0 ? (override.servers as RTCIceServer[]) : fromServer;
  }, [state?.rtc.iceServers, override.ok, override.ok ? override.servers : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const peers = usePeers({
    client: connected ? client : null,
    connection: live.connection,
    tenantId,
    sessionId,
    selfId: identity?.userId ?? null,
    online: state?.online ?? [],
    iceServers,
  });

  const run = async <T,>(action: () => Promise<T>, onError: (message: string) => void): Promise<T | undefined> => {
    setBusy(true);
    onError('');
    try {
      return await action();
    } catch (error) {
      onError(describe(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const joinSession = (id: string): void => {
    setActionError(null);
    setDocError(null);
    setDocId('notes');
    setSessionId(id);
  };

  return (
    <div className="stagger-children screen-enter grid gap-4" data-testid="collab-screen">
      <ConnectionPanel
        settings={cp.settings}
        status={cp.status}
        error={cp.error}
        warning={cp.warning}
        identity={identity}
        tenantId={tenantId}
        role={cp.role}
        onChange={cp.updateSettings}
        onConnect={() => void cp.connect()}
        onDisconnect={cp.disconnect}
        onForgetToken={cp.forgetToken}
      />

      {connected && client && tenantId ? (
        <>
          <SessionsPanel
            sessions={list.sessions}
            error={list.error}
            activeId={sessionId}
            workspaces={workspaces}
            now={Date.now()}
            creating={busy}
            onRefresh={list.refresh}
            onJoin={joinSession}
            onCreate={(input) =>
              void run(
                async () => {
                  const created = await client.createSession(tenantId, {
                    workspaceId: input.workspaceId,
                    ...(input.title ? { title: input.title } : {}),
                  });
                  list.refresh();
                  joinSession(created.session.id);
                },
                (m) => setActionError(m || null)
              )
            }
          />
          {actionError && !state ? <InlineError message={actionError} /> : null}

          {sessionId ? (
            <div className="grid gap-4" data-testid="collab-session-view">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold tracking-tight" data-testid="collab-session-title">
                  {state ? state.session.title : 'Joining...'}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground" data-testid="collab-session-id">
                    {sessionId}
                  </span>
                  <span className="sr-only">connection {live.status}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="collab-leave"
                    onClick={() =>
                      void run(
                        async () => {
                          await client.leaveSession(tenantId, sessionId);
                          setSessionId(null);
                          list.refresh();
                        },
                        (m) => setActionError(m || null)
                      )
                    }
                  >
                    Leave
                  </Button>
                  {state && state.session.status === 'active' && (state.session.ownerId === identity?.userId || cp.role === 'admin') ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="collab-end"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          async () => {
                            await client.endSession(tenantId, sessionId);
                            list.refresh();
                          },
                          (m) => setActionError(m || null)
                        )
                      }
                    >
                      End session
                    </Button>
                  ) : null}
                </div>
              </div>
              {live.error ? <InlineError message={live.error} /> : null}
              {!state ? <p className="text-sm text-muted-foreground">Connecting to the session...</p> : null}

              {state ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                  <div className="grid content-start gap-4">
                    <ConsolePanel
                      state={state}
                      selfId={identity?.userId ?? null}
                      commandIds={commandIds}
                      busy={busy}
                      error={actionError}
                      onRun={(commandId, paramsText) =>
                        void run(
                          async () => {
                            let params: Record<string, unknown> = {};
                            if (paramsText.trim() !== '') {
                              const parsed: unknown = JSON.parse(paramsText);
                              if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                                throw new Error('Parameters must be a JSON object.');
                              }
                              params = parsed as Record<string, unknown>;
                            }
                            await client.run(tenantId, sessionId, commandId, params);
                          },
                          (m) => setActionError(m || null)
                        )
                      }
                      onCancel={() => void run(() => client.cancel(tenantId, sessionId), (m) => setActionError(m || null))}
                      onHandover={(userId) =>
                        void run(() => client.handover(tenantId, sessionId, userId), (m) => setActionError(m || null))
                      }
                    />
                    <EditorPanel
                      docs={docs}
                      docId={activeDocId}
                      onSelectDoc={setDocId}
                      view={effectiveView}
                      readOnly={state.session.status !== 'active'}
                      onCaret={peers.shareCursor}
                      createError={docError}
                      onCreateDoc={(input) =>
                        void run(
                          async () => {
                            await client.createDoc(tenantId, sessionId, input);
                            setDocId(input.docId);
                          },
                          (m) => setDocError(m || null)
                        )
                      }
                    />
                  </div>
                  <div className="grid content-start gap-4">
                    <PresencePanel
                      state={state}
                      selfId={identity?.userId ?? null}
                      peers={peers.peers}
                      pings={peers.pings}
                      cursors={peers.cursors}
                      docText={(id) => state.docs.find((d) => d.id === id)?.content}
                      onPing={(userId) => void peers.ping(userId)}
                      onReconnect={peers.reconnect}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <AnalyticsPanel
            analytics={analytics.analytics}
            error={analytics.error}
            loading={analytics.loading}
            range={range}
            onRange={setRange}
            onRefresh={analytics.refresh}
          />
        </>
      ) : null}
    </div>
  );
}
