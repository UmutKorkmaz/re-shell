import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { forwardPolymorphic, type PolymorphicProps } from '@/lib/polymorphic';

const textVariants = cva('', {
  variants: {
    variant: {
      body: 'font-sans text-sm',
      small: 'font-sans text-xs',
      caption: 'font-sans text-xs text-muted-foreground',
      eyebrow:
        'font-display text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground',
      display: 'font-display text-xl font-semibold tracking-tight',
      mono: 'font-mono text-[0.8125rem] font-medium tracking-tight'
    },
    tone: {
      default: '',
      muted: 'text-muted-foreground',
      signal: 'text-signal',
      healthy: 'text-healthy',
      warn: 'text-warn',
      critical: 'text-critical',
      info: 'text-info'
    },
    numeric: {
      true: 'font-mono tabular-nums',
      false: ''
    }
  },
  defaultVariants: { variant: 'body', tone: 'default', numeric: false }
});

export type TextVariant = 'body' | 'small' | 'caption' | 'eyebrow' | 'display' | 'mono';
export type TextTone = 'default' | 'muted' | 'signal' | 'healthy' | 'warn' | 'critical' | 'info';

/**
 * `lines` only makes sense together with `truncate: true` (multi-line clamp), so
 * the two are a discriminated union: `{ lines: 2 }` alone does not compile.
 */
export type TextTruncation =
  | { truncate?: false; lines?: never }
  | { truncate: true; lines?: 1 | 2 | 3 | 4 };

export type TextOwnProps = {
  variant?: TextVariant;
  tone?: TextTone;
  /** Render figures in the mono face with tabular numerals (metrics, ports, counts). */
  numeric?: boolean;
} & TextTruncation;

export type TextProps<C extends React.ElementType = 'span'> = PolymorphicProps<C, TextOwnProps>;

const clampClass: Record<number, string> = {
  1: 'truncate',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4'
};

/** Polymorphic typography primitive. */
export const Text = forwardPolymorphic<'span', TextOwnProps>((props, ref) => {
  const { as, variant, tone, numeric, truncate, lines, className, ...rest } = props as typeof props & {
    className?: string;
  };
  const Component: React.ElementType = as ?? 'span';
  return (
    <Component
      ref={ref}
      data-slot="text"
      className={cn(
        textVariants({ variant, tone, numeric: numeric ?? false }),
        truncate ? clampClass[lines ?? 1] : undefined,
        className
      )}
      {...rest}
    />
  );
}, 'Text');

export { textVariants };
