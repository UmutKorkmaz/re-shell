import * as React from 'react';
import {
  Button,
  CommandPreview,
  Input,
  cn,
  formatCommand,
  resolveCommand,
  type ResolveCommandResult,
} from '@re-shell/ui';
import { Bot, CornerDownLeft, ShieldX, Sparkles, Terminal } from 'lucide-react';
import {
  buildAssistantCommands,
  toResolverAllowList,
  type AssistantCommand,
} from '../assistant/allowed-commands';
import { LiveJob, type LiveJobSpec } from './jobs/LiveJob';
import { EmptyPanel } from './shared/StatePanels';

/**
 * A handful of example prompts to seed discovery. They map to real allow-listed
 * commands so clicking one always resolves; they are NOT a command list.
 */
const EXAMPLE_PROMPTS: readonly string[] = [
  'Is my workspace healthy?',
  'Show the dependency graph',
  'Give me a workspace summary',
  'Analyze bundles and security',
  'List available templates',
];

/** One resolved-and-launched assistant turn. */
interface AssistantTurn {
  readonly key: string;
  readonly query: string;
  readonly resolution: ResolveCommandResult;
  /** Set only when the resolution matched a runnable command. */
  readonly job?: LiveJobSpec;
  readonly command?: AssistantCommand;
}

