import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';

const meta = {
  title: 'UI/Card',
  component: Card
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Workspace health</CardTitle>
        <CardDescription>Checks run against the current workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-xl font-bold tabular-nums">92</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Re-run</Button>
      </CardFooter>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 2, name: 'Workspace health' })).toBeVisible();
  }
};

export const NestedHeadingLevel: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle as="h3">Nested under a section heading</CardTitle>
      </CardHeader>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 3 })).toBeVisible();
  }
};
