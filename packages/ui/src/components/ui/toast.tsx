import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { alertToneClass, type AlertTone } from './alert';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: AlertTone;
  /**
   * Auto-dismiss delay. Defaults to 6000ms; `critical` toasts and `0` stay until
   * dismissed (WCAG 2.2.1: nothing important disappears on its own).
   */
  durationMs?: number;
}

interface ToastRecord extends ToastInput {
  id: string;
  tone: AlertTone;
}

export interface ToastApi {
  /** Show a toast and return its id. */
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const DEFAULT_DURATION_MS = 6000;

/**
 * Toast provider + viewport. The viewport contains TWO persistent live regions
 * (polite `status` for info/healthy/warn, assertive `alert` for critical) that
 * exist before any toast does, so insertions are announced. Timers pause while a
 * toast is hovered or holds focus, and every toast has a dismiss button.
 */
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback((input: ToastInput) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setToasts((current) => [...current, { ...input, id, tone: input.tone ?? 'info' }]);
    return id;
  }, []);

  const api = React.useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  const polite = toasts.filter((item) => item.tone !== 'critical');
  const assertive = toasts.filter((item) => item.tone === 'critical');

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Notifications"
        data-slot="toast-viewport"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        <div role="status" aria-live="polite" aria-relevant="additions text" className="flex flex-col gap-2">
          {polite.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {assertive.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
      </section>
    </ToastContext.Provider>
  );
}

function ToastItem({
  item,
  onDismiss
}: {
  item: ToastRecord;
  onDismiss: (id: string) => void;
}): React.ReactElement {
  const duration = item.durationMs ?? (item.tone === 'critical' ? 0 : DEFAULT_DURATION_MS);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (duration <= 0 || paused) return undefined;
    const timer = setTimeout(() => onDismiss(item.id), duration);
    return () => clearTimeout(timer);
  }, [duration, paused, item.id, onDismiss]);

  return (
    <div
      data-slot="toast"
      data-tone={item.tone}
      className={cn(
        'pointer-events-auto flex animate-stagger-in items-start gap-3 rounded-md border p-3 shadow-elev-3',
        alertToneClass[item.tone],
        // Opaque surface (after the tinted tone background) so contrast does not
        // depend on whatever the toast happens to float over.
        'bg-popover'
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-semibold">{item.title}</div>
        {item.description ? <div className="text-sm text-popover-foreground">{item.description}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={`Dismiss notification: ${item.title}`}
        className="-m-1 rounded-sm p-1 text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus-ring"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Access the toast API. @throws when used outside a {@link ToastProvider}. */
export function useToast(): ToastApi {
  const api = React.useContext(ToastContext);
  if (api === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return api;
}
