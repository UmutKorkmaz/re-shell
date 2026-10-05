import * as React from 'react';

import { cn } from '@/lib/utils';

export interface LiveRegionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> {
  /** `polite` waits for a pause; `assertive` interrupts. Default `polite`. */
  politeness?: 'polite' | 'assertive';
  /** Announce the whole region on every change (default) or only the changed nodes. */
  atomic?: boolean;
  /** Keep the text visible instead of visually hidden. */
  visible?: boolean;
}

/**
 * An ARIA live region for status changes. The element is rendered on first
 * paint and its CHILDREN change afterwards, which is what screen readers need to
 * announce an update (a live region inserted together with its text is often
 * missed).
 */
export const LiveRegion = React.forwardRef<HTMLDivElement, LiveRegionProps>(
  ({ politeness = 'polite', atomic = true, visible = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="live-region"
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      aria-atomic={atomic}
      className={cn(!visible && 'sr-only', className)}
      {...props}
    >
      {children}
    </div>
  )
);
LiveRegion.displayName = 'LiveRegion';
