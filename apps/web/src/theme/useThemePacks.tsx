import * as React from 'react';
import type { ThemePack } from '@re-shell/contracts';
import {
  addThemePack,
  applyThemePack,
  loadThemePackState,
  removeThemePack,
  saveThemePackState,
  type ThemePackState,
} from './theme-packs';

interface ThemePackContextValue {
  /** Packs installed in this browser. */
  installed: readonly ThemePack[];
  /** The persisted (applied) pack id; null = the built-in theme. */
  activeId: string | null;
  /** A pack shown temporarily (not persisted), or null. */
  previewId: string | null;
  /** The pack currently painted (preview wins over the applied pack). */
  effectiveId: string | null;
  install: (pack: ThemePack) => void;
  remove: (id: string) => void;
  /** Persist and apply a pack (null = built-in). Ends any preview. */
  apply: (id: string | null) => void;
  /** Show a pack without persisting it (null ends the preview). */
  preview: (id: string | null) => void;
}

const ThemePackContext = React.createContext<ThemePackContextValue | null>(null);

/**
 * Owns the installed theme packs: persisted state, the live `<style>` element and the temporary
 * preview. Applying happens in an effect, so the DOM always reflects `preview ?? active`.
 */
export function ThemePackProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = React.useState<ThemePackState>(() => loadThemePackState());
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const effectiveId = previewId ?? state.activeId;
  const effectivePack = React.useMemo(
    () => state.installed.find((pack) => pack.id === effectiveId) ?? null,
    [state.installed, effectiveId]
  );

  React.useEffect(() => {
    applyThemePack(effectivePack);
  }, [effectivePack]);

  const commit = React.useCallback((next: ThemePackState): void => {
    setState(next);
    saveThemePackState(next);
  }, []);

  const value = React.useMemo<ThemePackContextValue>(
    () => ({
      installed: state.installed,
      activeId: state.activeId,
      previewId,
      effectiveId,
      install: (pack) => commit(addThemePack(state, pack)),
      remove: (id) => {
        setPreviewId((current) => (current === id ? null : current));
        commit(removeThemePack(state, id));
      },
      apply: (id) => {
        setPreviewId(null);
        commit({ installed: state.installed, activeId: id });
      },
      preview: (id) => setPreviewId(id),
    }),
    [state, previewId, effectiveId, commit]
  );

  return <ThemePackContext.Provider value={value}>{children}</ThemePackContext.Provider>;
}

/** Access the theme packs. Must be inside {@link ThemePackProvider}. */
export function useThemePacks(): ThemePackContextValue {
  const ctx = React.useContext(ThemePackContext);
  if (ctx === null) throw new Error('useThemePacks must be used within a ThemePackProvider');
  return ctx;
}
