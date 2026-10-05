import * as React from 'react';
import { Badge, Button, Input, cn } from '@re-shell/ui';
import type { CollabRun, CollabSnapshot } from '@re-shell/contracts';
import { ArrowRightLeft, CircleStop, Play, SquareTerminal } from 'lucide-react';

import { Field, InlineError, Panel, cleanOutput } from './shared';

export interface ConsolePanelProps {
  state: CollabSnapshot;
  selfId: string | null;
  /** Commands the workspace's effective policy allows. Empty = free entry (the server still enforces). */
  commandIds: string[];
  error: string | null;
  busy: boolean;
  /** `paramsText` is the raw JSON object text typed by the user ('' = none). */
  onRun: (commandId: string, paramsText: string) => void;
  onCancel: () => void;
  onHandover: (userId: string) => void;
}

const RUN_VARIANT: Record<CollabRun['status'], 'secondary' | 'info' | 'healthy' | 'critical' | 'outline'> = {
  queued: 'secondary',
  running: 'info',
  succeeded: 'healthy',
  failed: 'critical',
  canceled: 'outline',
};

function runSummary(run: CollabRun): string {
  if (run.status === 'succeeded' || run.status === 'failed') {
    return `${run.status}${run.exitCode !== null ? ` (exit ${run.exitCode})` : run.errorCode ? ` (${run.errorCode})` : ''}`;
  }
  return run.status;
}

/** The synchronized command console: every participant sees the same ordered output. */
export function ConsolePanel(props: ConsolePanelProps): React.ReactElement {
  const { state, selfId, commandIds, error, busy } = props;
  const session = state.session;
  const isDriver = selfId !== null && session.driverId === selfId;
  const isOwner = selfId !== null && session.ownerId === selfId;
  const active = session.status === 'active';
  const running = state.currentJobId !== null;
  const [commandId, setCommandId] = React.useState('');
  const [paramsText, setParamsText] = React.useState('');
  const [handoverTo, setHandoverTo] = React.useState('');
  const chosenCommand = commandId || commandIds[0] || '';
  const others = state.participants.filter((p) => p.userId !== selfId);
  const chosenHandover = handoverTo && others.some((p) => p.userId === handoverTo) ? handoverTo : (others[0]?.userId ?? '');

  const scroller = React.useRef<HTMLDivElement | null>(null);
  const outputSize = state.runs.reduce((n, r) => n + r.output.length, 0) + state.runs.length;
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [outputSize]);

  return (
    <Panel
      testId="collab-console"
      icon={<SquareTerminal className="size-3.5 text-signal" />}
      title="Shared console"
      description="Commands run by the driver execute on a worker through the allow-list; everyone sees the same output in the same order."
      actions={
        <>
          <Badge variant={active ? 'healthy' : 'outline'} data-testid="collab-session-status">
            {session.status}
          </Badge>
          <Badge variant="info" data-testid="collab-driver">
            driver: {session.driverId ?? 'nobody'}
          </Badge>
        </>
      }
    >
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Console output"
        data-testid="collab-console-output"
        className="max-h-96 min-h-40 overflow-auto rounded-md border border-border bg-bg-0 p-4 font-mono text-[0.78rem] leading-[1.4]"
      >
        {state.runs.length === 0 ? <p className="text-muted-foreground">No commands run yet.</p> : null}
        {state.runs.map((run, index) => (
          <div key={run.jobId} className={cn(index > 0 && 'mt-4')} data-testid={`collab-run-${index + 1}`}>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span className="text-foreground">$ {run.commandId}</span>
              <span>by {run.requestedBy}</span>
              <Badge variant={RUN_VARIANT[run.status]} data-testid={`collab-run-status-${index + 1}`}>
                {runSummary(run)}
              </Badge>
            </div>
            {run.outputDropped ? <p className="text-muted-foreground">[earlier output omitted from this snapshot]</p> : null}
            <pre className="whitespace-pre-wrap break-words" data-testid={`collab-run-output-${index + 1}`}>
              {cleanOutput(run.output.map((c) => c.data).join(''))}
            </pre>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4">
        {isDriver && active ? (
          <form
            className="grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] md:items-end"
            data-testid="collab-run-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (chosenCommand) props.onRun(chosenCommand, paramsText);
            }}
          >
            <Field id="collab-run-command" label="Command">
              {commandIds.length > 0 ? (
                <select
                  id="collab-run-command"
                  data-testid="collab-run-command"
                  className="h-11 rounded-md border border-border bg-input px-3 font-mono text-[0.8125rem]"
                  value={chosenCommand}
                  onChange={(e) => setCommandId(e.target.value)}
                >
                  {commandIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="collab-run-command"
                  data-testid="collab-run-command"
                  value={commandId}
                  placeholder="workspace.summary"
                  onChange={(e) => setCommandId(e.target.value)}
                />
              )}
            </Field>
            <Field id="collab-run-params" label="Parameters (JSON, optional)">
              <Input
                id="collab-run-params"
                data-testid="collab-run-params"
                value={paramsText}
                placeholder='{"language":"typescript"}'
                onChange={(e) => setParamsText(e.target.value)}
              />
            </Field>
            <Button type="submit" data-testid="collab-run" disabled={busy || running || !chosenCommand}>
              <Play className="size-4" />
              Run
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="collab-viewer-note">
            {!active
              ? 'This session has ended; the console is read-only history.'
              : `Only the driver (${session.driverId ?? 'nobody'}) can run commands.${
                  isOwner ? ' You own this session and can take control.' : ' Ask them to hand over control.'
                }`}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {running && active && (isDriver || isOwner) ? (
            <Button type="button" variant="outline" size="sm" data-testid="collab-cancel" onClick={props.onCancel} disabled={busy}>
              <CircleStop className="size-4" />
              Cancel running command
            </Button>
          ) : null}
          {active && isOwner && !isDriver ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="collab-take-control"
              onClick={() => selfId && props.onHandover(selfId)}
              disabled={busy}
            >
              Take control
            </Button>
          ) : null}
          {active && (isDriver || isOwner) && others.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field id="collab-handover-to" label="Hand control to">
                <select
                  id="collab-handover-to"
                  data-testid="collab-handover-select"
                  className="h-9 rounded-md border border-border bg-input px-3 font-mono text-[0.8125rem]"
                  value={chosenHandover}
                  onChange={(e) => setHandoverTo(e.target.value)}
                >
                  {others.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.userId}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="collab-handover"
                disabled={busy || !chosenHandover}
                onClick={() => props.onHandover(chosenHandover)}
              >
                <ArrowRightLeft className="size-4" />
                Hand over
              </Button>
            </div>
          ) : null}
        </div>
        {error ? <InlineError message={error} /> : null}
      </div>
    </Panel>
  );
}
