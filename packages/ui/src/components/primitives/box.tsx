import * as React from 'react';

import { cn } from '@/lib/utils';
import { forwardPolymorphic, type PolymorphicProps } from '@/lib/polymorphic';
import { spacingToCss, type CssLength, type Spacing } from '@/lib/units';

/** Elevation surfaces from the design system (`.surface*` utilities). */
export type BoxSurface = 'none' | 'card' | 'raised' | 'popover';

const surfaceClass: Record<BoxSurface, string | undefined> = {
  none: undefined,
  card: 'surface',
  raised: 'surface-raised',
  popover: 'surface-pop'
};

export interface BoxOwnProps {
  /** Padding on all sides: a spacing-scale step or a branded px/rem length. */
  padding?: Spacing;
  paddingX?: Spacing;
  paddingY?: Spacing;
  margin?: Spacing;
  width?: CssLength;
  height?: CssLength;
  minWidth?: CssLength;
  maxWidth?: CssLength;
  minHeight?: CssLength;
  maxHeight?: CssLength;
  surface?: BoxSurface;
}

export type BoxProps<C extends React.ElementType = 'div'> = PolymorphicProps<C, BoxOwnProps>;

/** Translate the typed layout props into an inline style object. */
export function layoutStyle(props: BoxOwnProps): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (props.padding !== undefined) style.padding = spacingToCss(props.padding);
  if (props.paddingX !== undefined) {
    style.paddingLeft = spacingToCss(props.paddingX);
    style.paddingRight = spacingToCss(props.paddingX);
  }
  if (props.paddingY !== undefined) {
    style.paddingTop = spacingToCss(props.paddingY);
    style.paddingBottom = spacingToCss(props.paddingY);
  }
  if (props.margin !== undefined) style.margin = spacingToCss(props.margin);
  if (props.width !== undefined) style.width = props.width;
  if (props.height !== undefined) style.height = props.height;
  if (props.minWidth !== undefined) style.minWidth = props.minWidth;
  if (props.maxWidth !== undefined) style.maxWidth = props.maxWidth;
  if (props.minHeight !== undefined) style.minHeight = props.minHeight;
  if (props.maxHeight !== undefined) style.maxHeight = props.maxHeight;
  return style;
}

/** Split typed layout props from the rest (the target element's own props). */
export function splitLayoutProps<P extends BoxOwnProps>(
  props: P
): [BoxOwnProps, Omit<P, keyof BoxOwnProps>] {
  const {
    padding,
    paddingX,
    paddingY,
    margin,
    width,
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    surface,
    ...rest
  } = props;
  return [
    { padding, paddingX, paddingY, margin, width, height, minWidth, maxWidth, minHeight, maxHeight, surface },
    rest
  ];
}

/**
 * Polymorphic layout box. `as` selects the element; the remaining props are
 * that element's props, and `ref` is typed for it.
 */
export const Box = forwardPolymorphic<'div', BoxOwnProps>((props, ref) => {
  const { as, className, style, ...others } = props as typeof props & {
    className?: string;
    style?: React.CSSProperties;
  };
  const [layout, rest] = splitLayoutProps(others as BoxOwnProps & Record<string, unknown>);
  const Component: React.ElementType = as ?? 'div';
  return (
    <Component
      ref={ref}
      data-slot="box"
      className={cn(surfaceClass[layout.surface ?? 'none'], className)}
      style={{ ...layoutStyle(layout), ...style }}
      {...rest}
    />
  );
}, 'Box');
