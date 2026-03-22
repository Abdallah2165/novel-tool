"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
  redirectTo?: Route;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "secondary" | "ghost";
  className?: string;
};

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return payload?.error?.message ?? "删除项目失败。";
}

export function DeleteProjectButton({
  projectId,
  projectName,
  redirectTo,
  size = "sm",
  variant = "secondary",
  className,
}: DeleteProjectButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm(
          `确定删除项目“${projectName}”吗？\n\n项目文件、草稿、导出归档和对象存储里的关联文件都会一起清理，这个操作不能撤销。`,
        );

        if (!confirmed) {
          return;
        }

        startTransition(async () => {
          const response = await fetch(`/api/projects/${projectId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            window.alert(await readErrorMessage(response));
            return;
          }

          if (redirectTo) {
            router.replace(redirectTo);
          }

          router.refresh();
        });
      }}
    >
      {isPending ? "删除中" : "删除项目"}
    </Button>
  );
}
