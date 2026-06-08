import * as React from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CommandPreview,
  Label,
  Separator,
} from 're-shell-ui';
import { Info, ShieldAlert } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EmptyPanel, EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import { useUrlState } from './shared/useUrlState';
import { ConfirmModal } from './shared/ConfirmModal';
import {
  buildCommandArgv,
  buildCommandText,
  commandCatalogSchema,
  DRY_RUN_FLAG,
  isHubRunnable,
  JSON_FLAG,
  type CommandCatalogEntry,
  type CommandFormState,
} from './shared/commandCatalog';
import { CommandBuilderForm } from './command/CommandBuilderForm';
import { LiveJob, type LiveJobSpec } from './jobs/LiveJob';
import { useSettings } from '../settings/useSettings';

const URL_KEYS = ['cmd'] as const;

export function CommandBuilderScreen(): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'commands.list',
    commandCatalogSchema
  );

  if (isLoading) {
    return <LoadingPanel title="Loading command catalog…" description="Fetching commands.list from the hub." />;
  }
  if (error) {
    return <ErrorPanel title="Could not reach the hub" description={error.message} onRetry={() => refetch()} />;
  }
  if (envelopeError) {
    return <EnvelopeErrorPanel code={envelopeError.code} message={envelopeError.message} />;
  }
  if (!data || data.length === 0) {
    return <EmptyPanel title="No commands" description="The hub returned an empty command catalog." />;
  }

  return <BuilderContent catalog={data} />;
}

function emptyState(): CommandFormState {
  return { args: {}, flags: {} };
}

function BuilderContent({ catalog }: { catalog: CommandCatalogEntry[] }): React.ReactElement {
  const { settings } = useSettings();
  const [urlState, setUrlState] = useUrlState<(typeof URL_KEYS)[number]>(URL_KEYS);

  const selectedPath = urlState.cmd;
  const entry = React.useMemo(
    () => catalog.find((command) => command.path === selectedPath) ?? null,
    [catalog, selectedPath]
  );

  const [form, setForm] = React.useState<CommandFormState>(emptyState);
  const [job, setJob] = React.useState<LiveJobSpec | null>(null);
  const [pendingRun, setPendingRun] = React.useState<{ dryRun: boolean } | null>(null);

  // Reset the form whenever the selected command changes so stale args/flags
  // never leak across commands.
  React.useEffect(() => {
    setForm(emptyState());
    setJob(null);
    setPendingRun(null);
  }, [selectedPath]);

  const selectCommand = (path: string): void => setUrlState({ cmd: path });

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <CommandPicker catalog={catalog} selected={selectedPath} onSelect={selectCommand} />
      {entry ? (
        <Editor
          entry={entry}
          form={form}
          onFormChange={setForm}
          safetyMode={settings.safetyMode}
          job={job}
          pendingRun={pendingRun}
          onRequestRun={(dryRun) => requestRun(entry, settings.safetyMode, dryRun, setPendingRun, setJob, form)}
          onConfirmRun={() => confirmRun(entry, pendingRun, form, setJob, setPendingRun)}
          onCancelRun={() => setPendingRun(null)}
          onClearJob={() => setJob(null)}
        />
      ) : (
        <EmptyPanel
          title="Select a command"
          description="Pick a command from the catalog to build, preview, and run it."
        />
      )}
    </div>
  );
}

/**
 * Begin a run. For a destructive command with safety-mode on, stage a pending
 * confirmation (the modal gate); otherwise launch immediately.
 */
function requestRun(
  entry: CommandCatalogEntry,
  safetyMode: boolean,
  dryRun: boolean,
  setPendingRun: (next: { dryRun: boolean } | null) => void,
  setJob: (job: LiveJobSpec | null) => void,
  form: CommandFormState
): void {
  // A dry run is never destructive in practice, but the gate is keyed to the
  // command's destructive flag + safety-mode, mirroring the CLI contract.
  if (entry.destructive && safetyMode && !dryRun) {
    setPendingRun({ dryRun });
    return;
  }
  setJob(toJobSpec(entry, form, dryRun));
}

function confirmRun(
  entry: CommandCatalogEntry,
  pendingRun: { dryRun: boolean } | null,
  form: CommandFormState,
  setJob: (job: LiveJobSpec | null) => void,
  setPendingRun: (next: { dryRun: boolean } | null) => void
): void {
  if (!pendingRun) {
    return;
  }
  setJob(toJobSpec(entry, form, pendingRun.dryRun));
  setPendingRun(null);
}

/**
 * Build the hub job spec. Execution always goes through the `run` allow-list
 * with `{ subcommand }` — never free-form argv. The displayed command echoes the
 * full assembled preview so the operator sees exactly what was composed, even
 * though the hub appends only `--json` to the allow-listed subcommand.
 */
function toJobSpec(
  entry: CommandCatalogEntry,
  form: CommandFormState,
  dryRun: boolean
): LiveJobSpec {
  const previewArgv = buildCommandArgv(entry, withToggles(form, entry, dryRun));
  return {
    key: `${entry.path}-${Date.now().toString(36)}`,
    commandId: 'run',
    params: { subcommand: entry.path },
    command: previewArgv,
  };
}

