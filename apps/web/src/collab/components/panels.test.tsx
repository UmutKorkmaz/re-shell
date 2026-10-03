import type { CollabAnalytics, CollabSessionSummary, CollabSnapshot } from '@re-shell/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONNECTION } from '../connection-settings';
import { AnalyticsPanel } from './AnalyticsPanel';
import { ConnectionPanel } from './ConnectionPanel';
import { ConsolePanel } from './ConsolePanel';
import { EditorPanel } from './EditorPanel';
import { PresencePanel } from './PresencePanel';
import { SessionsPanel } from './SessionsPanel';
import { cleanOutput, formatDuration } from './shared';

function snapshot(overrides: Partial<CollabSnapshot> = {}): CollabSnapshot {
  return {
    seq: 12,
    session: {
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: 'acme',
      workspaceId: 'demo',
      title: 'Pairing',
      ownerId: 'alice',
      driverId: 'alice',
      status: 'active',
      createdAt: 1,
      endedAt: null,
    },
    participants: [
      { userId: 'alice', role: 'driver', joinedAt: 1 },
      { userId: 'bob', role: 'viewer', joinedAt: 2 },
    ],
    runs: [
      {
        jobId: 'j1',
        commandId: 'workspace.summary',
        params: {},
        requestedBy: 'alice',
        status: 'succeeded',
        exitCode: 0,
        errorCode: null,
        queuedAt: 1,
        startedAt: 2,
        finishedAt: 3,
        output: [
          { seq: 1, stream: 'stdout', data: '{"ok":' },
          { seq: 2, stream: 'stdout', data: 'true}\n\u001b[31mcolored\u001b[0m' },
        ],
      },
      {
        jobId: 'j2',
        commandId: 'doctor',
        params: {},
        requestedBy: 'alice',
        status: 'failed',
        exitCode: 3,
        errorCode: null,
        queuedAt: 4,
        startedAt: 5,
        finishedAt: 6,
        output: [],
      },
    ],
    currentJobId: null,
    docs: [{ id: 'notes', title: 'Runbook / notes', kind: 'notes', rev: 2, content: 'line one\nline two' }],
    online: ['alice', 'bob'],
    rtc: { iceServers: [] },
    ...overrides,
  };
}

describe('ConnectionPanel', () => {
  const base = {
    settings: { ...DEFAULT_CONNECTION, url: 'http://127.0.0.1:8787', token: 'tok', tenant: 'acme' },
    status: 'disconnected' as const,
    error: null,
    warning: null,
    identity: null,
    tenantId: null,
    role: null,
    onChange: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onForgetToken: vi.fn(),
  };

  it('edits URL, tenant and token and connects on submit', () => {
    const onChange = vi.fn();
    const onConnect = vi.fn();
    render(<ConnectionPanel {...base} onChange={onChange} onConnect={onConnect} />);
    fireEvent.change(screen.getByTestId('collab-url'), { target: { value: 'https://cp.example' } });
    fireEvent.change(screen.getByTestId('collab-tenant'), { target: { value: 'globex' } });
    fireEvent.change(screen.getByTestId('collab-token'), { target: { value: 'new' } });
    fireEvent.click(screen.getByTestId('collab-remember'));
    expect(onChange.mock.calls.map((c) => Object.keys(c[0])[0])).toEqual(['url', 'tenant', 'token', 'rememberToken']);
    expect(screen.getByTestId('collab-token')).toHaveAttribute('type', 'password');
    fireEvent.submit(screen.getByTestId('collab-connection-form'));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('collab-status')).toHaveTextContent('disconnected');
  });

  it('shows who is connected, and offers disconnect and forget', () => {
    const onDisconnect = vi.fn();
    const onForgetToken = vi.fn();
    render(
      <ConnectionPanel
        {...base}
        status="connected"
        identity={{ userId: 'alice', tenants: [{ tenantId: 'acme', role: 'operator' }] }}
        tenantId="acme"
        role="operator"
        onDisconnect={onDisconnect}
        onForgetToken={onForgetToken}
      />
    );
    expect(screen.getByTestId('collab-status')).toHaveTextContent('connected as alice');
    expect(screen.getByTestId('collab-identity')).toHaveTextContent('acme');
    fireEvent.click(screen.getByTestId('collab-disconnect'));
    fireEvent.click(screen.getByTestId('collab-forget'));
    expect(onDisconnect).toHaveBeenCalled();
    expect(onForgetToken).toHaveBeenCalled();
  });

  it('surfaces errors and warnings, and blocks connect on an invalid ICE override', () => {
    render(<ConnectionPanel {...base} status="error" error="The control plane rejected the token." warning="not https" settings={{ ...base.settings, iceServers: '{bad' }} />);
    expect(screen.getAllByRole('alert').map((n) => n.textContent)).toEqual(
      expect.arrayContaining(['The control plane rejected the token.', 'ICE servers must be valid JSON.'])
    );
    expect(screen.getByRole('status')).toHaveTextContent('not https');
    expect(screen.getByTestId('collab-connect')).toBeDisabled();
  });
});

