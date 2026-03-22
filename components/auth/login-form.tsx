"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginFormProps = {
  linuxDoEnabled?: boolean;
};

export function LoginForm({ linuxDoEnabled = false }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLinuxDoPending, setIsLinuxDoPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/projects",
      });

      if (result.error) {
        setError(result.error.message ?? "登录失败，请检查邮箱和密码。");
        return;
      }

      router.replace("/projects");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleLinuxDoSignIn() {
    setError(null);
    setIsLinuxDoPending(true);

    try {
      await authClient.signIn.oauth2({
        providerId: "linux-do",
        callbackURL: "/projects",
        errorCallbackURL: "/login",
      });
    } catch {
      setError("Linux DO 登录发起失败，请稍后重试。");
      setIsLinuxDoPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
      <div>
        <label htmlFor="login-email" className="mb-2 block text-sm text-[var(--muted-ink)]">
          邮箱
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-2 block text-sm text-[var(--muted-ink)]">
          密码
        </label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="输入密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-[#a04646]">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "登录中..." : "登录并进入项目台"}
      </Button>
      {linuxDoEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-[var(--muted-ink)]">
            <span className="h-px flex-1 bg-[var(--line)]" />
            <span>或使用 Linux DO</span>
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>
          <Button
            className="w-full"
            type="button"
            variant="secondary"
            disabled={isPending || isLinuxDoPending}
            onClick={() => void handleLinuxDoSignIn()}
          >
            {isLinuxDoPending ? "跳转中..." : "使用 Linux DO 登录"}
          </Button>
        </>
      ) : null}
      <p className="text-sm text-[var(--muted-ink)]">
        还没有账号？
        <Link href="/register" className="ml-2 text-[var(--accent-ink)]">
          去注册
        </Link>
      </p>
    </form>
  );
}
