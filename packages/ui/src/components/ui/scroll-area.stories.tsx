import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { ScrollArea } from './scroll-area';

const meta = {
  title: 'UI/ScrollArea',
  component: ScrollArea
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardScrollable: Story = {
  render: () => (
    <ScrollArea label="Build output" className="h-32 w-80 rounded-md border border-border bg-bg-0">
      <pre className="p-3 font-mono text-xs">
        {Array.from({ length: 60 }, (_, i) => `compiling module ${i + 1}`).join('\n')}
      </pre>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    // Overflowing content becomes a named, focusable region so it can be scrolled by keyboard.
    const region = await within(canvasElement).findByRole('region', { name: 'Build output' });
    await userEvent.tab();
    await expect(region).toHaveFocus();
    // The region really overflows; native arrow/PageDown scrolling then works because it has focus.
    await waitFor(() => expect(region.scrollHeight).toBeGreaterThan(region.clientHeight));
  }
};

export const NoOverflowNoTabStop: Story = {
  render: () => (
    <ScrollArea className="h-32 w-80 rounded-md border border-border">
      <p className="p-3 text-sm">Short content.</p>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('region')).toBeNull();
  }
};
