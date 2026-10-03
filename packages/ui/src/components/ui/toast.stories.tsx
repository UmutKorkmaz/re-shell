import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { Button } from './button';
import { ToastProvider, useToast } from './toast';

const meta = {
  title: 'UI/Toast',
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    )
  ]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Buttons(): React.ReactElement {
  const { toast } = useToast();
  return (
    <div className="flex gap-3">
      <Button onClick={() => toast({ title: 'Settings saved', description: 'Applied to this browser.', tone: 'healthy', durationMs: 0 })}>
        Save
      </Button>
      <Button
        variant="destructive"
        onClick={() => toast({ title: 'Job failed', description: 'exit code 2', tone: 'critical' })}
      >
        Fail
      </Button>
    </div>
  );
}

export const LiveRegions: Story = {
  render: () => <Buttons />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = within(canvasElement.ownerDocument.body).getByRole('region', { name: 'Notifications' });
    // The regions exist before any toast does, so announcements are not missed.
    await expect(within(viewport).getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await expect(within(viewport).getByRole('alert')).toHaveAttribute('aria-live', 'assertive');

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(within(viewport).getByRole('status')).toHaveTextContent('Settings saved');

    await userEvent.click(canvas.getByRole('button', { name: 'Fail' }));
    await expect(within(viewport).getByRole('alert')).toHaveTextContent('Job failed');

    await userEvent.click(within(viewport).getByRole('button', { name: /Dismiss notification: Settings saved/ }));
    await expect(within(viewport).getByRole('status')).not.toHaveTextContent('Settings saved');
  }
};
