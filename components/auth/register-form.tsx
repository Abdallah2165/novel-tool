"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RegisterFormProps = {
  linuxDoEnabled?: boolean;
};

export function RegisterForm({ linuxDoEnabled = false }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLinuxDoPending, setIsLinuxDoPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setIsPending(true);

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: "/projects",
      });

      if (result.error) {
        setError(result.error.message ?? "注册失败，请稍后重试。");
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
        errorCallbackURL: "/register",
      });
    } catch {
      setError("Linux DO 登录发起失败，请稍后重试。");
      setIsLinuxDoPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
      <div>
        <label htmlFor="register-name" className="mb-2 block text-sm text-[var(--muted-ink)]">
          昵称
        </label>
        <Input
          id="register-name"
          placeholder="你的作者名"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="register-email" className="mb-2 block text-sm text-[var(--muted-ink)]">
          邮箱
        </label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="register-password" className="mb-2 block text-sm text-[var(--muted-ink)]">
          密码
        </label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="至少 8 位"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </div>
      <div>
        <label htmlFor="register-confirm-password" className="mb-2 block text-sm text-[var(--muted-ink)]">
          再次确认密码
        </label>
        <Input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="再次输入密码"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />
      </div>
      {error ? <p className="text-sm text-[#a04646]">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "注册中..." : "注册并初始化工作台"}
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
            {isLinuxDoPending ? "跳转中..." : "使用 Linux DO 登录 / 注册"}
          </Button>
        </>
      ) : null}
      <p className="text-sm text-[var(--muted-ink)]">
        已有账号？
        <Link href="/login" className="ml-2 text-[var(--accent-ink)]">
          去登录
        </Link>
      </p>
    </form>
  );
}
