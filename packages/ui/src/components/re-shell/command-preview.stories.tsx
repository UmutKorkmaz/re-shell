import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { commandSpec } from '@/test/fixtures';
import { CommandPreview } from './command-preview';

const meta = {
  title: 'Re-Shell/CommandPreview',
  component: CommandPreview,
  parameters: { layout: 'padded' },
  args: { spec: commandSpec, onDryRun: fn(), onRun: fn(), onCopy: fn() }
} satisfies Meta<typeof CommandPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('re-shell workspace health --json')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Dry run' }));
    await expect(args.onDryRun).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: /^Run/ }));
    await expect(args.onRun).toHaveBeenCalled();
  }
};

export const CopyAnnouncesStatus: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Copy command/ }));
    await waitFor(() => expect(args.onCopy).toHaveBeenCalledWith('re-shell workspace health --json'));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Command copied to clipboard'));
    // Let the transient "Copied" state revert so the screenshot is deterministic.
    await waitFor(() => expect(canvas.getByRole('button', { name: /Copy command/ })).toBeVisible(), { timeout: 4000 });
  }
};

export const Destructive: Story = {
  args: {
    spec: {
      title: 'Clean build output',
      description: 'Deletes every dist directory in the workspace.',
      command: ['re-shell', 'clean', '--all'],
      destructive: true,
      requiresConfirmation: true,
      dryRunSupported: false
    }
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Confirmation required')).toBeVisible();
  }
};
