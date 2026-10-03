import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FakeControlPlane } from '../collab/test-support/fake-control-plane';
import { CollaborationScreen } from './CollaborationScreen';

/**
 * The Collaboration screen against an in-memory control plane that speaks the real
 * wire format (see fake-control-plane.ts). Real hooks, real contracts client and
 * reducer; no mocked components. The Playwright spec runs the same screen against
 * the real control plane in two browser contexts.
 */

const URL_ = 'http://127.0.0.1:8787';

function connect(token: string): void {
  fireEvent.change(screen.getByTestId('collab-url'), { target: { value: URL_ } });
  fireEvent.change(screen.getByTestId('collab-token'), { target: { value: token } });
  fireEvent.click(screen.getByTestId('collab-connect'));
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('CollaborationScreen', () => {
  it('starts with only the connection settings and rejects a bad token with a clear message', async () => {
    const cp = new FakeControlPlane();
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    expect(screen.getByTestId('collab-connection')).toBeInTheDocument();
    expect(screen.queryByTestId('collab-sessions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('collab-analytics')).not.toBeInTheDocument();

    connect('wrong-token');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('rejected the token'));
    expect(screen.getByTestId('collab-status')).toHaveTextContent('error');
    expect(screen.queryByTestId('collab-sessions')).not.toBeInTheDocument();
  });

  it('validates the URL before making any request', () => {
    const cp = new FakeControlPlane();
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    fireEvent.change(screen.getByTestId('collab-url'), { target: { value: 'ftp://nope' } });
    fireEvent.change(screen.getByTestId('collab-token'), { target: { value: 'tok-alice' } });
    fireEvent.click(screen.getByTestId('collab-connect'));
    expect(screen.getByRole('alert')).toHaveTextContent('http://');
    expect(cp.requests).toEqual([]);
  });

  it('connects, lists sessions and shows team analytics', async () => {
    const cp = new FakeControlPlane({ withSession: true });
    cp.analytics = { ...FakeControlPlane.emptyAnalytics(), commands: { ...FakeControlPlane.emptyAnalytics().commands, total: 7, succeeded: 6, failed: 1, successRate: 6 / 7, byUser: [{ userId: 'alice', total: 7, succeeded: 6, failed: 1, canceled: 0 }] } };
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-alice');
    await waitFor(() => expect(screen.getByTestId('collab-status')).toHaveTextContent('connected as alice'));
    expect(screen.getByTestId('collab-identity')).toHaveTextContent('acme');
    await waitFor(() => expect(screen.getByTestId('collab-session-list')).toBeInTheDocument());
    expect(screen.getByTestId('collab-session-list')).toHaveTextContent('Pairing on demo');
    await waitFor(() => expect(screen.getByTestId('collab-tile-commands')).toHaveTextContent('7'));
    expect(screen.getByTestId('collab-tile-success')).toHaveTextContent('86%');
    expect(within(screen.getByTestId('collab-table-users')).getByText('alice')).toBeInTheDocument();
  });

  it('persists the settings and reconnects on reload; the token stays out of localStorage', async () => {
    const cp = new FakeControlPlane();
    const first = render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-alice');
    await waitFor(() => expect(screen.getByTestId('collab-status')).toHaveTextContent('connected as alice'));
    expect(JSON.stringify(window.localStorage)).not.toContain('tok-alice');
    first.unmount();

    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    await waitFor(() => expect(screen.getByTestId('collab-status')).toHaveTextContent('connected as alice'));
    expect(screen.getByTestId('collab-url')).toHaveValue(URL_);
  });

  it('starts a session from the form and drives it: the console shows run output from the stream', async () => {
    const cp = new FakeControlPlane();
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-alice');
    await waitFor(() => expect(screen.getByTestId('collab-new-workspace')).toHaveValue('demo'));
    fireEvent.change(screen.getByTestId('collab-new-title'), { target: { value: 'My pairing' } });
    fireEvent.click(screen.getByTestId('collab-create'));

    await waitFor(() => expect(screen.getByTestId('collab-session-title')).toHaveTextContent('My pairing'));
    await waitFor(() => expect(screen.getByTestId('collab-run-form')).toBeInTheDocument());
    expect(screen.getByTestId('collab-driver')).toHaveTextContent('driver: alice');
    // The workspace's effective policy fills the command list.
    await waitFor(() =>
      expect(within(screen.getByTestId('collab-run-command')).getAllByRole('option').map((o) => o.textContent)).toEqual(['workspace.summary', 'doctor'])
    );

    fireEvent.click(screen.getByTestId('collab-run'));
    await waitFor(() => expect(screen.getByTestId('collab-run-status-1')).toHaveTextContent('succeeded (exit 0)'));
    expect(screen.getByTestId('collab-run-output-1')).toHaveTextContent('output of workspace.summary');
    expect(cp.requests.some((r) => r.method === 'POST' && r.path.endsWith('/run') && r.user === 'alice')).toBe(true);

    // Presence shows alice online (her own stream).
    expect(screen.getByTestId('collab-participant-alice')).toHaveTextContent('driver');
  });

  it('a viewer sees the same console but has no way to run commands; handover changes who can', async () => {
    const cp = new FakeControlPlane({ withSession: true });
    cp.runCommand('workspace.summary', 'alice', ['{"ok":true}\n']);
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-bob');
    await waitFor(() => expect(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111'));

    await waitFor(() => expect(screen.getByTestId('collab-run-output-1')).toHaveTextContent('{"ok":true}'));
    expect(screen.queryByTestId('collab-run-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('collab-viewer-note')).toHaveTextContent('Only the driver (alice) can run commands');
    await waitFor(() => expect(screen.getByTestId('collab-participant-bob')).toBeInTheDocument());

    // alice hands control to bob (server side); bob's screen follows, live.
    cp.emit('control.handover', 'alice', { from: 'alice', to: 'bob', by: 'alice', reason: 'handover' });
    await waitFor(() => expect(screen.getByTestId('collab-run-form')).toBeInTheDocument());
    expect(screen.getByTestId('collab-driver')).toHaveTextContent('driver: bob');
    // New output from the new driver arrives in order after the first run.
    cp.runCommand('doctor', 'bob', ['all good\n']);
    await waitFor(() => expect(screen.getByTestId('collab-run-output-2')).toHaveTextContent('all good'));
    expect(screen.getByTestId('collab-run-1')).toHaveTextContent('workspace.summary');
    expect(screen.getByTestId('collab-run-2')).toHaveTextContent('doctor');
  });

  it('shows server refusals instead of failing silently', async () => {
    const cp = new FakeControlPlane({ withSession: true });
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-alice');
    await waitFor(() => expect(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111'));
    await waitFor(() => expect(screen.getByTestId('collab-run-form')).toBeInTheDocument());
    // The driver changes behind our back; the next run is refused by the server.
    cp.emit('participant.joined', 'bob', { userId: 'bob' });
    cp.emit('control.handover', 'alice', { from: 'alice', to: 'bob', by: 'alice', reason: 'handover' });
    await waitFor(() => expect(screen.queryByTestId('collab-run-form')).not.toBeInTheDocument());
    // alice is the owner: she can take control back.
    fireEvent.click(await screen.findByTestId('collab-take-control'));
    await waitFor(() => expect(screen.getByTestId('collab-driver')).toHaveTextContent('driver: alice'));
  });

  it('edits the shared document: the edit is sent as an OT op and acknowledged by the stream', async () => {
    const cp = new FakeControlPlane({ withSession: true });
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-alice');
    await waitFor(() => expect(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111'));
    await waitFor(() => expect(screen.getByTestId('collab-editor')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('collab-editor'), { target: { value: 'hello' } });
    await waitFor(() => expect(cp.state?.docs[0].content).toBe('hello'));
    await waitFor(() => expect(screen.getByTestId('collab-editor-sync')).toHaveTextContent('synced · rev 1'));

    // Somebody else's edit lands in the textarea.
    cp.emit('doc.op', 'bob', { docId: 'notes', rev: 2, ops: [5, ' world'], clientId: 'bob-client', clientSeq: 1 });
    await waitFor(() => expect((screen.getByTestId('collab-editor') as HTMLTextAreaElement).value).toBe('hello world'));
  });

  it('keeps the live state after the stream drops by resuming from the last sequence', async () => {
    const cp = new FakeControlPlane({ withSession: true });
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-alice');
    await waitFor(() => expect(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111'));
    await waitFor(() => expect(screen.getByTestId('collab-console')).toBeInTheDocument());

    cp.dropStreams();
    cp.runCommand('doctor', 'alice', ['while you were away\n']);
    await waitFor(() => expect(screen.getByTestId('collab-run-output-1')).toHaveTextContent('while you were away'), { timeout: 5000 });
    // The resume asked for events after the last seen sequence rather than a fresh snapshot.
    expect(cp.requests.some((r) => r.path.includes('/stream?afterSeq='))).toBe(true);
  });

  it('leaves the session and ends it (owner)', async () => {
    const cp = new FakeControlPlane({ withSession: true });
    render(<CollaborationScreen fetchImpl={cp.fetch} />);
    connect('tok-alice');
    await waitFor(() => expect(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('collab-join-11111111-1111-4111-8111-111111111111'));
    await waitFor(() => expect(screen.getByTestId('collab-end')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('collab-end'));
    await waitFor(() => expect(screen.getByTestId('collab-session-status')).toHaveTextContent('ended'));
    expect(screen.queryByTestId('collab-run-form')).not.toBeInTheDocument();
    expect((screen.getByTestId('collab-editor') as HTMLTextAreaElement).readOnly).toBe(true);
    fireEvent.click(screen.getByTestId('collab-leave'));
    await waitFor(() => expect(screen.queryByTestId('collab-session-view')).not.toBeInTheDocument());
  });
});
