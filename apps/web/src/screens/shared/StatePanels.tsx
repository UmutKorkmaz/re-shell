import * as React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@umutkorkmaz/ui';
import { AlertTriangle, FolderOpen, Loader2, PlugZap } from 'lucide-react';

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
      ? 'text-destructive'
      : tone === 'muted'
        ? 'text-muted-foreground'
        : 'text-foreground';
  return (
    <Card>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-base ${toneClass}`}>
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}

export function LoadingPanel({ title, description }: BasePanelProps): React.ReactElement {
  return (
    <MessagePanel
      icon={<Loader2 className="size-4 animate-spin" />}
      title={title}
      description={description}
      tone="muted"
    />
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
