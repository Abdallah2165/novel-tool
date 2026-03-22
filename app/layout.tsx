import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { UserNav } from "@/components/auth/user-nav";
import { resolveHeadersUser } from "@/lib/auth/identity";

import "./globals.css";

export const metadata: Metadata = {
  title: "小说工具台",
  description: "知识驱动的中文小说创作工作台。",
};

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/", label: "总览" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await resolveHeadersUser(await headers()).catch(() => null);

  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
          <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
            <header className="sticky top-4 z-20 mb-6 rounded-full border border-[var(--line)] bg-[rgba(250,245,237,0.82)] px-5 py-3 shadow-[0_14px_30px_rgba(78,59,38,0.08)] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ink)] text-sm tracking-[0.08em] text-[var(--paper)]">
                    小说
                  </div>
                  <div>
                    <p className="font-serif text-base">小说工具台</p>
                    <p className="text-xs text-[var(--muted-ink)]">知识驱动的中文创作工作台</p>
                  </div>
                </div>
                <nav className="flex flex-wrap items-center gap-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-full px-4 py-2 text-sm text-[var(--muted-ink)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--ink)]"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <UserNav user={user ? { name: user.name, email: user.email } : null} />
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
