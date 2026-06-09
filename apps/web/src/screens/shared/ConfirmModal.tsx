import * as React from 'react';
import { Button } from '@re-shell/ui';
import { ShieldAlert, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  /** Monospace command echoed in the modal so the operator sees exactly what runs. */
  commandText?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive-confirmation gate. Modals are reserved for destructive
 * confirmation only (per the control-surface design direction); detail views use
 * Sheet drawers. Renders nothing when closed, traps the action behind an
 * explicit confirm, and echoes the exact command that will run.
 */
export function ConfirmModal({
  open,
  title,
  description,
  commandText,
  confirmLabel = 'Confirm and run',
  onConfirm,
  onCancel,
}: ConfirmModalProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-lg border border-critical/50 bg-popover shadow-elev-3 shadow-glow-critical">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <h2
            id="confirm-modal-title"
            className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-critical"
          >
            <ShieldAlert className="size-4" />
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:shadow-focus-ring"
            onClick={onCancel}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
          {commandText ? (
            <pre className="re-shell-mono overflow-x-auto rounded-md border border-border bg-bg-0 p-3 pl-7 text-xs text-foreground shadow-elev-1 before:absolute before:left-3 before:select-none before:text-signal before:content-['$'] relative">
              {commandText}
            </pre>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
