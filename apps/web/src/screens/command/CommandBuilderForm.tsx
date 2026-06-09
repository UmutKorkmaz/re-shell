import * as React from 'react';
import { Input, cn } from '@re-shell/ui';
import {
  DRY_RUN_FLAG,
  JSON_FLAG,
  type CommandCatalogEntry,
  type CommandFormState,
} from '../shared/commandCatalog';

interface CommandBuilderFormProps {
  entry: CommandCatalogEntry;
  state: CommandFormState;
  onChange: (next: CommandFormState) => void;
}

/**
 * Typed inputs generated entirely from a catalog entry — never a hardcoded
 * command list. Positional args render in their declared order; value flags
 * (`takesValue`) render text inputs seeded from their catalog `default`; switch
 * flags render switches. The dedicated `--json` / `--dry-run` toggles are owned
 * by the screen, so they are filtered out of the generic flag list here to avoid
 * duplicate controls.
 */
export function CommandBuilderForm({
  entry,
  state,
  onChange,
}: CommandBuilderFormProps): React.ReactElement {
  const setArg = (name: string, value: string): void => {
    onChange({ ...state, args: { ...state.args, [name]: value } });
  };
  const setFlag = (name: string, value: string | boolean): void => {
    onChange({ ...state, flags: { ...state.flags, [name]: value } });
  };

  const editableFlags = entry.flags.filter(
    (flag) => flag.name !== JSON_FLAG && flag.name !== DRY_RUN_FLAG
  );

  return (
    <div className="grid gap-5">
      {entry.args.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="label-eyebrow">Arguments</h3>
          {entry.args.map((arg) => (
            <div key={arg.name} className="grid gap-1.5">
              <label htmlFor={`arg-${arg.name}`} className="flex items-center gap-2 text-xs">
                <span className="font-mono font-medium text-foreground">{arg.name}</span>
                {arg.required ? (
                  <span className="status-badge status-critical px-1.5 py-0 text-[0.625rem]">
                    required
                  </span>
                ) : (
                  <span className="text-muted-foreground">optional</span>
                )}
              </label>
              <Input
                id={`arg-${arg.name}`}
                className="font-mono"
                value={state.args[arg.name] ?? ''}
                placeholder={arg.name}
                onChange={(event) => setArg(arg.name, event.target.value)}
              />
            </div>
          ))}
        </section>
      ) : null}

      {editableFlags.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="label-eyebrow">Flags</h3>
          {editableFlags.map((flag) =>
            flag.takesValue ? (
              <div key={flag.name} className="grid gap-1.5">
                <label htmlFor={`flag-${flag.name}`} className="text-xs">
                  <span className="font-mono font-medium text-foreground">{flag.name}</span>
                  {flag.description ? (
                    <span className="ml-2 font-normal text-muted-foreground">{flag.description}</span>
                  ) : null}
                </label>
                <Input
                  id={`flag-${flag.name}`}
                  className="font-mono"
                  value={typeof state.flags[flag.name] === 'string' ? (state.flags[flag.name] as string) : ''}
                  placeholder={defaultPlaceholder(flag.default)}
                  onChange={(event) => setFlag(flag.name, event.target.value)}
                />
              </div>
            ) : (
              <div
                key={flag.name}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-2/40 px-3 py-2.5"
              >
                <label htmlFor={`flag-${flag.name}`} className="min-w-0 cursor-pointer text-xs">
                  <span className="font-mono font-medium text-foreground">{flag.name}</span>
                  {flag.description ? (
                    <span className="ml-2 font-normal text-muted-foreground">{flag.description}</span>
                  ) : null}
                </label>
                <button
                  id={`flag-${flag.name}`}
                  type="button"
                  role="switch"
                  aria-checked={state.flags[flag.name] === true}
                  aria-label={flag.name}
                  onClick={() => setFlag(flag.name, !(state.flags[flag.name] === true))}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full outline-none transition-colors duration-fast',
                    'focus-visible:shadow-focus-ring',
                    state.flags[flag.name] === true ? 'bg-signal' : 'bg-input'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block size-4 transform rounded-full bg-background shadow transition-transform duration-fast',
                      state.flags[flag.name] === true ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>
            )
          )}
        </section>
      ) : null}

      {entry.args.length === 0 && editableFlags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This command takes no arguments or flags. Use the toggles and preview below.
        </p>
      ) : null}
    </div>
  );
}

function defaultPlaceholder(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}
