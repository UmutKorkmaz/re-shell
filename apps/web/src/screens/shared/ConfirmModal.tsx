import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@re-shell/ui';
import { ShieldAlert } from 'lucide-react';

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
 * Destructive-confirmation gate. Modals are reserved for destructive confirmation only (per the
 * control-surface design direction); detail views use Sheet drawers. Built on the shared `Dialog`
 * (Radix), so it has the full modal contract: focus moves in on open and is TRAPPED inside, Escape
 * cancels, focus RETURNS to the control that opened it, and the page behind is inert to assistive
 * technology. Renders nothing when closed and echoes the exact command that will run.
 */
export function ConfirmModal({
  open,
  title,
  description,
  commandText,
  confirmLabel = 'Confirm and run',
  onConfirm,
  onCancel,
}: ConfirmModalProps): React.ReactElement {
  // Remember what had focus when the modal opened (captured during render, before Radix moves focus
  // into the dialog) so it can be restored explicitly: the opener is usually a plain button that is
  // not a Radix trigger, which is the one case Radix cannot restore on its own.
  const opener = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpen.current = open;

  // Escape is handled here (one path, and it also works when focus is not inside the dialog),
  // so Radix's own Escape dismissal is turned off below to avoid cancelling twice.
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className="border-critical/50 shadow-glow-critical"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          const target = opener.current;
          if (target && target.isConnected && target !== document.body) {
            event.preventDefault();
            target.focus();
          }
        }}
        // With no description there is nothing to point at (and Radix would warn): opt out explicitly.
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-critical">
            <ShieldAlert className="size-4" aria-hidden="true" />
            {title}
          </DialogTitle>
        </DialogHeader>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        {commandText ? (
          <pre className="re-shell-mono relative overflow-x-auto rounded-md border border-border bg-bg-0 p-3 pl-7 text-xs text-foreground shadow-elev-1 before:absolute before:left-3 before:select-none before:text-signal before:content-['$']">
            {commandText}
          </pre>
        ) : null}
        <DialogFooter className="border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
