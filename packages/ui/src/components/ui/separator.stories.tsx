import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { Separator } from './separator';

const meta = {
  title: 'UI/Separator',
  component: Separator
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="max-w-xs space-y-3 text-sm">
      <p>Overview</p>
      <Separator />
      <p>Details</p>
    </div>
  )
};

export const VerticalSemantic: Story = {
  render: () => (
    <div className="flex h-6 items-center gap-3 text-sm">
      <span>Apps</span>
      <Separator orientation="vertical" decorative={false} />
      <span>Services</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  }
};
