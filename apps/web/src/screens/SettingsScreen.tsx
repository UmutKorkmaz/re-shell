import * as React from 'react';
import { CommandPreview, createReShellCommand, formatCommand } from '@umutkorkmaz/ui';
import { useSettings } from '../settings/useSettings';
import { SettingsPanel } from './settings/SettingsPanel';

const DOCTOR_COMMAND = createReShellCommand(['doctor'], { json: true });

const DOCTOR_SPEC = {
  title: 'Verify connection',
  description: 'Run doctor to confirm the CLI can reach the configured workspace.',
  command: DOCTOR_COMMAND,
  commandText: formatCommand(DOCTOR_COMMAND),
  destructive: false,
  dryRunSupported: false,
} as const;

/**
 * Settings screen: thin wrapper that wires the persisted settings store into the
 * form. The store handles localStorage persistence, schema validation, and live
 * theme application; the panel owns the form UX.
 */
export function SettingsScreen(): React.ReactElement {
  const { settings, updateSettings, setSettings, resetSettings } = useSettings();

  return (
    <div className="grid gap-4">
      <SettingsPanel
        settings={settings}
        onChange={updateSettings}
        onSave={setSettings}
        onReset={resetSettings}
      />
      <CommandPreview spec={DOCTOR_SPEC} />
    </div>
  );
}
