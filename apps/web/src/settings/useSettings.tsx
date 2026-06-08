import * as React from 'react';
import {
  DEFAULT_SETTINGS,
  applyTheme,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings-store';

interface SettingsContextValue {
  settings: Settings;
  /** Merge a partial update, persist it, and re-apply side effects (theme). */
  updateSettings: (patch: Partial<Settings>) => void;
  /** Replace the whole settings value (used by the form's Save action). */
  setSettings: (next: Settings) => void;
  /** Restore safe defaults. */
  resetSettings: () => void;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [settings, setSettingsState] = React.useState<Settings>(() => loadSettings());

  // Apply theme on mount and whenever it changes so the tokens flip live.
  React.useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const persist = React.useCallback((next: Settings): void => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const updateSettings = React.useCallback(
    (patch: Partial<Settings>): void => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const resetSettings = React.useCallback((): void => {
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const value = React.useMemo<SettingsContextValue>(
    () => ({ settings, updateSettings, setSettings: persist, resetSettings }),
    [settings, updateSettings, persist, resetSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Access the settings store from a component. Must be inside SettingsProvider. */
export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext);
  if (ctx === null) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
