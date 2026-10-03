import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export type AlertTone = 'info' | 'healthy' | 'warn' | 'critical';

/**
 * Dismissibility is a discriminated union: a dismissible alert MUST say what
 * dismissing does, and a non-dismissible one cannot carry a dead handler.
 */
export type AlertDismissal =
  | { dismissible?: false; onDismiss?: never }
  | { dismissible: true; onDismiss: () => void };

export type AlertProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'role' | 'title'> & {
  tone?: AlertTone;
  title?: React.ReactNode;
} & AlertDismissal;

export const alertToneClass: Record<AlertTone, string> = {
  info: 'border-info/40 bg-info/10 text-info',
  healthy: 'border-healthy/40 bg-healthy/10 text-healthy',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  critical: 'border-critical/40 bg-critical/10 text-critical'
};

const toneIcon = {
  info: Info,
  healthy: CheckCircle2,
  warn: TriangleAlert,
  critical: AlertCircle
} as const;

/**
 * An inline message. `critical` is announced assertively (`role="alert"`); the
 * other tones are polite (`role="status"`). Colour is never the only signal:
 * each tone has its own icon and the title is real text.
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ tone = 'info', title, dismissible, onDismiss, className, children, ...props }, ref) => {
    const Icon = toneIcon[tone];
    return (
      <div
        ref={ref}
        data-slot="alert"
        data-tone={tone}
        role={tone === 'critical' ? 'alert' : 'status'}
        className={cn('flex items-start gap-3 rounded-md border p-3', alertToneClass[tone], className)}
        {...props}
      >
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-0.5">
          {title ? <div className="font-display text-sm font-semibold">{title}</div> : null}
          {children ? <div className="text-sm text-foreground">{children}</div> : null}
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-m-1 rounded-sm p-1 text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }
);
Alert.displayName = 'Alert';
