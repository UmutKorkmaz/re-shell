import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { Badge } from './badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  args: { children: 'Healthy', variant: 'healthy' }
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Status: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['default', 'secondary', 'outline', 'healthy', 'warn', 'critical', 'info', 'destructive'] as const).map(
        (variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        )
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('healthy')).toBeVisible();
    await expect(canvas.getByText('critical')).toBeVisible();
  }
};

export const AsLink: Story = {
  args: { asChild: true, variant: 'outline' },
  render: (args) => (
    <Badge {...args}>
      <a href="#docs">Read the docs</a>
    </Badge>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'Read the docs' })).toHaveAttribute('href', '#docs');
  }
};
