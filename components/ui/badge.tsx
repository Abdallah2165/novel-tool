import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[rgba(184,144,82,0.12)] px-3 py-1 text-xs font-medium tracking-[0.16em] text-[var(--accent-ink)] uppercase",
        className,
      )}
      {...props}
    />
  );
}
