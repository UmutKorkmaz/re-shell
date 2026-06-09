import * as React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from '@re-shell/ui';
import { Check, Moon, Sun } from 'lucide-react';
import {
  PORT_BOUNDS,
  settingsSchema,
  type Settings,
  type Theme,
} from '../../settings/settings-store';

interface SettingsPanelProps {
  settings: Settings;
  /** Apply a single field immediately (theme flips tokens live; persisted). */
  onChange: (patch: Partial<Settings>) => void;
  /** Persist the full draft from the Save action. */
  onSave: (next: Settings) => void;
  onReset: () => void;
}

/**
 * Settings form. Text/number fields edit a local draft and persist on Save;
 * theme and toggles apply immediately (theme must flip the tokens live). The
 * daemon port is numeric-validated against {@link PORT_BOUNDS} before Save is
 * allowed.
 */
export function SettingsPanel({
  settings,
  onChange,
  onSave,
  onReset,
}: SettingsPanelProps): React.ReactElement {
  const [draft, setDraft] = React.useState<Settings>(settings);
  const [portText, setPortText] = React.useState<string>(String(settings.daemonPort));
  const [saved, setSaved] = React.useState(false);

  // Re-sync the draft if the persisted settings change underneath us (reset).
  React.useEffect(() => {
    setDraft(settings);
    setPortText(String(settings.daemonPort));
  }, [settings]);

  const portError = validatePort(portText);
  const canSave = portError === null;

  const handleSave = (): void => {
    const port = Number.parseInt(portText, 10);
    const next: Settings = { ...draft, daemonPort: port };
    const result = settingsSchema.safeParse(next);
    if (!result.success) {
      return;
    }
    onSave(result.data);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>Where the dashboard finds the workspace and CLI.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            id="workspacePath"
            label="Workspace path"
            hint="Absolute path to the monorepo root."
          >
            <Input
              id="workspacePath"
              value={draft.workspacePath}
              placeholder="/path/to/workspace"
              onChange={(e) => setDraft((d) => ({ ...d, workspacePath: e.target.value }))}
            />
          </Field>
          <Field id="cliBinaryPath" label="CLI binary path" hint="Path or bare command for re-shell.">
            <Input
              id="cliBinaryPath"
              value={draft.cliBinaryPath}
              placeholder="re-shell"
              onChange={(e) => setDraft((d) => ({ ...d, cliBinaryPath: e.target.value }))}
            />
          </Field>
          <Field
            id="daemonPort"
            label="Daemon port"
            hint={`Numeric, ${PORT_BOUNDS.min}–${PORT_BOUNDS.max}.`}
            error={portError ?? undefined}
          >
            <Input
              id="daemonPort"
              inputMode="numeric"
              value={portText}
              aria-invalid={portError !== null}
              onChange={(e) => setPortText(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>Appearance, safety, and telemetry.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1">
          <ToggleRow
            label="Theme"
            description="Switch the dashboard between light and dark tokens."
            control={
              <ThemeToggle theme={draft.theme} onChange={(theme) => applyImmediate('theme', theme)} />
            }
          />
          <Separator />
          <ToggleRow
            label="Safety mode"
            description="Require confirmation before running destructive commands."
            control={
              <Switch
                checked={draft.safetyMode}
                label="Safety mode"
                onChange={(value) => applyImmediate('safetyMode', value)}
              />
            }
          />
          <Separator />
          <ToggleRow
            label="Telemetry"
            description="Send anonymous usage data. Off by default."
            control={
              <Switch
                checked={draft.telemetryOptIn}
                label="Telemetry"
                onChange={(value) => applyImmediate('telemetryOptIn', value)}
              />
            }
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSave} disabled={!canSave}>
          {saved ? <Check className="size-4" /> : null}
          {saved ? 'Saved' : 'Save settings'}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );

  // Immediately-applied controls (theme/toggles) also keep the draft in sync.
  function applyImmediate<K extends keyof Settings>(key: K, value: Settings[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
    onChange({ [key]: value } as Partial<Settings>);
  }
}

function validatePort(value: string): string | null {
  if (!/^\d+$/.test(value.trim())) {
    return 'Port must be a whole number.';
  }
  const port = Number.parseInt(value, 10);
  if (port < PORT_BOUNDS.min || port > PORT_BOUNDS.max) {
    return `Port must be between ${PORT_BOUNDS.min} and ${PORT_BOUNDS.max}.`;
  }
  return null;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}): React.ReactElement {
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Switch to ${next} theme`}
      onClick={() => onChange(next)}
    >
      {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
      {theme === 'dark' ? 'Dark' : 'Light'}
    </Button>
  );
}

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`inline-block size-5 transform rounded-full bg-background shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
