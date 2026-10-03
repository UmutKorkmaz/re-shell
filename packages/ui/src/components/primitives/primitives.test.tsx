import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { percent, px, rem } from '@/lib/units';
import { Box } from './box';
import { Stack } from './stack';
import { Text } from './text';
import { CardTitle } from '../ui/card';

describe('Box', () => {
  it('renders a div by default and an arbitrary element with `as`', () => {
    const { rerender } = render(<Box data-testid="b" />);
    expect(screen.getByTestId('b').tagName).toBe('DIV');
    rerender(<Box as="section" data-testid="b" />);
    expect(screen.getByTestId('b').tagName).toBe('SECTION');
    rerender(
      <Box as="a" href="/docs" data-testid="b">
        docs
      </Box>
    );
    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute('href', '/docs');
  });

  it('turns typed layout props into inline styles', () => {
    render(
      <Box data-testid="b" padding={4} paddingX={px(3)} margin={rem(0.5)} width={percent(50)} maxWidth={rem(30)} minHeight={px(40)} />
    );
    const style = screen.getByTestId('b').style;
    // paddingX is more specific than padding for the horizontal sides.
    expect(style.paddingTop).toBe('1rem');
    expect(style.paddingLeft).toBe('3px');
    expect(style.paddingRight).toBe('3px');
    expect(style.margin).toBe('0.5rem');
    expect(style.width).toBe('50%');
    expect(style.maxWidth).toBe('30rem');
    expect(style.minHeight).toBe('40px');
  });

  it('merges className and style, and does not leak layout props to the DOM', () => {
    render(<Box data-testid="b" surface="raised" className="extra" style={{ color: 'red' }} padding={2} />);
    const el = screen.getByTestId('b');
    expect(el.className).toContain('surface-raised');
    expect(el.className).toContain('extra');
    expect(el.style.color).toBe('red');
    expect(el.style.padding).toBe('0.5rem');
    expect(el.hasAttribute('padding')).toBe(false);
    expect(el.hasAttribute('surface')).toBe(false);
  });

  it('forwards refs to the target element', () => {
    const ref = React.createRef<HTMLAnchorElement>();
    render(
      <Box as="a" href="#x" ref={ref}>
        x
      </Box>
    );
    expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
    const divRef = React.createRef<HTMLDivElement>();
    render(<Box ref={divRef} />);
    expect(divRef.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('Text', () => {
  it('renders variants, tones and numeric (mono + tabular-nums)', () => {
    render(
      <Text variant="eyebrow" tone="healthy" data-testid="t">
        Label
      </Text>
    );
    const el = screen.getByTestId('t');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('uppercase');
    expect(el.className).toContain('text-healthy');

    render(
      <Text numeric data-testid="n">
        42
      </Text>
    );
    expect(screen.getByTestId('n').className).toContain('tabular-nums');
    expect(screen.getByTestId('n').className).toContain('font-mono');
  });

  it('truncates to one line or clamps lines', () => {
    render(
      <>
        <Text truncate data-testid="one">
          x
        </Text>
        <Text truncate lines={3} data-testid="three">
          x
        </Text>
      </>
    );
    expect(screen.getByTestId('one').className).toContain('truncate');
    expect(screen.getByTestId('three').className).toContain('line-clamp-3');
    expect(screen.getByTestId('three')).not.toHaveAttribute('lines');
  });

  it('supports `as` with the target element props', () => {
    render(
      <Text as="time" dateTime="2026-01-01" data-testid="t">
        Jan 1
      </Text>
    );
    expect(screen.getByTestId('t').tagName).toBe('TIME');
    expect(screen.getByTestId('t')).toHaveAttribute('datetime', '2026-01-01');
  });
});

describe('Stack', () => {
  it('is a column by default and a row on request', () => {
    const { rerender } = render(<Stack data-testid="s" gap={2} />);
    expect(screen.getByTestId('s').className).toContain('flex-col');
    expect(screen.getByTestId('s').style.gap).toBe('0.5rem');
    rerender(<Stack data-testid="s" direction="row" wrap align="baseline" justify="between" gap={px(10)} />);
    const el = screen.getByTestId('s');
    expect(el.className).toContain('flex-row');
    expect(el.className).toContain('flex-wrap');
    expect(el.className).toContain('items-baseline');
    expect(el.className).toContain('justify-between');
    expect(el.style.gap).toBe('10px');
  });

  it('is polymorphic (semantic list)', () => {
    render(
      <Stack as="ul" aria-label="items">
        <li>one</li>
      </Stack>
    );
    expect(screen.getByRole('list', { name: 'items' })).toBeInTheDocument();
  });
});

describe('CardTitle', () => {
  it('is an h2 by default and respects `as` and refs', () => {
    const ref = React.createRef<HTMLHeadingElement>();
    const { rerender } = render(<CardTitle ref={ref}>Section</CardTitle>);
    expect(screen.getByRole('heading', { level: 2, name: 'Section' })).toBe(ref.current);
    rerender(<CardTitle as="h3">Section</CardTitle>);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });
});
