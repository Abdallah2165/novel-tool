"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";

type UserNavProps = {
  user:
    | {
        name?: string | null;
        email?: string | null;
      }
    | null;
};

function getDisplayName(user: UserNavProps["user"]) {
  if (!user) {
    return "";
  }

  const name = user.name?.trim();
  if (name) {
    return name;
  }

  const email = user.email?.trim();
  if (email) {
    return email.split("@")[0] ?? email;
  }

  return "我的账号";
}

export function UserNav({ user }: UserNavProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full px-4 py-2 text-sm text-[var(--muted-ink)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--ink)]"
      >
        登录
      </Link>
    );
  }

  const displayName = getDisplayName(user);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,250,243,0.92)] px-4 py-2 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--panel)]"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="max-w-[11rem] truncate">{displayName}</span>
        <span className="text-xs text-[var(--muted-ink)]">{isOpen ? "收起" : "菜单"}</span>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 rounded-[22px] border border-[var(--line)] bg-[rgba(255,250,243,0.98)] p-2 shadow-[0_18px_42px_rgba(78,59,38,0.08)] backdrop-blur">
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--paper)] px-3 py-3">
            <p className="text-sm text-[var(--ink)]">{displayName}</p>
            <p className="mt-1 truncate text-xs text-[var(--muted-ink)]">{user.email ?? "未绑定邮箱"}</p>
          </div>

          <div className="mt-2 space-y-1">
            <Link
              href="/projects"
              className="block rounded-[16px] px-3 py-2 text-sm text-[var(--ink-soft)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--ink)]"
              onClick={() => setIsOpen(false)}
            >
              项目列表
            </Link>
            <Link
              href="/settings"
              className="block rounded-[16px] px-3 py-2 text-sm text-[var(--ink-soft)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--ink)]"
              onClick={() => setIsOpen(false)}
            >
              个人资料卡
            </Link>
            <button
              type="button"
              className="block w-full rounded-[16px] px-3 py-2 text-left text-sm text-[#9f3a2f] transition-colors hover:bg-[rgba(159,58,47,0.08)]"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
            >
              {isSigningOut ? "退出中..." : "退出登录"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
