import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { app, service } from '@/test/fixtures';
import { TopologyNodeCard } from './topology-node-card';

const meta = {
  title: 'Re-Shell/TopologyNodeCard',
  component: TopologyNodeCard,
  parameters: { layout: 'padded' },
  args: { item: app, kind: 'app', className: 'max-w-sm' }
} satisfies Meta<typeof TopologyNodeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RunningApp: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('running')).toBeVisible();
    await expect(canvas.getByText(':3000')).toBeVisible();
  }
};

export const ErroredService: Story = {
  args: { item: service, kind: 'service' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('error')).toBeVisible();
  }
};
