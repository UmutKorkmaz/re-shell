import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import { Button } from './button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';

const meta = {
  title: 'UI/Dialog',
  component: Dialog
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example(): React.ReactElement {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Remove workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this workspace?</DialogTitle>
          <DialogDescription>This deletes the generated files. It cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" size="sm">
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Focus moves in, is trapped, Escape closes it, focus returns to the trigger. */
export const FocusManagement: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Remove workspace' });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Remove this workspace?' });
    await expect(dialog).toHaveAccessibleDescription('This deletes the generated files. It cannot be undone.');
    await expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      await expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  }
};

export const Open: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run destructive command?</DialogTitle>
          <DialogDescription>re-shell clean --all</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
  play: async () => {
    await expect(await screen.findByRole('dialog', { name: 'Run destructive command?' })).toBeVisible();
  }
};
