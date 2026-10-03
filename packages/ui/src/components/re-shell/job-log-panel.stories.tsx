import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { jobLogs, runningJob } from '@/test/fixtures';
import { JobLogPanel } from './job-log-panel';

const meta = {
  title: 'Re-Shell/JobLogPanel',
  component: JobLogPanel,
  parameters: { layout: 'padded' },
  args: { job: runningJob, logs: jobLogs, onCancel: fn() }
} satisfies Meta<typeof JobLogPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('log', { name: 'Job output' })).toHaveTextContent('checking workspace manifest');
    await expect(canvas.getByRole('status')).toHaveTextContent('Job running');
    await userEvent.click(canvas.getByRole('button', { name: /Cancel/ }));
    await expect(args.onCancel).toHaveBeenCalled();
  }
};

export const Failed: Story = {
  args: { job: { ...runningJob, status: 'failed', exitCode: 2 }, logs: [...jobLogs, 'error: apps/web failed to compile'] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Job failed with exit code 2');
  }
};

export const Empty: Story = {
  args: { logs: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No logs yet.')).toBeVisible();
  }
};

function Streaming(): React.ReactElement {
  const [logs, setLogs] = React.useState<string[]>(['$ re-shell build']);
  React.useEffect(() => {
    const timer = setTimeout(() => setLogs((current) => [...current, 'built apps/web in 4.2s']), 150);
    return () => clearTimeout(timer);
  }, []);
  return <JobLogPanel job={runningJob} logs={logs} />;
}

/** New output is appended to the live log region, and the new line flashes in. */
export const StreamingOutput: Story = {
  render: () => <Streaming />,
  play: async ({ canvasElement }) => {
    const log = within(canvasElement).getByRole('log', { name: 'Job output' });
    await waitFor(() => expect(log).toHaveTextContent('built apps/web in 4.2s'));
  }
};
