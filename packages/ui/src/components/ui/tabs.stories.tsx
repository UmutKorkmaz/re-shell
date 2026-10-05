import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta = {
  title: 'UI/Tabs',
  component: Tabs
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArrowKeyNavigation: Story = {
  render: () => (
    <Tabs defaultValue="apps" className="max-w-lg">
      <TabsList aria-label="Workspace sections">
        <TabsTrigger value="apps">Apps</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="packages">Packages</TabsTrigger>
      </TabsList>
      <TabsContent value="apps">Two apps: store-front and admin.</TabsContent>
      <TabsContent value="services">One service: api.</TabsContent>
      <TabsContent value="packages">One package: ui-kit.</TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('tab', { name: 'Apps' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Services' })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('One service: api.');
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('tab', { name: 'Packages' })).toHaveFocus();
  }
};
