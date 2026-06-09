import * as React from 'react';
import { CommandPreview, cn } from '@re-shell/ui';
import { Info, ListTree, Search, ShieldAlert, SlidersHorizontal } from 'lucide-react';
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

  return (
    <div className="screen-enter">
      <BuilderContent catalog={data} />
    </div>
  );
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
    <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
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
    <div className="grid gap-5 xl:grid-cols-2">
      {/* Left pane — the generated options form. */}
      <div className="surface flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
              <span className="text-signal">re-shell</span>
              <span className="truncate">{entry.path}</span>
            </h2>
            {entry.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
            ) : null}
          </div>
          {entry.destructive ? (
            <span className="status-badge status-critical shrink-0">
              <ShieldAlert className="size-3" />
              Destructive
            </span>
          ) : null}
        </div>

        <div className="grid gap-5 p-5">
          <CommandBuilderForm entry={entry} state={form} onChange={onFormChange} />

          <div className="hairline" />

          <section className="grid gap-3">
            <h3 className="label-eyebrow inline-flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-signal" />
              Output
            </h3>
            {entry.supportsJson ? (
              <SwitchRow
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
              <SwitchRow
                id="toggle-dry-run"
                label="--dry-run"
                description="Preview actions without making changes."
                checked={dryRunOn}
                onChange={(value) => setToggle(DRY_RUN_FLAG, value)}
              />
            ) : null}
          </section>
        </div>
      </div>

      {/* Right pane — live assembled preview + run, then streamed output. */}
      <div className="grid auto-rows-min gap-4 xl:sticky xl:top-6 xl:self-start">
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
          onDryRun={entry.supportsDryRun && runnable ? () => onRequestRun(true) : undefined}
          onRun={runnable ? () => onRequestRun(false) : undefined}
        />

        {!runnable ? (
          <div className="surface flex items-start gap-2.5 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <span>
              This command is not on the hub run allow-list. Copy the command above and run it in your
              terminal.
            </span>
          </div>
        ) : null}

        {job ? (
          <div className="grid gap-2">
            <h3 className="label-eyebrow">Live output</h3>
            <LiveJob key={job.key} spec={job} onRemove={onClearJob} />
          </div>
        ) : null}
      </div>

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
    <aside className="surface flex max-h-[calc(100vh-7rem)] flex-col lg:sticky lg:top-6 lg:self-start">
      <div className="grid gap-2.5 border-b border-border px-4 py-3.5">
        <span className="label-eyebrow inline-flex items-center gap-2">
          <ListTree className="size-3.5 text-signal" />
          Commands
        </span>
        <label htmlFor="command-filter" className="sr-only">
          Filter commands
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="command-filter"
            value={filter}
            placeholder="Filter…"
            onChange={(event) => setFilter(event.target.value)}
            className={cn(
              'h-9 w-full rounded-md border border-border bg-bg-0 pl-8 pr-2 font-mono text-[0.8125rem]',
              'shadow-elev-1 outline-none transition-colors duration-fast',
              'placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-signal focus-visible:shadow-focus-ring'
            )}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="grid gap-0.5">
          {filtered.map((entry) => {
            const isActive = entry.path === selected;
            return (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.path)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left outline-none transition-all duration-fast',
                    'focus-visible:shadow-focus-ring',
                    isActive
                      ? 'bg-bg-2 shadow-elev-1'
                      : 'hover:bg-bg-2/60'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'text-[0.7rem] leading-none transition-colors',
                        isActive ? 'text-signal' : 'text-transparent'
                      )}
                    >
                      ◆
                    </span>
                    <span
                      className={cn(
                        'min-w-0 truncate font-mono text-[0.8125rem]',
                        isActive ? 'text-foreground' : 'text-foreground/80'
                      )}
                    >
                      {entry.path}
                    </span>
                  </span>
                  {entry.destructive ? (
                    <ShieldAlert className="size-3.5 shrink-0 text-critical" />
                  ) : null}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">No matches.</li>
          ) : null}
        </ul>
      </div>
    </aside>
  );
}

function SwitchRow({
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-2/40 px-3 py-2.5">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="font-mono text-[0.8125rem] font-medium text-foreground">{label}</span>
        <span className="ml-2 text-xs text-muted-foreground">{description}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-fast outline-none',
          'focus-visible:shadow-focus-ring',
          checked ? 'bg-signal' : 'bg-input'
        )}
      >
        <span
          className={cn(
            'inline-block size-4 transform rounded-full bg-background shadow transition-transform duration-fast',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}
