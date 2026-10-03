/**
 * Accessibility tests for EVERY component in the library: an axe (WCAG 2.x A/AA +
 * best-practice) scan of each, in the states that change the DOM, plus the
 * keyboard / focus behaviour that axe cannot see. Colour contrast is covered by
 * `styles/tokens.test.ts` and by the browser audit in apps/web.
 */
import * as React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '@/test/axe';
import {
  app,
  commandSpec,
  health,
  jobLogs,
  runningJob,
  service,
  template,
  workspace
} from '@/test/fixtures';

import { Box } from './primitives/box';
import { LiveRegion } from './primitives/live-region';
import { SkipLink } from './primitives/skip-link';
import { Stack } from './primitives/stack';
import { Text } from './primitives/text';
import { VisuallyHidden } from './primitives/visually-hidden';
import { CommandPreview } from './re-shell/command-preview';
import { HealthStatus } from './re-shell/health-status';
import { JobLogPanel } from './re-shell/job-log-panel';
import { TemplateCatalogCard } from './re-shell/template-catalog-card';
import { TopologyNodeCard } from './re-shell/topology-node-card';
import { WorkspaceSummaryPanel } from './re-shell/workspace-summary-panel';
import { Alert } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ToastProvider, useToast } from './ui/toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

describe('primitives are accessible', () => {
  it('Box / Text / Stack with semantic `as` targets', async () => {
    const { container } = render(
      <Box as="main" padding={4}>
        <Stack as="ul" gap={2}>
          <li>
            <Text as="p">First</Text>
          </li>
          <li>
            <Text as="p" variant="caption">
              Second
            </Text>
          </li>
        </Stack>
        <Stack as="nav" aria-label="Section" direction="row" wrap gap={2}>
          <Box as="a" href="#a">
            A
          </Box>
          <Box as="a" href="#b">
            B
          </Box>
        </Stack>
      </Box>
    );
    await expectNoA11yViolations(container);
  });

  it('VisuallyHidden keeps its text in the accessibility tree', () => {
    render(
      <button type="button">
        <VisuallyHidden>Close dialog</VisuallyHidden>
      </button>
    );
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  it('LiveRegion is a persistent status region and supports assertive alerts', async () => {
    const { container, rerender } = render(<LiveRegion>{''}</LiveRegion>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    rerender(<LiveRegion>Saved</LiveRegion>);
    // Same DOM node: the content changed, the region was not re-inserted.
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Saved');
    await expectNoA11yViolations(container);

    rerender(<LiveRegion politeness="assertive">Failed</LiveRegion>);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('SkipLink is hidden until focused and moves focus to its target', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div>
        <SkipLink targetId="main-content" />
        <button type="button">First control</button>
        <main id="main-content">Content</main>
      </div>
    );
    await expectNoA11yViolations(container);
    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link.className).toContain('sr-only');
    expect(link.className).toContain('focus:not-sr-only');

    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });
});

describe('ui components are accessible', () => {
  it('Badge (every variant)', async () => {
    const { container } = render(
      <div>
        {(['default', 'destructive', 'outline', 'secondary', 'healthy', 'warn', 'critical', 'info'] as const).map(
          (variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          )
        )}
      </div>
    );
    await expectNoA11yViolations(container);
  });

  it('Button (variants, sizes, disabled, icon with label)', async () => {
    const { container } = render(
      <div>
        <Button>Default</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary" size="sm">
          Secondary
        </Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
        <Button size="icon" aria-label="Open settings" />
        <Button asChild>
          <a href="#x">As link</a>
        </Button>
      </div>
    );
    await expectNoA11yViolations(container);
  });

  it('Card family with a heading hierarchy', async () => {
    const { container } = render(
      <main>
        <h1>Page</h1>
        <Card>
          <CardHeader>
            <CardTitle>Section</CardTitle>
            <CardDescription>About</CardDescription>
          </CardHeader>
          <CardContent>
            <Card>
              <CardHeader>
                <CardTitle as="h3">Nested</CardTitle>
              </CardHeader>
            </Card>
          </CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      </main>
    );
    await expectNoA11yViolations(container);
    expect(screen.getByRole('heading', { level: 2, name: 'Section' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Nested' })).toBeInTheDocument();
  });

  it('Input with a Label, hint and invalid state', async () => {
    const { container } = render(
      <form>
        <Label htmlFor="port">Port</Label>
        <Input id="port" aria-invalid="true" aria-describedby="port-error" defaultValue="80" />
        <p id="port-error">Port must be at least 1024.</p>
      </form>
    );
    await expectNoA11yViolations(container);
    expect(screen.getByLabelText('Port')).toBeInvalid();
  });

  it('Separator (decorative and semantic)', async () => {
    const { container } = render(
      <div>
        <Separator />
        <Separator decorative={false} orientation="vertical" />
      </div>
    );
    await expectNoA11yViolations(container);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('ScrollArea is keyboard focusable only when its content overflows', async () => {
    const original = {
      scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
      clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    };
    // jsdom has no layout: report an overflowing viewport.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 100 });
    try {
      const { container } = render(
        <ScrollArea label="Build output" className="h-24">
          <pre>{'line\n'.repeat(50)}</pre>
        </ScrollArea>
      );
      const region = await screen.findByRole('region', { name: 'Build output' });
      expect(region).toHaveAttribute('tabindex', '0');
      await expectNoA11yViolations(container);
    } finally {
      for (const [key, descriptor] of Object.entries(original)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
      }
    }
  });

  it('ScrollArea adds no tab stop when nothing overflows', async () => {
    const { container } = render(
      <ScrollArea>
        <p>short</p>
      </ScrollArea>
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(container.querySelector('[tabindex]')).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('Tabs: roving arrow-key navigation and correct ARIA', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Sections">
          <TabsTrigger value="a">Alpha</TabsTrigger>
          <TabsTrigger value="b">Beta</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    );
    await expectNoA11yViolations(container);
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel B');
  });

  it('Tooltip content is linked to its trigger and reachable by keyboard focus', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Help</Button>
          </TooltipTrigger>
          <TooltipContent>More about this</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Help' })).toHaveFocus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('More about this');
    await expectNoA11yViolations(container);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('Sheet: focus moves in, is trapped, Escape closes, focus returns to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Open details</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
            <SheetDescription>Everything about it</SheetDescription>
          </SheetHeader>
          <Input aria-label="Name" />
          <SheetFooter>
            <Button>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
    const trigger = screen.getByRole('button', { name: 'Open details' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Details' });
    expect(dialog).toHaveAccessibleDescription('Everything about it');
    // Focus moved INTO the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true);
    await expectNoA11yViolations(dialog);

    // Focus is trapped: tabbing many times never leaves the dialog.
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    // Content outside the dialog is inert to assistive tech.
    expect(trigger.closest('[aria-hidden="true"]')).not.toBeNull();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Focus returns to the control that opened it.
    expect(trigger).toHaveFocus();
  });

  it('Alert: critical is assertive, others polite; icon never the only signal', async () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <div>
        <Alert tone="info" title="Heads up">
          Informational
        </Alert>
        <Alert tone="healthy" title="Done" />
        <Alert tone="warn" title="Careful" dismissible onDismiss={onDismiss}>
          Dismiss me
        </Alert>
        <Alert tone="critical" title="Failed">
          Something broke
        </Alert>
      </div>
    );
    await expectNoA11yViolations(container);
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe('Toast', () => {
    function Harness({ tone, durationMs }: { tone?: 'info' | 'critical'; durationMs?: number }): React.ReactElement {
      const { toast } = useToast();
      return (
        <button
          type="button"
          onClick={() => toast({ title: 'Settings saved', description: 'Applied', tone, durationMs })}
        >
          Notify
        </button>
      );
    }

    it('announces through persistent live regions, is dismissible, and auto-dismisses', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ToastProvider>
          <Harness durationMs={50} />
        </ToastProvider>
      );
      // The live regions exist BEFORE any toast does (required for announcements).
      const viewport = screen.getByRole('region', { name: 'Notifications' });
      const polite = within(viewport).getByRole('status');
      expect(polite).toHaveAttribute('aria-live', 'polite');
      expect(within(viewport).getByRole('alert')).toHaveAttribute('aria-live', 'assertive');

      await user.click(screen.getByRole('button', { name: 'Notify' }));
      expect(polite).toHaveTextContent('Settings saved');
      await expectNoA11yViolations(container);
      // Auto-dismiss after durationMs (timer state update happens inside act).
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 120));
      });
      expect(polite).not.toHaveTextContent('Settings saved');
    });

    it('critical toasts go to the assertive region and stay until dismissed', async () => {
      const user = userEvent.setup();
      render(
        <ToastProvider>
          <Harness tone="critical" />
        </ToastProvider>
      );
      await user.click(screen.getByRole('button', { name: 'Notify' }));
      const alertRegion = within(screen.getByRole('region', { name: 'Notifications' })).getByRole('alert');
      expect(alertRegion).toHaveTextContent('Settings saved');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 120));
      });
      expect(alertRegion).toHaveTextContent('Settings saved');
      await user.click(screen.getByRole('button', { name: /Dismiss notification: Settings saved/ }));
      expect(alertRegion).not.toHaveTextContent('Settings saved');
    });

    it('useToast outside a provider fails loudly', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(() => render(<Harness />)).toThrow(/ToastProvider/);
      spy.mockRestore();
    });
  });
});

