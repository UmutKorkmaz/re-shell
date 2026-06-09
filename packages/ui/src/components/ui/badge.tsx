import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition-colors duration-fast focus:outline-none focus-visible:shadow-focus-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive shadow-glow-critical",
        outline: "border-border bg-bg-1 text-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        // semantic status variants (token-driven, with subtle glow)
        healthy:
          "border-healthy/40 bg-healthy/10 text-healthy shadow-glow-healthy",
        warn:
          "border-warn/40 bg-warn/10 text-warn shadow-glow-warn",
        critical:
          "border-critical/40 bg-critical/10 text-critical shadow-glow-critical",
        info:
          "border-info/40 bg-info/10 text-info shadow-glow-info",
        // legacy emerald/amber variants kept for stable behavior
        success:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-glow-healthy",
        warning:
          "border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-glow-warn",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ asChild = false, className, variant, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        ref={ref}
        data-slot="badge"
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
