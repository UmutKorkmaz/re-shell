import * as React from 'react';
import { Button, cn } from '@re-shell/ui';
import { AlertTriangle, FolderOpen, Loader2, PlugZap } from 'lucide-react';

/** A shimmering skeleton placeholder block. */
export function SkeletonBlock({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return <div aria-hidden className={cn('skeleton h-4 w-full', className)} />;
}

/**
 * A structured skeleton loading screen — used as a polished loading state in
 * place of a plain spinner while data is fetching. Rendered alongside (above)
 * the accessible `LoadingPanel` so screen-readers still see the loading
 * announcement.
 */
export function SkeletonScreen({
  rows = 3,
  cols = 1,
}: {
  rows?: number;
  cols?: number;
}): React.ReactElement {
  return (
    <div
      aria-hidden
      className={cn(
        'grid gap-4',
        cols === 2 && 'md:grid-cols-2',
        cols === 3 && 'md:grid-cols-3',
        cols === 4 && 'md:grid-cols-4'
      )}
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <div key={i} className="surface overflow-hidden p-5">
          <div className="mb-4 flex items-center gap-3">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-10 opacity-60" />
          </div>
          <SkeletonBlock className="mb-2 h-7 w-3/4" />
          <SkeletonBlock className="h-3 w-full opacity-70" />
          <SkeletonBlock className="mt-1 h-3 w-5/6 opacity-50" />
        </div>
      ))}
    </div>
  );
}

interface BasePanelProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Compact, status-first message panel used for the loading/empty/error states
 * so no screen ever renders blank. Intentionally dense (icon + tight copy),
 * not a marketing hero.
 */
function MessagePanel({
  icon,
  title,
  description,
  action,
  tone = 'default',
}: BasePanelProps & {
  icon: React.ReactNode;
  tone?: 'default' | 'destructive' | 'muted';
}): React.ReactElement {
  const toneClass =
    tone === 'destructive'
      ? 'text-critical'
      : tone === 'muted'
        ? 'text-muted-foreground'
        : 'text-foreground';
  return (
    <div className="surface p-5">
      <h2 className={cn('flex items-center gap-2 font-display text-base font-semibold tracking-tight', toneClass)}>
        {icon}
        {title}
      </h2>
      {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingPanel({
  title,
  description,
  skeleton,
}: BasePanelProps & { skeleton?: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid gap-4">
      {skeleton ?? <SkeletonScreen />}
      <MessagePanel
        icon={<Loader2 className="size-4 animate-spin" />}
        title={title}
        description={description}
        tone="muted"
      />
    </div>
  );
}

export function EmptyPanel({ title, description, action }: BasePanelProps): React.ReactElement {
  return (
    <MessagePanel
      icon={<FolderOpen className="size-4" />}
      title={title}
      description={description}
      action={action}
      tone="muted"
    />
  );
}

interface ErrorPanelProps extends BasePanelProps {
  onRetry?: () => void;
}

export function ErrorPanel({
  title,
  description,
  onRetry,
  action,
}: ErrorPanelProps): React.ReactElement {
  return (
    <MessagePanel
      icon={<PlugZap className="size-4" />}
      title={title}
      description={description}
      tone="destructive"
      action={
        action ??
        (onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined)
      }
    />
  );
}

/** A CLI error-envelope panel (e.g. WORKSPACE_NOT_FOUND): shows the stable code. */
export function EnvelopeErrorPanel({
  code,
  message,
  action,
}: {
  code: string;
  message: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <MessagePanel
      icon={<AlertTriangle className="size-4" />}
      title={message}
      description={`CLI reported ${code}.`}
      tone="destructive"
      action={action}
    />
  );
}
