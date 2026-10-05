import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { template } from '@/test/fixtures';
import { TemplateCatalogCard } from './template-catalog-card';

const meta = {
  title: 'Re-Shell/TemplateCatalogCard',
  component: TemplateCatalogCard,
  parameters: { layout: 'padded' },
  args: { template, onSelect: fn(), onDryRun: fn(), className: 'max-w-md' }
} satisfies Meta<typeof TemplateCatalogCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TierOne: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 3, name: 'FastAPI service' })).toBeVisible();
    await expect(canvas.getByText('Tier 1')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Select' }));
    await expect(args.onSelect).toHaveBeenCalledWith(template);
    await userEvent.click(canvas.getByRole('button', { name: 'Dry run' }));
    await expect(args.onDryRun).toHaveBeenCalledWith(template);
  }
};

export const TierTwo: Story = {
  args: { template: { ...template, tier: 2, database: undefined, name: 'Express API' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('Tier 1')).toBeNull();
  }
};
