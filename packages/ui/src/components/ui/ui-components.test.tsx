import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge, badgeVariants } from './badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';
import { Input } from './input';
import { Label } from './label';
import { Separator } from './separator';
import { ScrollArea, ScrollBar } from './scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './tooltip';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './sheet';

describe('Badge', () => {
  it('renders default variant text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies semantic variants', () => {
    render(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK').className).toContain('emerald');
  });

  it('renders asChild as the provided element', () => {
    render(
      <Badge asChild>
        <a href="#x">Link badge</a>
      </Badge>
    );
    const link = screen.getByRole('link', { name: 'Link badge' });
    expect(link).toBeInTheDocument();
  });

  it('exposes a variants helper', () => {
    expect(typeof badgeVariants).toBe('function');
    expect(badgeVariants({ variant: 'destructive' })).toContain('destructive');
  });
});

describe('Card family', () => {
  it('renders the full card composition', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('renders and forwards type/placeholder', () => {
    render(<Input type="email" placeholder="you@example.com" />);
    const input = screen.getByPlaceholderText('you@example.com');
    expect(input).toHaveAttribute('type', 'email');
  });
});

describe('Label', () => {
  it('associates with a control via htmlFor', () => {
    render(
      <>
        <Label htmlFor="name">Name</Label>
        <Input id="name" />
      </>
    );
    expect(screen.getByText('Name')).toHaveAttribute('for', 'name');
  });
});

describe('Separator', () => {
  it('renders horizontal and vertical orientations', () => {
    const { rerender } = render(<Separator data-testid="sep" />);
    expect(screen.getByTestId('sep')).toBeInTheDocument();
    rerender(<Separator orientation="vertical" data-testid="sep" />);
    expect(screen.getByTestId('sep')).toBeInTheDocument();
  });
});

describe('ScrollArea', () => {
  it('renders content and a scrollbar', () => {
    render(
      <ScrollArea>
        <div>Scrollable</div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
    expect(screen.getByText('Scrollable')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('shows the active tab content', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'B' })).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('renders the trigger', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });
});

describe('Sheet', () => {
  it('renders content composition when open', () => {
    render(
      <Sheet open>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet title</SheetTitle>
            <SheetDescription>Sheet description</SheetDescription>
          </SheetHeader>
          <SheetFooter>Footer area</SheetFooter>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByText('Sheet title')).toBeInTheDocument();
    expect(screen.getByText('Sheet description')).toBeInTheDocument();
    expect(screen.getByText('Footer area')).toBeInTheDocument();
  });

  it('renders the side variant', () => {
    render(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Left sheet</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByText('Left sheet')).toBeInTheDocument();
  });
});
