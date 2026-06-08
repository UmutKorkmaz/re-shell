import * as React from 'react';
import { Badge, Input, Label } from 're-shell-ui';
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
 * flags render checkboxes. The dedicated `--json` / `--dry-run` toggles are
 * owned by the screen, so they are filtered out of the generic flag list here to
 * avoid duplicate controls.
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
          <h3 className="text-sm font-semibold tracking-tight">Arguments</h3>
          {entry.args.map((arg) => (
            <div key={arg.name} className="grid gap-1.5">
              <Label htmlFor={`arg-${arg.name}`} className="flex items-center gap-2 text-xs">
                <span className="font-medium">{arg.name}</span>
                {arg.required ? (
                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                    required
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">optional</span>
                )}
              </Label>
              <Input
                id={`arg-${arg.name}`}
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
          <h3 className="text-sm font-semibold tracking-tight">Flags</h3>
          {editableFlags.map((flag) =>
            flag.takesValue ? (
              <div key={flag.name} className="grid gap-1.5">
                <Label htmlFor={`flag-${flag.name}`} className="text-xs">
                  <span className="re-shell-mono font-medium">{flag.name}</span>
                  {flag.description ? (
                    <span className="ml-2 font-normal text-muted-foreground">{flag.description}</span>
                  ) : null}
                </Label>
                <Input
                  id={`flag-${flag.name}`}
                  value={typeof state.flags[flag.name] === 'string' ? (state.flags[flag.name] as string) : ''}
                  placeholder={defaultPlaceholder(flag.default)}
                  onChange={(event) => setFlag(flag.name, event.target.value)}
                />
              </div>
            ) : (
              <label
                key={flag.name}
                htmlFor={`flag-${flag.name}`}
                className="flex items-start gap-2 text-xs"
              >
                <input
                  id={`flag-${flag.name}`}
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-input"
                  checked={state.flags[flag.name] === true}
                  onChange={(event) => setFlag(flag.name, event.target.checked)}
                />
                <span>
                  <span className="re-shell-mono font-medium">{flag.name}</span>
                  {flag.description ? (
                    <span className="ml-2 font-normal text-muted-foreground">{flag.description}</span>
                  ) : null}
                </span>
              </label>
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
