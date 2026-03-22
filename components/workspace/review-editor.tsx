"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDraftStatusLabel } from "@/lib/tasks/catalog";
import { parseReviewDraft } from "@/lib/review/parser";
import { cn } from "@/lib/utils";

type ActiveChapter = {
  artifactId: string;
  chapterNumber: string;
  title: string;
  status: string;
  wordCount: number;
  updatedAt: string | null;
};

type ReviewDraft = {
  id: string;
  artifactId?: string | null;
  taskType: string;
  outputContent: string;
  suggestedPatches: unknown;
  status: string;
  draftKind: string;
  updatedAt: string | Date;
  run?: {
    id: string;
    resolvedContextArtifacts: unknown;
  } | null;
};

function getChapterStatusLabel(status: string) {
  switch (status) {
    case "accepted":
      return "已定稿";
    case "reviewing":
      return "审阅中";
    default:
      return "草稿中";
  }
}

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

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败。";
}

function buildDefaultReviewInstruction(activeChapter: ActiveChapter | null) {
  return activeChapter
    ? `请审查 ${activeChapter.chapterNumber}《${activeChapter.title}》，按“问题 -> 证据 -> 最小修法”输出。`
    : "请先选择章节。";
}

function buildDefaultMinimalFixInstruction(activeChapter: ActiveChapter | null) {
  return activeChapter
    ? `请严格根据最新审稿意见，对 ${activeChapter.chapterNumber}《${activeChapter.title}》做最小修法，只输出修改后的正文与修改摘要。`
    : "请先选择章节。";
}

function splitSourceParagraphs(sourceContent: string) {
  const normalized = sourceContent.trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).filter((paragraph) => paragraph.trim());
  let searchStart = 0;

  return paragraphs.map((paragraph) => {
    const start = normalized.indexOf(paragraph, searchStart);
    const safeStart = start >= 0 ? start : searchStart;
    const end = safeStart + paragraph.length;
    searchStart = end;

    return {
      text: paragraph,
      start: safeStart,
      end,
    };
  });
}

