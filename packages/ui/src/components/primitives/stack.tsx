import * as React from 'react';

import { cn } from '@/lib/utils';
import { forwardPolymorphic, type PolymorphicProps } from '@/lib/polymorphic';
import { spacingToCss, type Spacing } from '@/lib/units';
import { layoutStyle, splitLayoutProps, type BoxOwnProps } from './box';

/**
 * The layout axis is a discriminated union: `wrap` and `baseline` alignment only
 * exist on a row, so `<Stack wrap>` (a column) is a compile error.
 */
export type StackLayout =
  | { direction?: 'column'; wrap?: never; align?: 'start' | 'center' | 'end' | 'stretch' }
  | { direction: 'row'; wrap?: boolean; align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline' };

export type StackOwnProps = StackLayout &
  BoxOwnProps & {
    /** Space between children: a spacing-scale step or a branded px/rem length. */
    gap?: Spacing;
    justify?: 'start' | 'center' | 'end' | 'between';
  };

export type StackProps<C extends React.ElementType = 'div'> = PolymorphicProps<C, StackOwnProps>;

const alignClass = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline'
} as const;

const justifyClass = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between'
} as const;

/** Flex stack (column by default, `direction="row"` for a row). Polymorphic. */
export const Stack = forwardPolymorphic<'div', StackOwnProps>((props, ref) => {
  const { as, direction, wrap, align, justify, gap, className, style, ...others } = props as typeof props & {
    className?: string;
    style?: React.CSSProperties;
  };
  const [layout, rest] = splitLayoutProps(others as BoxOwnProps & Record<string, unknown>);
  const Component: React.ElementType = as ?? 'div';
  return (
    <Component
      ref={ref}
      data-slot="stack"
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        direction === 'row' && wrap && 'flex-wrap',
        align && alignClass[align],
        justify && justifyClass[justify],
        className
      )}
      style={{ ...(gap !== undefined ? { gap: spacingToCss(gap) } : null), ...layoutStyle(layout), ...style }}
      {...rest}
    />
  );
}, 'Stack');
