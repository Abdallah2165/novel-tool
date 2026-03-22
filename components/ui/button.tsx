import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center rounded-full text-center text-sm font-medium leading-tight whitespace-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--ink)] px-4 py-2 text-[var(--paper)] shadow-[0_10px_24px_rgba(41,32,26,0.12)] hover:bg-[var(--ink-soft)]",
        secondary:
          "bg-[var(--panel)] px-4 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--panel-strong)]",
        ghost: "px-3 py-2 text-[var(--muted-ink)] hover:bg-[var(--panel)]",
      },
      size: {
        default: "min-h-10",
        sm: "min-h-8 px-3 py-1.5 text-xs",
        lg: "min-h-11 px-5 py-2.5 text-sm",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
);

Button.displayName = "Button";

export { Button, buttonVariants };
