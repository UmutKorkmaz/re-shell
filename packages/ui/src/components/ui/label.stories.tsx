import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Label',
  component: Label,
  args: { children: 'Package manager' }
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FocusesItsControl: Story = {
  render: (args) => (
    <div className="grid max-w-xs gap-1.5">
      <Label {...args} htmlFor="pm" />
      <Input id="pm" defaultValue="pnpm" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Package manager'));
    await expect(canvas.getByLabelText('Package manager')).toHaveFocus();
  }
};
