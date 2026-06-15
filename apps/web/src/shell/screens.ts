/**
 * The seven dashboard screens, addressed by a stable `id` that doubles as the
 * `?screen=` URL search-param value (route-as-URL). Screen implementations land
 * in the next wave; this wave ships the shell + nav and a single working data
 * panel (Overview) wired to the secure hub.
 */
export interface ScreenDef {
  readonly id: ScreenId;
  readonly label: string;
  readonly description: string;
}

export type ScreenId =
  | 'overview'
  | 'graph'
  | 'templates'
  | 'commands'
  | 'assistant'
  | 'jobs'
  | 'health'
  | 'scorecard'
  | 'catalog'
  | 'settings';

export const SCREENS: readonly ScreenDef[] = [
  { id: 'overview', label: 'Overview', description: 'Workspace summary and topology at a glance.' },
  { id: 'graph', label: 'Workspace Graph', description: 'Dependency graph across apps and services.' },
  { id: 'templates', label: 'Templates', description: 'Browse and scaffold from the template catalog.' },
  { id: 'commands', label: 'Command Builder', description: 'Compose and preview vetted CLI commands.' },
  {
    id: 'assistant',
    label: 'Assistant',
    description:
      'Ask in plain language; the assistant resolves it to a single allow-listed hub command and streams the result.',
  },
  { id: 'jobs', label: 'Jobs & Logs', description: 'Live job output streamed from the hub.' },
  { id: 'health', label: 'Health', description: 'Workspace health checks and diagnostics.' },
  {
    id: 'scorecard',
    label: 'Scorecard',
    description: 'Weighted production-readiness grades per service and a monorepo rollup.',
  },
  {
    id: 'catalog',
    label: 'Catalog',
    description: 'Auto-discovered software catalog with Backstage interop (no hand-written YAML).',
  },
  { id: 'settings', label: 'Settings', description: 'Hub connection and dashboard preferences.' },
];

export const DEFAULT_SCREEN: ScreenId = 'overview';

const SCREEN_IDS = new Set<string>(SCREENS.map((screen) => screen.id));

/** Narrow an untrusted string to a known {@link ScreenId}, else the default. */
export function toScreenId(value: string | null): ScreenId {
  if (value !== null && SCREEN_IDS.has(value)) {
    return value as ScreenId;
  }
  return DEFAULT_SCREEN;
}
