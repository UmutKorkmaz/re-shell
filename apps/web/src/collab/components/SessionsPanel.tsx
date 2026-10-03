import * as React from 'react';
import { Badge, Button, Input, cn } from '@re-shell/ui';
import type { CollabSessionSummary } from '@re-shell/contracts';
import { RefreshCw, Users } from 'lucide-react';

import { Field, InlineError, Panel, formatDuration } from './shared';

export interface SessionsPanelProps {
  sessions: CollabSessionSummary[] | null;
  error: string | null;
  activeId: string | null;
  workspaces: Array<{ id: string; name: string }>;
  now: number;
  onJoin: (sessionId: string) => void;
  onCreate: (input: { workspaceId: string; title: string }) => void;
  onRefresh: () => void;
  creating?: boolean;
}

/** Sessions of the tenant, with a form to start a new one. */
export function SessionsPanel(props: SessionsPanelProps): React.ReactElement {
  const { sessions, error, activeId, workspaces, now } = props;
  const [workspaceId, setWorkspaceId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const chosen = workspaceId || workspaces[0]?.id || '';

  return (
    <Panel
      testId="collab-sessions"
      icon={<Users className="size-3.5 text-signal" />}
      title="Sessions"
      description="Shared sessions in this tenant. Join one to watch its console and edit its notes."
      actions={
        <Button type="button" variant="outline" size="sm" onClick={props.onRefresh} aria-label="Refresh sessions">
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      }
    >
      <form
        className="mb-5 grid gap-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-end"
        data-testid="collab-new-session"
        onSubmit={(event) => {
          event.preventDefault();
          if (chosen) props.onCreate({ workspaceId: chosen, title: title.trim() });
        }}
      >
        <Field id="collab-new-workspace" label="Workspace">
          <select
            id="collab-new-workspace"
            data-testid="collab-new-workspace"
            className="h-11 rounded-md border border-border bg-input px-3 font-mono text-[0.8125rem]"
            value={chosen}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.length === 0 ? <option value="">(no workspaces)</option> : null}
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.id})
              </option>
            ))}
          </select>
        </Field>
        <Field id="collab-new-title" label="Title (optional)">
          <Input
            id="collab-new-title"
            data-testid="collab-new-title"
            value={title}
            placeholder="Pairing on the API"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Button type="submit" data-testid="collab-create" disabled={!chosen || props.creating}>
          Start session
        </Button>
      </form>

      {error ? <InlineError message={error} /> : null}
      {sessions === null && !error ? <p className="text-sm text-muted-foreground">Loading sessions...</p> : null}
      {sessions && sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="collab-no-sessions">
          No sessions yet. Start one above and share its id with a teammate.
        </p>
      ) : null}
      {sessions && sessions.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border" data-testid="collab-session-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              data-testid={`collab-session-${s.id}`}
              className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3', s.id === activeId && 'bg-bg-1')}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.title}</span>
                  <Badge variant={s.status === 'active' ? 'healthy' : 'outline'}>{s.status}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{s.workspaceId}</span> · owner {s.ownerId} · driver {s.driverId ?? 'nobody'} ·{' '}
                  {s.participantCount} participant{s.participantCount === 1 ? '' : 's'}, {s.onlineCount} online ·{' '}
                  {s.runCount} run{s.runCount === 1 ? '' : 's'} · {formatDuration(now - s.createdAt)} ago
                </p>
                <p className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">{s.id}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={s.id === activeId ? 'secondary' : 'outline'}
                data-testid={`collab-join-${s.id}`}
                onClick={() => props.onJoin(s.id)}
                disabled={s.id === activeId}
              >
                {s.id === activeId ? 'Joined' : s.status === 'active' ? 'Join' : 'View'}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