/** Overlay the dedicated `--json` / `--dry-run` toggles onto the form state. */
function withToggles(
  form: CommandFormState,
  entry: CommandCatalogEntry,
  dryRun: boolean
): CommandFormState {
  const flags: CommandFormState['flags'] = { ...form.flags };
  if (entry.supportsJson) {
    flags[JSON_FLAG] = form.flags[JSON_FLAG] === true;
  }
  if (entry.supportsDryRun) {
    flags[DRY_RUN_FLAG] = dryRun;
  }
  return { ...form, flags };
}

interface EditorProps {
  entry: CommandCatalogEntry;
  form: CommandFormState;
  onFormChange: (next: CommandFormState) => void;
  safetyMode: boolean;
  job: LiveJobSpec | null;
  pendingRun: { dryRun: boolean } | null;
  onRequestRun: (dryRun: boolean) => void;
  onConfirmRun: () => void;
  onCancelRun: () => void;
  onClearJob: () => void;
}

function Editor({
  entry,
  form,
  onFormChange,
  safetyMode,
  job,
  pendingRun,
  onRequestRun,
  onConfirmRun,
  onCancelRun,
  onClearJob,
}: EditorProps): React.ReactElement {
  const jsonOn = form.flags[JSON_FLAG] === true;
  const dryRunOn = form.flags[DRY_RUN_FLAG] === true;
  // The preview reflects the current toggles via the same overlay used at run.
  const previewState = withToggles(form, entry, dryRunOn);
  const commandText = buildCommandText(entry, previewState);
  const command = buildCommandArgv(entry, previewState);
  const runnable = isHubRunnable(entry);

  const setToggle = (flag: string, value: boolean): void =>
    onFormChange({ ...form, flags: { ...form.flags, [flag]: value } });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="re-shell-mono">re-shell {entry.path}</span>
            {entry.destructive ? (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="size-3" />
                Destructive
              </Badge>
            ) : null}
          </CardTitle>
          {entry.description ? <CardDescription>{entry.description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="grid gap-5">
          <CommandBuilderForm entry={entry} state={form} onChange={onFormChange} />

          <Separator />

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold tracking-tight">Output</h3>
            {entry.supportsJson ? (
              <Toggle
                id="toggle-json"
                label="--json"
                description="Emit machine-readable JSON."
                checked={jsonOn}
                onChange={(value) => setToggle(JSON_FLAG, value)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">This command does not support --json.</p>
            )}
            {entry.supportsDryRun ? (
              <Toggle
                id="toggle-dry-run"
                label="--dry-run"
                description="Preview actions without making changes."
                checked={dryRunOn}
                onChange={(value) => setToggle(DRY_RUN_FLAG, value)}
              />
            ) : null}
          </section>
        </CardContent>
      </Card>

      <CommandPreview
        spec={{
          title: 'Assembled command',
          description: runnable
            ? 'Run executes through the hub allow-list.'
            : 'Preview & copy only — run this in a terminal.',
          command,
          commandText,
          destructive: entry.destructive,
          dryRunSupported: entry.supportsDryRun,
          requiresConfirmation: entry.destructive && safetyMode,
        }}
        onDryRun={
          entry.supportsDryRun && runnable ? () => onRequestRun(true) : undefined
        }
        onRun={runnable ? () => onRequestRun(false) : undefined}
      />

      {!runnable ? (
        <Card>
          <CardContent className="flex items-start gap-2 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              This command is not on the hub run allow-list. Copy the command above and run it in your
              terminal.
            </span>
          </CardContent>
        </Card>
      ) : null}

      {job ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold tracking-tight">Live output</h3>
          <LiveJob key={job.key} spec={job} onRemove={onClearJob} />
        </div>
      ) : null}

      <ConfirmModal
        open={pendingRun !== null}
        title="Run destructive command?"
        description="This command is marked destructive and safety mode is on. Confirm to run it."
        commandText={commandText}
        onConfirm={onConfirmRun}
        onCancel={onCancelRun}
      />
    </div>
  );
}

function CommandPicker({
  catalog,
  selected,
  onSelect,
}: {
  catalog: CommandCatalogEntry[];
  selected: string;
  onSelect: (path: string) => void;
}): React.ReactElement {
  const [filter, setFilter] = React.useState('');
  const filtered = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) {
      return catalog;
    }
    return catalog.filter(
      (entry) =>
        entry.path.toLowerCase().includes(needle) ||
        entry.description.toLowerCase().includes(needle)
    );
  }, [catalog, filter]);

  return (
    <Card className="lg:sticky lg:top-8 lg:self-start">
      <CardHeader className="gap-2">
        <CardTitle className="text-base">Commands</CardTitle>
        <Label htmlFor="command-filter" className="sr-only">
          Filter commands
        </Label>
        <input
          id="command-filter"
          value={filter}
          placeholder="Filter…"
          onChange={(event) => setFilter(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </CardHeader>
      <CardContent className="max-h-[28rem] overflow-y-auto p-2">
        <ul className="grid gap-0.5">
          {filtered.map((entry) => {
            const isActive = entry.path === selected;
            return (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.path)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    isActive ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <span className="re-shell-mono min-w-0 truncate">{entry.path}</span>
                  {entry.destructive ? (
                    <ShieldAlert className="size-3.5 shrink-0 text-destructive" />
                  ) : null}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">No matches.</li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 rounded border-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="re-shell-mono font-medium">{label}</span>
        <span className="ml-2 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
