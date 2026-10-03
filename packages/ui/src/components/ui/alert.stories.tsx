import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { Alert } from './alert';

const meta = {
  title: 'UI/Alert',
  component: Alert
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div className="grid max-w-lg gap-3">
      <Alert tone="info" title="Heads up">
        The hub reconnected.
      </Alert>
      <Alert tone="healthy" title="Theme installed">
        Midnight Lime is ready to apply.
      </Alert>
      <Alert tone="warn" title="Stale cache">
        The turbo cache is 14 days old.
      </Alert>
      <Alert tone="critical" title="Build failed">
        apps/web did not compile.
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // critical is announced assertively, the rest politely
    await expect(canvas.getByRole('alert')).toHaveTextContent('Build failed');
    await expect(canvas.getAllByRole('status')).toHaveLength(3);
  }
};

function DismissibleExample(): React.ReactElement {
  const [open, setOpen] = React.useState(true);
  return open ? (
    <Alert tone="warn" title="Unsaved changes" dismissible onDismiss={() => setOpen(false)}>
      Save before leaving.
    </Alert>
  ) : (
    <p>Dismissed</p>
  );
}

export const Dismissible: Story = {
  render: () => <DismissibleExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await expect(canvas.getByText('Dismissed')).toBeVisible();
  }
};
