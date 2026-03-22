import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionPanel({
  title,
  description,
  action,
  className,
  children,
}: PropsWithChildren<{
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-[var(--line)] bg-[rgba(252,248,241,0.88)] p-5 shadow-[0_16px_40px_rgba(89,69,44,0.06)] backdrop-blur",
        className,
      )}
    >
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-serif text-lg text-[var(--ink)]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">{description}</p> : null}
        </div>
        {action ? <div className="w-full sm:w-auto sm:shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
