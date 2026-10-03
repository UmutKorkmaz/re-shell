import {
  THEME_PACK_MAX_BYTES,
  parseThemePack,
  renderThemePackCss,
  type ThemePack,
} from '@re-shell/contracts';

/**
 * Runtime theme packs for the dashboard (Settings -> Appearance).
 *
 * A pack is a JSON token set (OKLCH colours per scheme, radius, font stacks) validated by the
 * `themePackSchema` in @re-shell/contracts, including a WCAG AA contrast check. Applying a pack is
 * nothing more than adding ONE `<style id="re-shell-theme-pack">` element whose CSS is generated
 * from the validated pack (`renderThemePackCss`), so removing it restores the built-in theme
 * exactly. State persists to localStorage; the rendered CSS of the ACTIVE pack is mirrored under a
 * second key so the inline boot script in index.html can apply it before the first paint.
 */

export const THEME_PACK_STORAGE_KEY = 're-shell.dashboard.themepacks.v1';
/** Rendered CSS of the active pack; read by the boot script in index.html. */
export const THEME_PACK_CSS_KEY = 're-shell.dashboard.themepack-css.v1';
export const THEME_PACK_STYLE_ID = 're-shell-theme-pack';

/** The most packs kept in the browser (bounds the localStorage footprint). */
export const MAX_INSTALLED_PACKS = 24;

/** What is persisted. */
export interface ThemePackState {
  readonly installed: readonly ThemePack[];
  /** Id of the applied pack, or null for the built-in theme. */
  readonly activeId: string | null;
}

export const EMPTY_THEME_PACK_STATE: ThemePackState = { installed: [], activeId: null };

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Load persisted state. Every stored pack is RE-VALIDATED: a pack that no longer validates (schema
 * tightened, storage edited by hand) is dropped rather than applied.
 */
export function loadThemePackState(): ThemePackState {
  const store = storage();
  const raw = store?.getItem(THEME_PACK_STORAGE_KEY);
  if (!raw) return EMPTY_THEME_PACK_STATE;
  try {
    const parsed = JSON.parse(raw) as { installed?: unknown; activeId?: unknown };
    const installed: ThemePack[] = [];
    if (Array.isArray(parsed.installed)) {
      for (const candidate of parsed.installed.slice(0, MAX_INSTALLED_PACKS)) {
        const result = parseThemePack(candidate);
        if (result.ok && !installed.some((pack) => pack.id === result.pack.id)) installed.push(result.pack);
      }
    }
    const activeId = typeof parsed.activeId === 'string' && installed.some((pack) => pack.id === parsed.activeId) ? parsed.activeId : null;
    return { installed, activeId };
  } catch {
    return EMPTY_THEME_PACK_STATE;
  }
}

/** Persist state (and the active pack's CSS for the boot script). Failures are non-fatal. */
export function saveThemePackState(state: ThemePackState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(THEME_PACK_STORAGE_KEY, JSON.stringify(state));
    const active = state.installed.find((pack) => pack.id === state.activeId);
    if (active) store.setItem(THEME_PACK_CSS_KEY, renderThemePackCss(active));
    else store.removeItem(THEME_PACK_CSS_KEY);
  } catch {
    // quota exceeded / blocked: the pack still applies for this session
  }
}

/** Add (or replace by id) a pack. @throws when the install cap is reached. */
export function addThemePack(state: ThemePackState, pack: ThemePack): ThemePackState {
  const without = state.installed.filter((existing) => existing.id !== pack.id);
  if (without.length >= MAX_INSTALLED_PACKS) {
    throw new Error(`At most ${MAX_INSTALLED_PACKS} theme packs can be installed; remove one first.`);
  }
  return { installed: [...without, pack], activeId: state.activeId };
}

/** Remove a pack; if it was active the built-in theme is restored. */
export function removeThemePack(state: ThemePackState, id: string): ThemePackState {
  return {
    installed: state.installed.filter((pack) => pack.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  };
}

/** Apply a pack's CSS (or remove the style element when `pack` is null). */
export function applyThemePack(pack: ThemePack | null): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(THEME_PACK_STYLE_ID);
  if (!pack) {
    existing?.remove();
    return;
  }
  const css = renderThemePackCss(pack);
  if (existing) {
    existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.id = THEME_PACK_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// install sources
// ---------------------------------------------------------------------------

/** A readable error from a failed install attempt (shown verbatim in the UI). */
export class ThemeInstallError extends Error {
  readonly problems: readonly string[];
  constructor(message: string, problems: readonly string[] = []) {
    super(message);
    this.name = 'ThemeInstallError';
    this.problems = problems;
  }
}

/** Validate untrusted text as a theme pack. @throws {ThemeInstallError} with every problem listed. */
export function parseThemePackText(text: string, origin: string): ThemePack {
  const result = parseThemePack(text);
  if (!result.ok) {
    const errors = (result as { errors: readonly string[] }).errors;
    throw new ThemeInstallError(`${origin} is not a valid theme pack.`, errors);
  }
  return (result as { pack: ThemePack }).pack;
}

/** Whether a remote theme URL is acceptable: https, or http to a loopback host. */
export function isAllowedThemeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

/** Download a pack from a URL (https / loopback http only, size-capped). */
export async function fetchThemePack(url: string, fetchImpl: typeof fetch = fetch): Promise<ThemePack> {
  const trimmed = url.trim();
  if (!isAllowedThemeUrl(trimmed)) {
    throw new ThemeInstallError('Use an https:// URL (http:// is only allowed for localhost).');
  }
  let response: Response;
  try {
    response = await fetchImpl(trimmed, { headers: { accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (error) {
    throw new ThemeInstallError(
      `Could not download the theme (${error instanceof Error ? error.message : 'network error'}). The server must allow cross-origin requests (CORS).`
    );
  }
  if (!response.ok) throw new ThemeInstallError(`The server answered HTTP ${response.status}.`);
  const text = await response.text();
  if (new TextEncoder().encode(text).length > THEME_PACK_MAX_BYTES) {
    throw new ThemeInstallError(`The theme is larger than ${Math.round(THEME_PACK_MAX_BYTES / 1024)} KB.`);
  }
  return parseThemePackText(text, trimmed);
}

/** Read a pack from a user-selected file. */
export function readThemePackFile(file: File): Promise<ThemePack> {
  return new Promise((resolve, reject) => {
    if (file.size > THEME_PACK_MAX_BYTES) {
      reject(new ThemeInstallError(`${file.name} is larger than ${Math.round(THEME_PACK_MAX_BYTES / 1024)} KB.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new ThemeInstallError(`Could not read ${file.name}.`));
    reader.onload = () => {
      try {
        resolve(parseThemePackText(String(reader.result ?? ''), file.name));
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
}
