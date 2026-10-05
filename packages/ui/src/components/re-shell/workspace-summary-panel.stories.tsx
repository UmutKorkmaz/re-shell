import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { workspace } from '@/test/fixtures';
import { WorkspaceSummaryPanel } from './workspace-summary-panel';

const meta = {
  title: 'Re-Shell/WorkspaceSummaryPanel',
  component: WorkspaceSummaryPanel,
  parameters: { layout: 'padded' },
  args: { workspace, onRunHealth: fn(), onOpenSettings: fn() }
} satisfies Meta<typeof WorkspaceSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DirtyBranch: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 2, name: 'demo-monorepo' })).toBeVisible();
    await expect(canvas.getByText('Dirty workspace')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /Health/ }));
    await expect(args.onRunHealth).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Open settings' }));
    await expect(args.onOpenSettings).toHaveBeenCalled();
  }
};

export const CleanWithoutGit: Story = {
  args: { workspace: { ...workspace, git: undefined, nodeVersion: undefined } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('Dirty workspace')).toBeNull();
  }
};
