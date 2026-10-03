import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';

import { Button } from './button';
import { Input } from './input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from './sheet';

const meta = {
  title: 'UI/Sheet',
  component: Sheet
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example({ side = 'right' }: { side?: 'left' | 'right' | 'top' | 'bottom' }): React.ReactElement {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Open details</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Node details</SheetTitle>
          <SheetDescription>Everything the graph knows about this node.</SheetDescription>
        </SheetHeader>
        <Input aria-label="Notes" className="mt-4" />
        <SheetFooter className="mt-4">
          <Button size="sm">Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Focus moves in, is trapped, Escape closes it and focus returns to the trigger. */
export const FocusManagement: Story = {
  render: () => <Example />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Open details' });
    await userEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Node details' });
    await expect(dialog).toHaveAccessibleDescription('Everything the graph knows about this node.');
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
    <Sheet defaultOpen>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Template details</SheetTitle>
          <SheetDescription>Scaffold options for this template.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  play: async () => {
    await expect(await screen.findByRole('dialog', { name: 'Template details' })).toBeVisible();
  }
};
