import * as React from 'react';
import { Button, cn } from '@re-shell/ui';
import { Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { useSettings } from '../settings/useSettings';
import { useEnvelopeQuery } from '../screens/shared/useEnvelopeQuery';
import { summaryFeedSchema, type SummaryFeed } from '../screens/shared/summaryFeed';

function workspaceName(root: string): string {
  const trimmed = root.replace(/[\\/]+$/, '');
  const base = trimmed.split(/[\\/]/).pop();
  return base && base.length > 0 ? base : 'workspace';
}

/**
 * Top workspace bar (the page `banner`): identifies the active workspace + package manager from
 * the (deduped) `workspace.summary` read, surfaces hub reachability as a live status, and hosts
 * the theme toggle. Reads only: the query key is shared with Overview so TanStack returns the
 * cached value. The page's single `<h1>` is the ACTIVE SCREEN's name and lives in `<main>`
 * (App.tsx), so the workspace name here is plain text, not a heading.
 */
export function Topbar(): React.ReactElement {
  const { data, error, envelopeError, isLoading } = useEnvelopeQuery(
    'workspace.summary',
    summaryFeedSchema
  );

  // Online == the hub answered at all (success OR a CLI envelope error). A
  // transport/validation `error` or the initial load is "connecting / offline".
  const reachable = (data !== null || envelopeError !== null) && !error;
  const status: HubStatus = error ? 'offline' : isLoading && !reachable ? 'connecting' : 'online';

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-bg-0/85 px-4 py-3 backdrop-blur-md lg:px-8">
      <div className="min-w-0">
        <p className="label-eyebrow">Workspace</p>
        <p className="truncate font-mono text-sm font-medium tracking-tight" data-testid="workspace-name">
          {data ? workspaceName(data.root) : 'detecting…'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {data ? <PackageManagerChip data={data} /> : null}
        <HubStatusDot status={status} />
        <ThemeToggle />
      </div>
    </header>
  );
}

function PackageManagerChip({ data }: { data: SummaryFeed }): React.ReactElement {
  return (
    <span className="cli-chip" title="Package manager">
      <span className="label-eyebrow normal-case text-muted-foreground">pm</span>
      <span className="font-mono text-foreground">{data.packageManager}</span>
    </span>
  );
}

type HubStatus = 'online' | 'connecting' | 'offline';

const STATUS_META: Record<
  HubStatus,
  { label: string; dot: string; text: string; Icon: typeof Wifi }
> = {
  online: { label: 'Hub online', dot: 'bg-healthy shadow-glow-healthy', text: 'text-healthy', Icon: Wifi },
  connecting: { label: 'Connecting', dot: 'bg-warn shadow-glow-warn', text: 'text-warn', Icon: Wifi },
  offline: { label: 'Hub offline', dot: 'bg-critical shadow-glow-critical', text: 'text-critical', Icon: WifiOff },
};

/**
 * Hub reachability. The status text is REAL text inside the live region (visually hidden on
 * narrow screens, never `display: none`), so a change from "Connecting" to "Hub online" or "Hub
 * offline" is announced; the dot and icon are decoration and the colour is never the only signal.
 */
function HubStatusDot({ status }: { status: HubStatus }): React.ReactElement {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-1 px-2.5 py-1.5 shadow-elev-1"
      role="status"
      data-hub-status={status}
    >
      <span aria-hidden className="relative grid place-items-center">
        <span
          className={cn(
            'size-2 rounded-full',
            meta.dot,
            status === 'online' && 'animate-pulse-live'
          )}
        />
      </span>
      <meta.Icon className={cn('size-3.5', meta.text)} aria-hidden />
      <span className={cn('sr-only font-display text-xs font-medium sm:not-sr-only', meta.text)}>
        {meta.label}
      </span>
    </span>
  );
}

function ThemeToggle(): React.ReactElement {
  const { settings, updateSettings } = useSettings();
  const isDark = settings.theme === 'dark';
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
    >
      {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </Button>
  );
}