describe('SessionsPanel', () => {
  const sessions: CollabSessionSummary[] = [
    { id: 's-1', tenantId: 'acme', workspaceId: 'demo', title: 'Pairing', ownerId: 'alice', driverId: 'alice', status: 'active', createdAt: 0, endedAt: null, participantCount: 2, onlineCount: 1, runCount: 3 },
    { id: 's-2', tenantId: 'acme', workspaceId: 'demo', title: 'Old', ownerId: 'bob', driverId: null, status: 'ended', createdAt: 0, endedAt: 5, participantCount: 1, onlineCount: 0, runCount: 0 },
  ];
  const props = { sessions, error: null, activeId: 's-1', workspaces: [{ id: 'demo', name: 'Demo' }, { id: 'other', name: 'Other' }], now: 120_000, onJoin: vi.fn(), onCreate: vi.fn(), onRefresh: vi.fn() };

  it('lists sessions with counts, marks the joined one and joins another', () => {
    const onJoin = vi.fn();
    render(<SessionsPanel {...props} onJoin={onJoin} />);
    const row = screen.getByTestId('collab-session-s-1');
    expect(row).toHaveTextContent('Pairing');
    expect(row).toHaveTextContent('2 participants, 1 online');
    expect(row).toHaveTextContent('3 runs');
    expect(screen.getByTestId('collab-join-s-1')).toBeDisabled();
    expect(screen.getByTestId('collab-join-s-2')).toHaveTextContent('View');
    fireEvent.click(screen.getByTestId('collab-join-s-2'));
    expect(onJoin).toHaveBeenCalledWith('s-2');
  });

  it('starts a session in the chosen workspace with a title', () => {
    const onCreate = vi.fn();
    render(<SessionsPanel {...props} onCreate={onCreate} />);
    fireEvent.change(screen.getByTestId('collab-new-workspace'), { target: { value: 'other' } });
    fireEvent.change(screen.getByTestId('collab-new-title'), { target: { value: ' Debug  ' } });
    fireEvent.click(screen.getByTestId('collab-create'));
    expect(onCreate).toHaveBeenCalledWith({ workspaceId: 'other', title: 'Debug' });
  });

  it('shows loading, empty and error states', () => {
    const { rerender } = render(<SessionsPanel {...props} sessions={null} />);
    expect(screen.getByText(/Loading sessions/)).toBeInTheDocument();
    rerender(<SessionsPanel {...props} sessions={[]} />);
    expect(screen.getByTestId('collab-no-sessions')).toBeInTheDocument();
    rerender(<SessionsPanel {...props} sessions={null} error="Forbidden (FORBIDDEN)" />);
    expect(screen.getByRole('alert')).toHaveTextContent('FORBIDDEN');
  });
});

