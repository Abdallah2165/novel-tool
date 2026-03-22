"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getArtifactDisplayLabel } from "@/lib/projects/artifact-display";

type OverlayArtifact = {
  id: string;
  artifactKey: string;
  filename: string;
  currentRevision: {
    content: string;
    summary: string;
    createdAt: string | Date;
  } | null;
};

function formatTime(value: Date | string | undefined | null) {
  if (!value) {
    return "未更新";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return "保存失败。";
}

export function ProjectOverlayEditor({
  projectId,
  promptOverlay,
  skillOverlay,
  onboardingBrief,
}: {
  projectId: string;
  promptOverlay: OverlayArtifact | null;
  skillOverlay: OverlayArtifact | null;
  onboardingBrief: OverlayArtifact | null;
}) {
  const router = useRouter();
  const [promptContent, setPromptContent] = useState(promptOverlay?.currentRevision?.content ?? "");
  const [skillContent, setSkillContent] = useState(skillOverlay?.currentRevision?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeSaveKey, setActiveSaveKey] = useState<"prompt" | "skill" | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveOverlay(
    artifact: OverlayArtifact | null,
    nextContent: string,
    saveKey: "prompt" | "skill",
    summary: string,
  ) {
    if (!artifact) {
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/artifacts/${artifact.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "save_overlay",
        revisionContent: nextContent,
        summary,
      }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new Error(readErrorMessage(payload));
    }

    setActiveSaveKey(saveKey);
    setMessage(`${getArtifactDisplayLabel(artifact.artifactKey, artifact.filename)} 已保存为新版本。`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--ink)]">项目专属提示补充</p>
            <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
              只补充本项目的表达风格、叙事重心和审稿偏好，不覆盖全局安全规则。
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !promptOverlay}
            onClick={() => {
              setError(null);
              setMessage(null);
              setActiveSaveKey("prompt");
              startTransition(async () => {
                try {
                  await saveOverlay(
                    promptOverlay,
                    promptContent,
                    "prompt",
                    "保存项目提示补充",
                  );
                } catch (saveError) {
                  setError(saveError instanceof Error ? saveError.message : "保存提示补充失败。");
                }
              });
            }}
          >
            {isPending && activeSaveKey === "prompt" ? "保存中" : "保存提示补充"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-ink)]">
          最近版本：{promptOverlay?.currentRevision?.summary ?? "未记录"} · {formatTime(promptOverlay?.currentRevision?.createdAt)}
        </p>
        <Textarea className="mt-3 min-h-[220px]" value={promptContent} onChange={(event) => setPromptContent(event.target.value)} />
      </div>

      <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--ink)]">项目专属规则补充</p>
            <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
              这里用于补充当前小说专属的写作约束，运行时会自动附加到本次规则组合。
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !skillOverlay}
            onClick={() => {
              setError(null);
              setMessage(null);
              setActiveSaveKey("skill");
              startTransition(async () => {
                try {
                  await saveOverlay(
                    skillOverlay,
                    skillContent,
                    "skill",
                    "保存项目规则补充",
                  );
                } catch (saveError) {
                  setError(saveError instanceof Error ? saveError.message : "保存规则补充失败。");
                }
              });
            }}
          >
            {isPending && activeSaveKey === "skill" ? "保存中" : "保存规则补充"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-ink)]">
          最近版本：{skillOverlay?.currentRevision?.summary ?? "未记录"} · {formatTime(skillOverlay?.currentRevision?.createdAt)}
        </p>
        <Textarea className="mt-3 min-h-[220px]" value={skillContent} onChange={(event) => setSkillContent(event.target.value)} />
      </div>

      {onboardingBrief ? (
        <details className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
          <summary className="cursor-pointer text-sm text-[var(--ink)]">查看初始化摘要快照</summary>
          <p className="mt-2 text-xs text-[var(--muted-ink)]">
            最近版本：{onboardingBrief.currentRevision?.summary ?? "未记录"} · {formatTime(onboardingBrief.currentRevision?.createdAt)}
          </p>
          <pre className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[var(--ink-soft)]">
            {onboardingBrief.currentRevision?.content ?? "暂无初始化摘要。"}
          </pre>
        </details>
      ) : null}

      {error ? <p className="text-sm text-[#9f3a2f]">{error}</p> : null}
      {message ? <p className="text-sm text-[#556d59]">{message}</p> : null}
    </div>
  );
}