function makeKey(): string {
  return `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AssistantScreen(): React.ReactElement {
  // Derived once from the live registry; stable for the session.
  const commands = React.useMemo(() => buildAssistantCommands(), []);
  const allowList = React.useMemo(() => toResolverAllowList(commands), [commands]);
  // Keyed by the plain string id so the resolver's `string` commandId looks up
  // cleanly; a hit guarantees the id is one of the allow-list entries.
  const byId = React.useMemo(
    () => new Map<string, AssistantCommand>(commands.map((cmd) => [cmd.id, cmd])),
    [commands]
  );

  const [query, setQuery] = React.useState('');
  const [turns, setTurns] = React.useState<AssistantTurn[]>([]);

  const submit = React.useCallback(
    (raw: string): void => {
      const text = raw.trim();
      if (text.length === 0) {
        return;
      }
      const resolution = resolveCommand(text, allowList);
      const key = makeKey();

      if (resolution.kind === 'match') {
        const command = byId.get(resolution.commandId);
        if (command) {
          const job: LiveJobSpec = {
            key: `${command.id}-${key}`,
            // Route the registry id straight back through the hub. The id is one
            // of the allow-list entries by construction — no new exec path. The
            // hub re-derives the argv from this id; `command` is the faithful
            // echo of that same argv (already includes --json).
            commandId: command.id,
            command: [...command.command],
          };
          setTurns((prev) => [{ key, query: text, resolution, job, command }, ...prev]);
          setQuery('');
          return;
        }
      }

      // Unresolved / out-of-allow-list → record a refusal turn.
      setTurns((prev) => [{ key, query: text, resolution }, ...prev]);
      setQuery('');
    },
    [allowList, byId]
  );

  const dismiss = React.useCallback((key: string): void => {
    setTurns((prev) => prev.filter((turn) => turn.key !== key));
  }, []);

  return (
    <div className="screen-enter grid gap-5">
      <Prompt
        query={query}
        onChange={setQuery}
        onSubmit={() => submit(query)}
        examples={EXAMPLE_PROMPTS}
        onExample={submit}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {turns.length > 0
          ? `${turns.length} assistant ${turns.length === 1 ? 'turn' : 'turns'} on screen.`
          : 'No assistant turns yet.'}
      </p>

      {turns.length === 0 ? (
        <EmptyPanel
          title="Ask the assistant"
          description="Describe what you want in plain language. The assistant maps it to a single vetted hub command, shows you that command, and streams the result inline. It can only ever run allow-listed commands."
        />
      ) : (
        <div className="grid gap-5">
          {turns.map((turn) => (
            <TurnCard key={turn.key} turn={turn} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

function Prompt({
  query,
  onChange,
  onSubmit,
  examples,
  onExample,
}: {
  query: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  examples: readonly string[];
  onExample: (value: string) => void;
}): React.ReactElement {
  return (
    <section className="surface overflow-hidden" aria-labelledby="assistant-prompt-heading">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Bot className="size-4 text-signal" />
        <div>
          <h2 id="assistant-prompt-heading" className="font-display text-base font-semibold tracking-tight">
            Assistant console
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Natural language in, one allow-listed command out. Nothing else runs.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="assistant-query" className="sr-only">
          Ask the assistant
        </label>
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-signal" />
          <Input
            id="assistant-query"
            value={query}
            onChange={(event) => onChange(event.target.value)}
            placeholder="e.g. is my workspace healthy?"
            autoComplete="off"
            className="pl-9 font-mono"
          />
        </div>
        <Button type="submit" disabled={query.trim().length === 0} className="justify-center">
          <CornerDownLeft className="size-4" />
          Resolve &amp; run
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        <span className="self-center text-xs uppercase tracking-wide text-muted-foreground">Try</span>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onExample(example)}
            className={cn(
              'rounded-full border border-border bg-bg-0 px-3 py-1 text-xs text-foreground/80',
              'outline-none transition-all duration-fast hover:-translate-y-0.5 hover:border-signal/50',
              'hover:text-foreground hover:shadow-glow-signal focus-visible:shadow-focus-ring'
            )}
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}

function TurnCard({
  turn,
  onDismiss,
}: {
  turn: AssistantTurn;
  onDismiss: (key: string) => void;
}): React.ReactElement {
  return (
    <article className="grid gap-3">
      <header className="flex items-start justify-between gap-3">
        <p className="inline-flex items-start gap-2 text-sm">
          <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="text-foreground/90">
            <span className="text-muted-foreground">You asked:</span>{' '}
            <span className="font-medium">{turn.query}</span>
          </span>
        </p>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onDismiss(turn.key)}
        >
          Dismiss
        </button>
      </header>

      {turn.resolution.kind === 'match' && turn.command && turn.job ? (
        <ResolvedTurn command={turn.command} resolution={turn.resolution} job={turn.job} />
      ) : (
        <RefusalPanel query={turn.query} />
      )}
    </article>
  );
}

function ResolvedTurn({
  command,
  resolution,
  job,
}: {
  command: AssistantCommand;
  resolution: Extract<ResolveCommandResult, { kind: 'match' }>;
  job: LiveJobSpec;
}): React.ReactElement {
  const confidencePct = Math.round(resolution.confidence * 100);
  return (
    <div className="grid gap-3">
      {/* Transparency: show the resolved command before/with its output. */}
      <CommandPreview
        spec={{
          title: command.title,
          description: `Resolved from your request (${confidencePct}% match). ${command.description}`,
          command: [...job.command],
          commandText: formatCommand(job.command),
          destructive: command.destructive,
          dryRunSupported: false,
          requiresConfirmation: command.requiresConfirmation,
        }}
      />
      {/* Run + stream through the existing hub job pipeline (SSE/WS allow-list). */}
      <LiveJob spec={job} />
    </div>
  );
}

/**
 * The refusal surface for an unresolved / out-of-allow-list request. Lists the
 * commands the assistant CAN run so the operator can rephrase — the UI refuses
 * rather than guessing or inventing an exec path.
 */
function RefusalPanel({ query }: { query: string }): React.ReactElement {
  const commands = React.useMemo(() => buildAssistantCommands(), []);
  return (
    <div className="surface border-critical/40 p-5">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-critical">
        <ShieldX className="size-4" />
        I can&apos;t run that
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Nothing in the allow-list confidently matches{' '}
        <span className="font-mono text-foreground/80">&ldquo;{query}&rdquo;</span>. I can only run these
        vetted commands:
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {commands.map((command) => (
          <li
            key={command.id}
            className="rounded-md border border-border bg-bg-0 px-3 py-2 shadow-elev-1"
          >
            <span className="font-mono text-[0.8125rem] text-foreground/90">{command.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{command.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