describe('ConsolePanel', () => {
  const props = { commandIds: ['workspace.summary', 'doctor'], error: null, busy: false, onRun: vi.fn(), onCancel: vi.fn(), onHandover: vi.fn() };

  it('shows every run with its status and the identical ordered output (control sequences stripped)', () => {
    render(<ConsolePanel {...props} state={snapshot()} selfId="alice" />);
    expect(screen.getByTestId('collab-run-1')).toHaveTextContent('$ workspace.summary');
    expect(screen.getByTestId('collab-run-status-1')).toHaveTextContent('succeeded (exit 0)');
    expect(screen.getByTestId('collab-run-output-1').textContent).toBe('{"ok":true}\ncolored');
    expect(screen.getByTestId('collab-run-status-2')).toHaveTextContent('failed (exit 3)');
    expect(screen.getByTestId('collab-driver')).toHaveTextContent('driver: alice');
  });

  it('lets the driver run a command with parameters', () => {
    const onRun = vi.fn();
    render(<ConsolePanel {...props} onRun={onRun} state={snapshot()} selfId="alice" />);
    expect(screen.getByTestId('collab-run-command')).toHaveValue('workspace.summary');
    fireEvent.change(screen.getByTestId('collab-run-command'), { target: { value: 'doctor' } });
    fireEvent.change(screen.getByTestId('collab-run-params'), { target: { value: '{"cwd":"x"}' } });
    fireEvent.click(screen.getByTestId('collab-run'));
    expect(onRun).toHaveBeenCalledWith('doctor', '{"cwd":"x"}');
  });

  it('gives a viewer no run form and explains who drives', () => {
    render(<ConsolePanel {...props} state={snapshot()} selfId="bob" />);
    expect(screen.queryByTestId('collab-run-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('collab-viewer-note')).toHaveTextContent('Only the driver (alice) can run commands');
    expect(screen.queryByTestId('collab-handover')).not.toBeInTheDocument();
  });

  it('lets the driver hand over to another participant', () => {
    const onHandover = vi.fn();
    render(<ConsolePanel {...props} onHandover={onHandover} state={snapshot()} selfId="alice" />);
    expect(within(screen.getByTestId('collab-handover-select')).getAllByRole('option').map((o) => o.textContent)).toEqual(['bob']);
    fireEvent.click(screen.getByTestId('collab-handover'));
    expect(onHandover).toHaveBeenCalledWith('bob');
  });

  it('lets the owner take control back when someone else drives', () => {
    const onHandover = vi.fn();
    const state = snapshot({ session: { ...snapshot().session, driverId: 'bob' } });
    render(<ConsolePanel {...props} onHandover={onHandover} state={state} selfId="alice" />);
    expect(screen.getByTestId('collab-viewer-note')).toHaveTextContent('can take control');
    fireEvent.click(screen.getByTestId('collab-take-control'));
    expect(onHandover).toHaveBeenCalledWith('alice');
  });

  it('disables running while a command is in flight and offers cancel', () => {
    const onCancel = vi.fn();
    const state = snapshot({
      currentJobId: 'j3',
      runs: [
        ...snapshot().runs,
        { jobId: 'j3', commandId: 'doctor', params: {}, requestedBy: 'alice', status: 'running', exitCode: null, errorCode: null, queuedAt: 7, startedAt: 8, finishedAt: null, output: [] },
      ],
    });
    render(<ConsolePanel {...props} onCancel={onCancel} state={state} selfId="alice" />);
    expect(screen.getByTestId('collab-run')).toBeDisabled();
    fireEvent.click(screen.getByTestId('collab-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('is read-only history once the session has ended, and shows server errors', () => {
    const ended = snapshot({ session: { ...snapshot().session, status: 'ended', endedAt: 9 } });
    render(<ConsolePanel {...props} state={ended} selfId="alice" error="Only the driver can do that (NOT_SESSION_DRIVER)" />);
    expect(screen.queryByTestId('collab-run-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('collab-viewer-note')).toHaveTextContent('has ended');
    expect(screen.getByRole('alert')).toHaveTextContent('NOT_SESSION_DRIVER');
  });

  it('falls back to free command entry when the policy lists none', () => {
    render(<ConsolePanel {...props} commandIds={[]} state={snapshot()} selfId="alice" />);
    expect(screen.getByTestId('collab-run-command').tagName).toBe('INPUT');
  });
});

describe('PresencePanel', () => {
  const props = { onPing: vi.fn(), onReconnect: vi.fn(), docText: () => 'a\nbcd' };

  it('shows presence, the driver role and the transport of each direct link', () => {
    render(
      <PresencePanel
        {...props}
        state={snapshot({ online: ['alice'] })}
        selfId="alice"
        peers={{ bob: { userId: 'bob', transport: 'relay', detail: 'timeout' } }}
        pings={[]}
        cursors={{ bob: { docId: 'notes', index: 4, via: 'p2p' } }}
      />
    );
    expect(screen.getByTestId('collab-participant-alice')).toHaveTextContent('(you)');
    expect(screen.getByTestId('collab-participant-alice')).toHaveTextContent('driver');
    expect(screen.getByTestId('collab-peer-transport-bob')).toHaveTextContent('relay');
    expect(screen.getByTestId('collab-peer-bob')).toHaveTextContent('via server relay (timeout)');
    expect(screen.getByTestId('collab-peer-bob')).toHaveTextContent('line 2, col 3');
    // bob is offline: no pinging or retrying him.
    expect(screen.getByTestId('collab-ping-bob')).toBeDisabled();
    expect(screen.getByTestId('collab-reconnect-bob')).toBeDisabled();
  });

  it('pings an online peer and reports the last ping and how it arrived', () => {
    const onPing = vi.fn();
    const { rerender } = render(
      <PresencePanel {...props} onPing={onPing} state={snapshot()} selfId="alice" peers={{ bob: { userId: 'bob', transport: 'p2p' } }} pings={[]} cursors={{}} />
    );
    expect(screen.getByTestId('collab-peer-bob')).toHaveTextContent('direct (WebRTC)');
    fireEvent.click(screen.getByTestId('collab-ping-bob'));
    expect(onPing).toHaveBeenCalledWith('bob');
    expect(screen.getByTestId('collab-last-ping')).toHaveTextContent('No pings yet');
    rerender(
      <PresencePanel {...props} onPing={onPing} state={snapshot()} selfId="alice" peers={{ bob: { userId: 'bob', transport: 'p2p' } }} pings={[{ from: 'bob', at: 1, via: 'p2p', n: 3 }]} cursors={{}} />
    );
    expect(screen.getByTestId('collab-last-ping')).toHaveTextContent('Ping from bob');
    expect(screen.getByTestId('collab-last-ping-via')).toHaveTextContent('direct data channel');
  });
});

describe('EditorPanel', () => {
  const doc = snapshot().docs[0];
  const view = (over: Partial<Parameters<typeof EditorPanel>[0]['view']> = {}) => ({
    text: 'line one\nline two',
    rev: 2,
    dirty: false,
    doc: null,
    setText: vi.fn(),
    error: null,
    notice: null,
    ...over,
  });
  const props = { docs: [doc], docId: 'notes', onSelectDoc: vi.fn(), readOnly: false, onCaret: vi.fn(), onCreateDoc: vi.fn(), createError: null };

  it('edits through setText and shows the sync state', () => {
    const v = view();
    render(<EditorPanel {...props} view={v} />);
    const editor = screen.getByTestId('collab-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('line one\nline two');
    fireEvent.change(editor, { target: { value: 'line one\nline two!' } });
    expect(v.setText).toHaveBeenCalledWith('line one\nline two!');
    expect(screen.getByTestId('collab-editor-sync')).toHaveTextContent('synced · rev 2');
  });

  it('shows "saving" while edits are unacknowledged, notices and errors', () => {
    render(<EditorPanel {...props} view={view({ dirty: true, notice: 'edits discarded', error: 'boom' })} />);
    expect(screen.getByTestId('collab-editor-sync')).toHaveTextContent('saving');
    expect(screen.getByTestId('collab-editor-notice')).toHaveTextContent('edits discarded');
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('reports the caret for presence cursors', () => {
    const onCaret = vi.fn();
    render(<EditorPanel {...props} onCaret={onCaret} view={view()} />);
    const editor = screen.getByTestId('collab-editor') as HTMLTextAreaElement;
    editor.setSelectionRange(5, 5);
    fireEvent.select(editor);
    expect(onCaret).toHaveBeenCalledWith('notes', 5);
  });

  it('is read-only for ended sessions and creates a YAML draft that is never applied', () => {
    const onCreateDoc = vi.fn();
    const { rerender } = render(<EditorPanel {...props} onCreateDoc={onCreateDoc} view={view()} />);
    fireEvent.change(screen.getByTestId('collab-new-doc-name'), { target: { value: 'Workspace YAML' } });
    fireEvent.click(screen.getByTestId('collab-create-doc'));
    expect(onCreateDoc).toHaveBeenCalledWith({ docId: 'workspace-yaml', title: 'Workspace YAML', kind: 'yaml-draft' });

    const draft = { id: 'workspace-yaml', title: 'Workspace YAML', kind: 'yaml-draft' as const, rev: 0, content: '' };
    rerender(<EditorPanel {...props} docs={[doc, draft]} docId="workspace-yaml" view={view({ text: '' })} />);
    expect(screen.getByTestId('collab-yaml-note')).toHaveTextContent('never written to your workspace');
    expect(screen.getByTestId('collab-doc-notes')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('collab-doc-workspace-yaml')).toHaveAttribute('aria-selected', 'true');

    rerender(<EditorPanel {...props} readOnly view={view()} />);
    expect(screen.getByTestId('collab-editor')).toHaveAttribute('readonly');
    expect(screen.queryByTestId('collab-new-doc')).not.toBeInTheDocument();
  });
});

describe('AnalyticsPanel', () => {
  const analytics: CollabAnalytics = {
    tenantId: 'acme',
    window: { from: 0, to: 1000 },
    generatedAt: 1000,
    commands: {
      total: 5,
      succeeded: 3,
      failed: 1,
      canceled: 1,
      active: 0,
      successRate: 0.75,
      byUser: [{ userId: 'alice', total: 4, succeeded: 3, failed: 1, canceled: 0 }, { userId: 'bob', total: 1, succeeded: 0, failed: 0, canceled: 1 }],
      byWorkspace: [{ workspaceId: 'demo', total: 5, succeeded: 3, failed: 1, canceled: 1 }],
      byCommand: [{ commandId: 'workspace.summary', total: 5, succeeded: 3, failed: 1, canceled: 1 }],
    },
    sessions: {
      started: 2,
      active: 1,
      ended: 1,
      totalDurationMs: 180_000,
      avgDurationMs: 90_000,
      maxDurationMs: 120_000,
      distinctParticipants: 2,
      avgParticipants: 1.5,
      commandsRun: 4,
      byWorkspace: [{ workspaceId: 'demo', sessions: 2, totalDurationMs: 180_000 }],
    },
    audit: { allowed: 40, denied: 2, authFailures: 1, deniedByCode: [{ code: 'NOT_SESSION_DRIVER', count: 2 }] },
    timeline: { bucketMs: 60_000, buckets: [{ start: 0, commands: 2, failed: 1, sessions: 1 }, { start: 60_000, commands: 3, failed: 0, sessions: 1 }] },
  };

  it('renders the aggregates, tables and an accessible timeline', () => {
    render(<AnalyticsPanel analytics={analytics} error={null} loading={false} range="7d" onRange={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByTestId('collab-tile-commands')).toHaveTextContent('5');
    expect(screen.getByTestId('collab-tile-commands')).toHaveTextContent('3 ok · 1 failed · 1 canceled');
    expect(screen.getByTestId('collab-tile-success')).toHaveTextContent('75%');
    expect(screen.getByTestId('collab-tile-sessions')).toHaveTextContent('2');
    expect(screen.getByTestId('collab-tile-duration')).toHaveTextContent('2m');
    expect(screen.getByTestId('collab-tile-participants')).toHaveTextContent('1.5 per session');
    expect(screen.getByTestId('collab-tile-denied')).toHaveTextContent('2');
    expect(within(screen.getByTestId('collab-table-users')).getByText('alice')).toBeInTheDocument();
    expect(within(screen.getByTestId('collab-table-workspaces')).getByText('demo')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Commands over time: 5 in 2 intervals/ })).toBeInTheDocument();
  });

  it('switches the window, shows n/a without finished runs, and surfaces errors and loading', () => {
    const onRange = vi.fn();
    const empty = { ...analytics, commands: { ...analytics.commands, total: 0, successRate: null, byUser: [], byWorkspace: [], byCommand: [] }, sessions: { ...analytics.sessions, avgDurationMs: null, avgParticipants: null } };
    const { rerender } = render(<AnalyticsPanel analytics={empty} error={null} loading={false} range="24h" onRange={onRange} onRefresh={vi.fn()} />);
    expect(screen.getByTestId('collab-tile-success')).toHaveTextContent('n/a');
    expect(screen.getAllByText('No data in this window.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('collab-range-30d'));
    expect(onRange).toHaveBeenCalledWith('30d');
    expect(screen.getByTestId('collab-range-24h')).toHaveAttribute('aria-pressed', 'true');
    rerender(<AnalyticsPanel analytics={null} error="Forbidden: operator role required (FORBIDDEN)" loading={false} range="24h" onRange={onRange} onRefresh={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('FORBIDDEN');
    rerender(<AnalyticsPanel analytics={null} error={null} loading range="24h" onRange={onRange} onRefresh={vi.fn()} />);
    expect(screen.getByText(/Loading analytics/)).toBeInTheDocument();
  });
});

describe('helpers', () => {
  it('strips terminal control sequences from remote output', () => {
    expect(cleanOutput('a\u001b[2Jb\u001b]0;title\u0007c\u0000d\re\n')).toBe('abcde\n');
  });
  it('formats durations', () => {
    expect(formatDuration(30_000)).toBe('30s');
    expect(formatDuration(5 * 60_000)).toBe('5m');
    expect(formatDuration(3 * 3_600_000)).toBe('3.0h');
    expect(formatDuration(-1)).toBe('-');
  });
});