describe('re-shell components are accessible', () => {
  it('HealthStatus', async () => {
    const { container } = render(
      <main>
        <h1>Health</h1>
        <HealthStatus health={health} />
      </main>
    );
    await expectNoA11yViolations(container);
  });

  it('TemplateCatalogCard keeps heading order under a section heading', async () => {
    const { container } = render(
      <main>
        <h1>Templates</h1>
        <h2>Catalog</h2>
        <TemplateCatalogCard template={template} onSelect={() => undefined} onDryRun={() => undefined} />
      </main>
    );
    await expectNoA11yViolations(container);
    expect(screen.getByRole('heading', { level: 3, name: 'FastAPI service' })).toBeInTheDocument();
  });

  it('TopologyNodeCard (app and service)', async () => {
    const { container } = render(
      <div>
        <TopologyNodeCard item={app} kind="app" />
        <TopologyNodeCard item={service} kind="service" />
      </div>
    );
    await expectNoA11yViolations(container);
  });

  it('WorkspaceSummaryPanel', async () => {
    const { container } = render(
      <main>
        <h1>Overview</h1>
        <WorkspaceSummaryPanel workspace={workspace} onRunHealth={() => undefined} onOpenSettings={() => undefined} />
      </main>
    );
    await expectNoA11yViolations(container);
  });

  it('CommandPreview announces copy status', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(
      <main>
        <h1>Commands</h1>
        <CommandPreview spec={commandSpec} onRun={() => undefined} onDryRun={() => undefined} />
      </main>
    );
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('button', { name: /Copy command/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Command copied to clipboard'));
  });

  it('JobLogPanel exposes output as a log live region and announces status changes', async () => {
    const { container, rerender } = render(
      <main>
        <h1>Jobs</h1>
        <JobLogPanel job={runningJob} logs={jobLogs} onCancel={() => undefined} />
      </main>
    );
    await expectNoA11yViolations(container);
    const log = screen.getByRole('log', { name: 'Job output' });
    expect(log).toHaveAttribute('aria-relevant', 'additions');
    expect(screen.getByRole('status')).toHaveTextContent('Job running');

    rerender(
      <main>
        <h1>Jobs</h1>
        <JobLogPanel job={{ ...runningJob, status: 'failed', exitCode: 2 }} logs={[...jobLogs, 'boom']} />
      </main>
    );
    expect(screen.getByRole('status')).toHaveTextContent('Job failed with exit code 2');
    expect(within(screen.getByRole('log')).getByText('boom')).toBeInTheDocument();
  });

  it('JobLogPanel flashes only lines appended after the first render', () => {
    const { rerender } = render(<JobLogPanel job={runningJob} logs={['history 1', 'history 2']} />);
    rerender(<JobLogPanel job={runningJob} logs={['history 1', 'history 2', 'fresh line']} />);
    expect(screen.getByText('history 1').className).not.toContain('animate-log-flash');
    expect(screen.getByText('fresh line').className).toContain('animate-log-flash');
  });
});

describe('Dialog and configurable headings', () => {
  it('Dialog: focus moves in, is trapped, Escape closes, focus returns to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="destructive">Remove</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove it?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button size="sm">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    const trigger = screen.getByRole('button', { name: 'Remove' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Remove it?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await expectNoA11yViolations(dialog);
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('domain components render their title at the requested heading level', () => {
    render(
      <main>
        <h1>Screen</h1>
        <h2>Section</h2>
        <CommandPreview spec={commandSpec} headingAs="h3" />
        <JobLogPanel job={runningJob} logs={[]} headingAs="h3" />
        <HealthStatus health={health} headingAs="h3" />
        <WorkspaceSummaryPanel workspace={workspace} headingAs="h3" />
      </main>
    );
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0);
  });
});
