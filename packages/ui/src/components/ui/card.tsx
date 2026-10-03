import * as React from "react";

import { cn } from "@/lib/utils";
import { forwardPolymorphic, type PolymorphicProps } from "@/lib/polymorphic";

/** Elements a card title may render as, so the document outline never skips a level. */
export type HeadingElement = 'h2' | 'h3' | 'h4' | 'div';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-elev-1",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn("flex flex-col space-y-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export type CardTitleProps<C extends React.ElementType = "h2"> = PolymorphicProps<C>;

/**
 * Card heading. Renders an `h2` by default (a card is a page section, directly
 * below the screen's `h1`); pass `as="h3"` (or `"div"`) when the card is nested
 * deeper so the document outline never skips a level.
 */
const CardTitle = forwardPolymorphic<"h2">(({ as, className, ...props }, ref) => {
  const Component: React.ElementType = as ?? "h2";
  return (
    <Component
      ref={ref}
      data-slot="card-title"
      className={cn(
        "font-display text-[0.9375rem] font-semibold leading-tight tracking-tight",
        className,
      )}
      {...props}
    />
  );
}, "CardTitle");
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="card-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn("p-5 pt-0", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
