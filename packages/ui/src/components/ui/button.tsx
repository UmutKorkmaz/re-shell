import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md font-display text-sm font-semibold tracking-tight transition-all duration-fast ease-standard focus-visible:outline-none focus-visible:shadow-focus-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-elev-1 hover:-translate-y-px hover:shadow-glow-signal",
        destructive:
          "bg-destructive text-destructive-foreground shadow-elev-1 hover:-translate-y-px hover:shadow-glow-critical",
        outline:
          "border border-border bg-bg-1 text-foreground shadow-elev-1 hover:border-border-strong hover:bg-bg-2 hover:-translate-y-px",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-bg-2 hover:border-border-strong",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-signal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
