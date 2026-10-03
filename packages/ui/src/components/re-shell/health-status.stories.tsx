import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { health } from '@/test/fixtures';
import { HealthStatus } from './health-status';

const meta = {
  title: 'Re-Shell/HealthStatus',
  component: HealthStatus,
  parameters: { layout: 'padded' },
  args: { health }
} satisfies Meta<typeof HealthStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Healthy')).toBeVisible();
    await expect(canvas.getByText('92')).toBeVisible();
  }
};

export const Warning: Story = {
  args: { health: { ...health, score: 71, status: 'warn' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Warning')).toBeVisible();
  }
};

export const Critical: Story = {
  args: { health: { ...health, score: 38, status: 'fail' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Critical')).toBeVisible();
  }
};
