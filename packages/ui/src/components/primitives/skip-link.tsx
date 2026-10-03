import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SkipLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** The id of the element to move focus to (normally `<main id="main-content">`). */
  targetId: string;
}

/**
 * "Skip to content" link (WCAG 2.4.1 Bypass Blocks). It is the first focusable
 * element, hidden until it receives keyboard focus. Activation moves focus to the
 * target explicitly (the target is made programmatically focusable), because a
 * bare `#hash` jump scrolls but does not move focus in every browser/SPA setup.
 */
export const SkipLink = React.forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ targetId, className, children = 'Skip to content', onClick, ...props }, ref) => (
    <a
      ref={ref}
      data-slot="skip-link"
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-border-strong focus:bg-popover focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:font-semibold focus:text-popover-foreground focus:shadow-elev-3 focus:outline-none focus:shadow-focus-ring',
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: false });
      }}
      {...props}
    >
      {children}
    </a>
  )
);
SkipLink.displayName = 'SkipLink';
