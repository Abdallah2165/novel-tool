import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-3xl border border-[var(--line)] bg-[rgba(255,252,246,0.88)] px-4 py-3 text-sm leading-7 text-[var(--ink)] shadow-sm outline-none transition-colors placeholder:text-[var(--muted-ink)] focus:border-[var(--ring)] focus:bg-[var(--paper)]",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";

export { Textarea };