export function ReviewEditor({
  activeChapter,
  sourceContent,
  usesAutosaveSource,
  reviewDraft,
  minimalFixDraft,
  onGenerateReview,
  onGenerateMinimalFix,
  onAcceptDraft,
  onRejectDraft,
}: {
  activeChapter: ActiveChapter | null;
  sourceContent: string;
  usesAutosaveSource: boolean;
  reviewDraft: ReviewDraft | null;
  minimalFixDraft: ReviewDraft | null;
  onGenerateReview: (instruction: string) => Promise<void>;
  onGenerateMinimalFix: (instruction: string, reviewContext?: string) => Promise<void>;
  onAcceptDraft: (draft: ReviewDraft) => Promise<void>;
  onRejectDraft: (draft: ReviewDraft) => Promise<void>;
}) {
  const [reviewInstruction, setReviewInstruction] = useState(buildDefaultReviewInstruction(activeChapter));
  const [minimalFixInstruction, setMinimalFixInstruction] = useState(buildDefaultMinimalFixInstruction(activeChapter));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sourceParagraphRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  const canGenerateReview = Boolean(activeChapter && sourceContent.trim());
  const canGenerateFix = Boolean(activeChapter && reviewDraft);
  const parsedReviewItems = useMemo(
    () => parseReviewDraft(reviewDraft?.outputContent ?? "", sourceContent),
    [reviewDraft?.outputContent, sourceContent],
  );
  const sourceParagraphs = useMemo(() => splitSourceParagraphs(sourceContent), [sourceContent]);
  const focusedReviewItem = useMemo(
    () => parsedReviewItems.find((item) => item.id === focusedIssueId) ?? parsedReviewItems[0] ?? null,
    [focusedIssueId, parsedReviewItems],
  );
  const focusedParagraphIndex = useMemo(() => {
    if (!focusedReviewItem?.sourceMatch) {
      return -1;
    }

    return sourceParagraphs.findIndex(
      (paragraph) =>
        paragraph.end > focusedReviewItem.sourceMatch!.start && paragraph.start < focusedReviewItem.sourceMatch!.end,
    );
  }, [focusedReviewItem, sourceParagraphs]);

  useEffect(() => {
    setReviewInstruction(buildDefaultReviewInstruction(activeChapter));
    setMinimalFixInstruction(buildDefaultMinimalFixInstruction(activeChapter));
  }, [activeChapter]);

  useEffect(() => {
    setFocusedIssueId(parsedReviewItems[0]?.id ?? null);
  }, [parsedReviewItems]);

  useEffect(() => {
    if (focusedParagraphIndex < 0) {
      return;
    }

    sourceParagraphRefs.current[focusedParagraphIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [focusedParagraphIndex]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.56)] p-4">
        <div>
          <p className="text-xs tracking-[0.22em] text-[var(--muted-ink)] uppercase">审阅工作台</p>
          {activeChapter ? (
            <p className="mt-2 text-sm text-[var(--ink)]">
              {activeChapter.chapterNumber}《{activeChapter.title}》
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted-ink)]">当前没有可审阅的章节。</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-ink)]">
          {activeChapter ? <Badge>{getChapterStatusLabel(activeChapter.status)}</Badge> : null}
          {activeChapter ? <Badge>{activeChapter.wordCount} 字</Badge> : null}
          {usesAutosaveSource ? <Badge>基于自动保存草稿</Badge> : <Badge>基于正式版本</Badge>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-medium text-[var(--ink)]">原文区</p>
            {activeChapter ? <span className="text-xs text-[var(--muted-ink)]">{formatTime(activeChapter.updatedAt)}</span> : null}
          </div>
          {focusedReviewItem?.sourceMatch ? (
            <div className="mb-3 rounded-[16px] border border-[rgba(181,150,112,0.32)] bg-[rgba(181,150,112,0.14)] px-3 py-2 text-xs leading-6 text-[var(--muted-ink)]">
              已定位到与当前问题最接近的原文段落。
            </div>
          ) : null}
          <div className="space-y-3">
            {sourceParagraphs.length > 0 ? (
              sourceParagraphs.map((paragraph, index) => {
                const isFocused = index === focusedParagraphIndex;

                return (
                  <p
                    key={`${paragraph.start}-${paragraph.end}`}
                    ref={(node) => {
                      sourceParagraphRefs.current[index] = node;
                    }}
                    className={cn(
                      "whitespace-pre-wrap rounded-[18px] px-3 py-2 text-sm leading-7 text-[var(--ink-soft)] transition-colors",
                      isFocused ? "bg-[rgba(181,150,112,0.18)] ring-1 ring-[rgba(181,150,112,0.42)]" : "",
                    )}
                  >
                    {paragraph.text}
                  </p>
                );
              })
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">当前章节还没有可审阅内容。</p>
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-medium text-[var(--ink)]">审稿意见区</p>
            {reviewDraft ? <Badge>{getDraftStatusLabel(reviewDraft.status)}</Badge> : null}
          </div>
          <Textarea value={reviewInstruction} onChange={(event) => setReviewInstruction(event.target.value)} className="min-h-28" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !canGenerateReview || !reviewInstruction.trim()}
              onClick={() => {
                setError(null);
                setMessage(null);
                setPendingAction("generate-review");
                startTransition(async () => {
                  try {
                    await onGenerateReview(reviewInstruction);
                    setMessage("审稿草稿已生成。");
                  } catch (actionError) {
                    setError(readErrorMessage(actionError));
                  } finally {
                    setPendingAction(null);
                  }
                });
              }}
            >
              {pendingAction === "generate-review" ? "生成中" : "生成审稿"}
            </Button>
            {reviewDraft?.status === "ready" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setPendingAction(`accept-${reviewDraft.id}`);
                  startTransition(async () => {
                    try {
                      await onAcceptDraft(reviewDraft);
                      setMessage("审稿记录已接受。");
                    } catch (actionError) {
                      setError(readErrorMessage(actionError));
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                {pendingAction === `accept-${reviewDraft.id}` ? "处理中" : "接受审稿"}
              </Button>
            ) : null}
            {reviewDraft?.status === "ready" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setPendingAction(`reject-${reviewDraft.id}`);
                  startTransition(async () => {
                    try {
                      await onRejectDraft(reviewDraft);
                      setMessage("审稿草稿已放弃。");
                    } catch (actionError) {
                      setError(readErrorMessage(actionError));
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                {pendingAction === `reject-${reviewDraft.id}` ? "处理中" : "放弃审稿"}
              </Button>
            ) : null}
          </div>
          {parsedReviewItems.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">问题列表</p>
              {parsedReviewItems.map((item, index) => {
                const actionKey = `single-fix-${item.id}`;
                const isFocused = item.id === focusedReviewItem?.id;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-3",
                      isFocused ? "ring-1 ring-[rgba(181,150,112,0.42)]" : "",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[var(--ink)]">问题 {index + 1}</p>
                      {item.sourceMatch ? <Badge>可定位原文</Badge> : <Badge>未命中原文</Badge>}
                    </div>
                    <div className="mt-3 space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
                      <p><span className="font-medium text-[var(--ink)]">问题：</span>{item.issue || "未提取"}</p>
                      <p><span className="font-medium text-[var(--ink)]">证据：</span>{item.evidence || "未提取"}</p>
                      <p><span className="font-medium text-[var(--ink)]">最小修法：</span>{item.minimalFix || "未提取"}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!item.sourceMatch}
                        onClick={() => {
                          setFocusedIssueId(item.id);
                          setMessage(item.sourceMatch ? "已定位到对应原文段落。" : "当前证据还无法定位到原文。");
                          setError(null);
                        }}
                      >
                        定位原文
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isPending || !activeChapter}
                        onClick={() => {
                          setError(null);
                          setMessage(null);
                          setFocusedIssueId(item.id);
                          setPendingAction(actionKey);
                          startTransition(async () => {
                            try {
                              await onGenerateMinimalFix(
                                [
                                  minimalFixInstruction.trim(),
                                  "",
                                  "本次只处理以下单条审稿项，不要扩散到其他问题。",
                                ]
                                  .join("\n")
                                  .trim(),
                                item.rawBlock,
                              );
                              setMessage("已基于这条修法生成草稿。");
                            } catch (actionError) {
                              setError(readErrorMessage(actionError));
                            } finally {
                              setPendingAction(null);
                            }
                          });
                        }}
                      >
                        {pendingAction === actionKey ? "生成中" : "采纳这条修法"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              <details className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.44)] p-3">
                <summary className="cursor-pointer text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">
                  查看原始审稿草稿
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">
                  {reviewDraft?.outputContent || "还没有审稿结果。"}
                </p>
              </details>
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-3">
              <p className="mb-2 text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">最新审稿草稿</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">
                {reviewDraft?.outputContent || "还没有审稿结果。"}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[22px] border border-[var(--line)] bg-[var(--paper)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-medium text-[var(--ink)]">最小修法区</p>
            {minimalFixDraft ? <Badge>{getDraftStatusLabel(minimalFixDraft.status)}</Badge> : null}
          </div>
          <Textarea
            value={minimalFixInstruction}
            onChange={(event) => setMinimalFixInstruction(event.target.value)}
            className="min-h-28"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !canGenerateFix || !minimalFixInstruction.trim()}
              onClick={() => {
                setError(null);
                setMessage(null);
                setPendingAction("generate-fix");
                startTransition(async () => {
                  try {
                    await onGenerateMinimalFix(minimalFixInstruction);
                    setMessage("最小修法草稿已生成。");
                  } catch (actionError) {
                    setError(readErrorMessage(actionError));
                  } finally {
                    setPendingAction(null);
                  }
                });
              }}
            >
              {pendingAction === "generate-fix" ? "生成中" : "生成最小修法"}
            </Button>
            {minimalFixDraft?.status === "ready" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setPendingAction(`accept-${minimalFixDraft.id}`);
                  startTransition(async () => {
                    try {
                      await onAcceptDraft(minimalFixDraft);
                      setMessage("改稿草稿已接受并回填。");
                    } catch (actionError) {
                      setError(readErrorMessage(actionError));
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                {pendingAction === `accept-${minimalFixDraft.id}` ? "处理中" : "接受改稿"}
              </Button>
            ) : null}
            {minimalFixDraft?.status === "ready" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setPendingAction(`reject-${minimalFixDraft.id}`);
                  startTransition(async () => {
                    try {
                      await onRejectDraft(minimalFixDraft);
                      setMessage("改稿草稿已放弃。");
                    } catch (actionError) {
                      setError(readErrorMessage(actionError));
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                {pendingAction === `reject-${minimalFixDraft.id}` ? "处理中" : "放弃改稿"}
              </Button>
            ) : null}
          </div>
          <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-3">
            <p className="mb-2 text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">最新最小修法草稿</p>
            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">
              {minimalFixDraft?.outputContent || "还没有最小修法结果。"}
            </p>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-[#9f3a2f]">{error}</p> : null}
      {message ? <p className="text-sm text-[#556d59]">{message}</p> : null}
    </div>
  );
}
