import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-2xl border border-[var(--line)] bg-[rgba(255,252,246,0.88)] px-4 py-2 text-sm text-[var(--ink)] shadow-sm outline-none transition-colors placeholder:text-[var(--muted-ink)] focus:border-[var(--ring)] focus:bg-[var(--paper)]",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";

export { Input };
