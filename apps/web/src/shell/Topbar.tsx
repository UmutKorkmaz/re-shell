import * as React from 'react';
import { Button, cn } from '@re-shell/ui';
import { Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import type { ScreenDef } from './screens';
import { useSettings } from '../settings/useSettings';
import { useEnvelopeQuery } from '../screens/shared/useEnvelopeQuery';
import { summaryFeedSchema, type SummaryFeed } from '../screens/shared/summaryFeed';

interface TopbarProps {
  current: ScreenDef;
}

function workspaceName(root: string): string {
  const trimmed = root.replace(/[\\/]+$/, '');
  const base = trimmed.split(/[\\/]/).pop();
  return base && base.length > 0 ? base : 'workspace';
}

/**
 * Top workspace bar: identifies the active workspace + package manager from the
 * (deduped) `workspace.summary` read, surfaces hub reachability as a status dot,
 * and hosts the theme toggle. Reads only — no new data flow, the query key is
 * shared with Overview so TanStack returns the cached value.
 */
export function Topbar({ current }: TopbarProps): React.ReactElement {
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
        <div className="label-eyebrow">{current.label}</div>
        <h1 className="truncate font-display text-lg font-bold tracking-tight">
          {data ? workspaceName(data.root) : current.label}
        </h1>
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

function HubStatusDot({ status }: { status: HubStatus }): React.ReactElement {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-1 px-2.5 py-1.5 shadow-elev-1"
      role="status"
      aria-label={meta.label}
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
      <span className={cn('hidden font-display text-xs font-medium sm:inline', meta.text)}>
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
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
