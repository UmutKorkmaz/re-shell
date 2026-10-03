import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

import { cn } from '@/lib/utils';

/**
 * True while the element's content overflows it (either axis). Re-evaluated on
 * resize of the element or of its content, so a log panel that grows becomes
 * keyboard-focusable the moment it starts to scroll.
 */
function useIsScrollable(ref: React.RefObject<HTMLElement>): boolean {
  const [scrollable, setScrollable] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = (): void => {
      setScrollable(element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of Array.from(element.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [ref]);

  return scrollable;
}

export interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /**
   * Accessible name for the scrollable region. When the content overflows the
   * viewport becomes a focusable `region` with this name so keyboard users can
   * scroll it with the arrow keys (WCAG 2.1.1).
   */
  label?: string;
}

const ScrollArea = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  ({ className, children, label = 'Scrollable content', ...props }, ref) => {
    const viewportRef = React.useRef<HTMLDivElement>(null);
    const scrollable = useIsScrollable(viewportRef);
    return (
      <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          className="h-full w-full rounded-[inherit] focus-visible:outline-none focus-visible:shadow-focus-ring"
          {...(scrollable ? { tabIndex: 0, role: 'region', 'aria-label': label } : {})}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  }
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-px',
      orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-px',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border-strong" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
