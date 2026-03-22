import Link from "next/link";
import * as React from "react";

import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost";

const BUTTON_LINK_TEXT_VARIANTS: Record<ButtonVariant, string> = {
  default: "text-[var(--paper)]",
  secondary: "text-[var(--ink)]",
  ghost: "text-[var(--muted-ink)] group-hover:text-[var(--ink)]",
};

type ButtonLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> & {
  href: string;
  className?: string;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  variant?: ButtonVariant;
  size?: ButtonProps["size"];
};

export function ButtonLink({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: ButtonLinkProps) {
  const resolvedVariant: ButtonVariant = variant ?? "default";
  const linkProps = props as unknown as React.ComponentProps<typeof Link>;

  return (
    <Link {...linkProps} className={cn("group", buttonVariants({ variant: resolvedVariant, size }), className)}>
      <span className={cn("leading-tight", BUTTON_LINK_TEXT_VARIANTS[resolvedVariant])}>{children}</span>
    </Link>
  );
}
