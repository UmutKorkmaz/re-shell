import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { percent, px, rem } from '@/lib/units';
import { Box } from './box';
import { LiveRegion } from './live-region';
import { SkipLink } from './skip-link';
import { Stack } from './stack';
import { Text } from './text';
import { VisuallyHidden } from './visually-hidden';

const meta = {
  title: 'Primitives/Layout and text',
  parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BoxPolymorphic: Story = {
  name: 'Box (polymorphic as + branded units)',
  render: () => (
    <Stack gap={4}>
      <Box surface="card" padding={4} maxWidth={rem(24)}>
        A card surface with spacing-scale padding and a branded rem max width.
      </Box>
      <Box as="a" href="#docs" surface="raised" padding={px(12)} width={percent(60)} className="block text-signal underline">
        Rendered as an anchor, props of an anchor
      </Box>
      <Box as="section" aria-label="Metrics" surface="popover" paddingX={4} paddingY={2}>
        Rendered as a labelled section landmark
      </Box>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: /Rendered as an anchor/ })).toHaveAttribute('href', '#docs');
    await expect(canvas.getByRole('region', { name: 'Metrics' })).toBeVisible();
  }
};

export const TextVariants: Story = {
  name: 'Text (variants, tones, numeric, truncation)',
  render: () => (
    <Stack gap={2} maxWidth={rem(24)}>
      <Text variant="eyebrow">Eyebrow label</Text>
      <Text variant="display" as="h2">
        Display heading
      </Text>
      <Text>Body copy at the default size.</Text>
      <Text variant="caption">Caption text in the muted colour.</Text>
      <Text variant="mono">pnpm --filter @re-shell/ui build</Text>
      <Stack direction="row" gap={3} align="baseline">
        <Text numeric tone="healthy">
          1,284
        </Text>
        <Text numeric tone="warn">
          :3000
        </Text>
        <Text numeric tone="critical">
          0.42ms
        </Text>
        <Text tone="info">info</Text>
        <Text tone="signal">signal</Text>
      </Stack>
      <Text truncate lines={2}>
        A long description that is clamped to two lines when it is too long to fit in the available width of the
        container it is rendered into, so the rest is cut off with an ellipsis instead of wrapping forever.
      </Text>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 2, name: 'Display heading' })).toBeVisible();
  }
};

export const StackLayouts: Story = {
  name: 'Stack (row / column discriminated layout)',
  render: () => (
    <Stack gap={6}>
      <Stack direction="row" wrap gap={2} align="center" justify="between" surface="card" padding={3}>
        <Box surface="raised" padding={2}>
          one
        </Box>
        <Box surface="raised" padding={2}>
          two
        </Box>
        <Box surface="raised" padding={2}>
          three
        </Box>
      </Stack>
      <Stack as="ul" gap={px(6)} align="stretch" aria-label="Checks">
        <li>Lockfile present</li>
        <li>Node version pinned</li>
      </Stack>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('list', { name: 'Checks' })).toBeVisible();
  }
};

export const SkipToContent: Story = {
  render: () => (
    <div>
      <SkipLink targetId="story-main" />
      <button type="button">First focusable control</button>
      <main id="story-main" className="mt-4 rounded-md border border-border p-4">
        Main content
      </main>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const link = canvas.getByRole('link', { name: 'Skip to content' });
    await expect(link).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('main')).toHaveFocus();
  }
};

function LiveExample(): React.ReactElement {
  const [count, setCount] = React.useState(0);
  return (
    <div className="grid gap-3">
      <button
        type="button"
        className="w-fit rounded-md border border-border bg-bg-1 px-3 py-2 text-sm"
        onClick={() => setCount((c) => c + 1)}
      >
        Add item
      </button>
      <LiveRegion>{count === 0 ? '' : `${count} item${count === 1 ? '' : 's'} added`}</LiveRegion>
      <p>
        Visible count: <Text numeric>{count}</Text>
      </p>
    </div>
  );
}

export const LiveRegionAnnouncement: Story = {
  render: () => (
    <div className="grid gap-3">
      <LiveExample />
      <VisuallyHidden>Hidden helper text for screen readers</VisuallyHidden>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add item' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('1 item added');
  }
};
