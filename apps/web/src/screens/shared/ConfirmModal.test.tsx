import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

/** The modal contract: focus moves in, is trapped, Escape cancels, focus returns to the opener. */
function Harness({ onConfirm }: { onConfirm: () => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Run destructive
      </button>
      <ConfirmModal
        open={open}
        title="Remove workspace"
        description="This cannot be undone."
        commandText="re-shell clean --all"
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe('ConfirmModal focus management', () => {
  it('moves focus into the dialog, traps Tab, cancels on Escape and returns focus to the opener', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const opener = screen.getByRole('button', { name: 'Run destructive' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Remove workspace' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // everything behind the modal is hidden from assistive technology
    expect(opener.closest('[aria-hidden="true"]')).not.toBeNull();

    // Tab / Shift+Tab never leave the dialog: Radix cycles focus within its content.
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
    expect(focusables.length).toBeGreaterThanOrEqual(3);
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(focusables[focusables.length - 1], { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('confirming runs the action and closes', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run destructive' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm and run' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('the close button cancels', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run destructive' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
