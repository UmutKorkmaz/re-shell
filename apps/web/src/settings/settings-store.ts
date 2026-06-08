import { z } from 'zod';

/**
 * Dashboard settings store.
 *
 * Persists user-facing dashboard preferences to localStorage behind a single
 * zod-validated shape. Anything that fails validation (corrupt or stale stored
 * data) falls back to {@link DEFAULT_SETTINGS} rather than throwing, so the UI
 * is never wedged by bad persisted state.
 *
 * The safety-mode value is the destructive-confirmation gate read by the
 * Command Builder (W5-3): {@link getSafetyMode} / {@link isDestructiveGateEnabled}
 * expose it without forcing a React subscription, so non-component code can read
 * the live value synchronously.
 */

export const themeSchema = z.enum(['light', 'dark']);
export type Theme = z.infer<typeof themeSchema>;

/**
 * Daemon port range. 0 is reserved; ports below 1024 are privileged and a poor
 * default for a local dev daemon, so the validated floor is 1024.
 */
const MIN_PORT = 1024;
const MAX_PORT = 65_535;

export const settingsSchema = z.object({
  /** Absolute path to the workspace the hub should operate against. */
  workspacePath: z.string(),
  /** Path (or bare command) used to invoke the re-shell CLI binary. */
  cliBinaryPath: z.string(),
  /** TCP port the local hub daemon listens on. */
  daemonPort: z.number().int().min(MIN_PORT).max(MAX_PORT),
  /** Opt-in to anonymous usage telemetry. Defaults off. */
  telemetryOptIn: z.boolean(),
  /** Active color theme; flips the shadcn CSS-variable tokens live. */
  theme: themeSchema,
  /**
   * When true, destructive commands require an explicit confirmation step in
   * the Command Builder. This is the destructive gate other screens read.
   */
  safetyMode: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  workspacePath: '',
  cliBinaryPath: 're-shell',
  daemonPort: 3333,
  telemetryOptIn: false,
  theme: 'light',
  safetyMode: true,
};

const STORAGE_KEY = 're-shell.dashboard.settings.v1';

export const PORT_BOUNDS = { min: MIN_PORT, max: MAX_PORT } as const;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Read the persisted settings, falling back to safe defaults on any parse or
 * validation failure. Unknown/extra keys are dropped by the schema; missing
 * keys are filled from {@link DEFAULT_SETTINGS} before validation so a partial
 * stored object still yields a complete, valid settings value.
 */
export function loadSettings(): Settings {
  if (!hasLocalStorage()) {
    return DEFAULT_SETTINGS;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const merged =
      typeof parsed === 'object' && parsed !== null
        ? { ...DEFAULT_SETTINGS, ...(parsed as Record<string, unknown>) }
        : DEFAULT_SETTINGS;
    const result = settingsSchema.safeParse(merged);
    return result.success ? result.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist a validated settings value. Invalid input is rejected (no write). */
export function saveSettings(settings: Settings): void {
  const result = settingsSchema.safeParse(settings);
  if (!result.success) {
    return;
  }
  if (!hasLocalStorage()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
}

/**
 * Apply the theme to the document by toggling the `.dark` class on the root
 * element and syncing `color-scheme`. This is what makes the toggle flip the
 * shadcn tokens live (the `.dark` selector in globals.css redefines them).
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

// ---------------------------------------------------------------------------
// Safety-mode gate (consumed by the Command Builder destructive flow)
// ---------------------------------------------------------------------------

/** Read the live persisted safety-mode flag synchronously (no React needed). */
export function getSafetyMode(): boolean {
  return loadSettings().safetyMode;
}

/**
 * True when a destructive command must be confirmed before it runs. Today this
 * is exactly the safety-mode flag; kept as a named predicate so the Command
 * Builder gate reads intentionally and can evolve without touching callers.
 */
export function isDestructiveGateEnabled(): boolean {
  return getSafetyMode();
}
