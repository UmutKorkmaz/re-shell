import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Input',
  component: Input
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLabel: Story = {
  render: () => (
    <div className="grid max-w-sm gap-1.5">
      <Label htmlFor="workspace">Workspace path</Label>
      <Input id="workspace" placeholder="/path/to/workspace" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Workspace path');
    await userEvent.type(input, '/srv/monorepo');
    await expect(input).toHaveValue('/srv/monorepo');
  }
};

export const InvalidWithError: Story = {
  render: () => (
    <div className="grid max-w-sm gap-1.5">
      <Label htmlFor="port">Daemon port</Label>
      <Input id="port" defaultValue="80" aria-invalid="true" aria-describedby="port-error" />
      <p id="port-error" className="text-sm text-critical">
        Port must be between 1024 and 65535.
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Daemon port');
    await expect(input).toBeInvalid();
    await expect(input).toHaveAccessibleDescription('Port must be between 1024 and 65535.');
  }
};

export const Disabled: Story = {
  render: () => (
    <div className="grid max-w-sm gap-1.5">
      <Label htmlFor="locked">Locked</Label>
      <Input id="locked" disabled defaultValue="read only" />
    </div>
  )
};
