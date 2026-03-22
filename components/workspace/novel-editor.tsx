"use client";

import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EditorLayoutPrefs } from "@/lib/projects/editor-state";

const initialSample = `第一段要留白，第二段给冲突，第三段再抬高收益。

街口的霓虹灯把雨丝切成碎银，周敬安靠在便利店门口，指尖敲着那张被雨汽浸软的传单。纸上写着“金湾码头股权重组说明会”，墨迹却像故意漏掉了最关键的一行。

他知道这不是说明会，这是请君入瓮。`;

type ChapterItem = {
  artifactId: string;
  artifactKey: string;
  filename: string;
  chapterNumber: string;
  title: string;
  status: string;
  wordCount: number;
  updatedAt: string | null;
  currentRevisionContent: string;
};

type AutosaveDraft = {
  id: string;
  artifactId?: string | null;
  updatedAt: string | Date;
  outputContent: string;
} | null;

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

function formatAutosaveLabel(value: Date | string | undefined | null) {
  if (!value) {
    return "未保存";
  }

  return `自动保存于 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`;
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

  return "请求失败。";
}

function buildEditorWidthClass(contentWidth: EditorLayoutPrefs["contentWidth"]) {
  switch (contentWidth) {
    case "narrow":
      return "max-w-3xl";
    case "wide":
      return "max-w-6xl";
    default:
      return "max-w-5xl";
  }
}

export function NovelEditor({
  projectId,
  chapters,
  activeChapterArtifactId,
  autosaveDraft,
  layoutPrefs,
}: {
  projectId: string;
  chapters: ChapterItem[];
  activeChapterArtifactId: string | null;
  autosaveDraft?: AutosaveDraft;
  layoutPrefs: EditorLayoutPrefs;
}) {
  const router = useRouter();
  const initialSelectedChapter =
    chapters.find((chapter) => chapter.artifactId === activeChapterArtifactId) ?? chapters[0] ?? null;
  const initialSelectedAutosaveDraft =
    initialSelectedChapter && autosaveDraft?.artifactId === initialSelectedChapter.artifactId ? autosaveDraft : null;
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedChapterArtifactId, setSelectedChapterArtifactId] = useState<string | null>(
    initialSelectedChapter?.artifactId ?? null,
  );
  const [content, setContent] = useState(
    initialSelectedAutosaveDraft?.outputContent ?? initialSelectedChapter?.currentRevisionContent ?? initialSample,
  );
  const [titleValue, setTitleValue] = useState(initialSelectedChapter?.title ?? "");
  const [saveLabel, setSaveLabel] = useState(
    initialSelectedChapter ? formatAutosaveLabel(initialSelectedAutosaveDraft?.updatedAt) : "请先创建章节",
  );
  const [draftId, setDraftId] = useState(initialSelectedAutosaveDraft?.id ?? null);
  const [lastSavedContent, setLastSavedContent] = useState(
    initialSelectedAutosaveDraft?.outputContent ?? initialSelectedChapter?.currentRevisionContent ?? initialSample,
  );
  const [isPending, startTransition] = useTransition();
  const saveRequestIdRef = useRef(0);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.artifactId === selectedChapterArtifactId) ?? chapters[0] ?? null,
    [chapters, selectedChapterArtifactId],
  );
  const editorTheme = useMemo(() => {
    const fontSize =
      layoutPrefs.fontSize === "small" ? "15px" : layoutPrefs.fontSize === "large" ? "18px" : "16px";
    const lineHeight = layoutPrefs.lineHeight === "comfortable" ? "1.9" : "2.1";

    return EditorView.theme({
      "&": {
        backgroundColor: "transparent",
      },
      ".cm-editor": {
        backgroundColor: "transparent",
      },
      ".cm-scroller": {
        fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", serif',
      },
      ".cm-content": {
        fontSize,
        lineHeight,
        caretColor: "#73543b",
      },
      ".cm-line": {
        paddingLeft: "0.15rem",
      },
      ".cm-focused": {
        outline: "none",
      },
      ".cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "rgba(181, 150, 112, 0.24)",
      },
    });
  }, [layoutPrefs.fontSize, layoutPrefs.lineHeight]);

  useEffect(() => {
    if (!selectedChapter || !layoutPrefs.autosaveEnabled || content === lastSavedContent) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const requestId = ++saveRequestIdRef.current;
      const nextContent = content;
      setSaveLabel("保存中...");

      void fetch(`/api/projects/${projectId}/drafts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          artifactId: selectedChapter.artifactId,
          taskType: "generate_chapter",
          outputContent: nextContent,
          suggestedPatches: [],
          status: "pending",
          draftKind: "editor_autosave",
          runId: null,
        }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | { id: string; updatedAt: string | Date; outputContent: string }
            | { error?: { message?: string } }
            | null;

          if (!response.ok || !payload || typeof payload !== "object" || !("id" in payload)) {
            throw new Error(readErrorMessage(payload));
          }

          if (requestId !== saveRequestIdRef.current) {
            return;
          }

          setDraftId(payload.id);
          setLastSavedContent(nextContent);
          setSaveLabel(formatAutosaveLabel(payload.updatedAt));
        })
        .catch(() => {
          if (requestId !== saveRequestIdRef.current) {
            return;
          }

          setSaveLabel("保存失败");
        });
    }, layoutPrefs.autosaveIntervalMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    content,
    lastSavedContent,
    layoutPrefs.autosaveEnabled,
    layoutPrefs.autosaveIntervalMs,
    projectId,
    selectedChapter,
  ]);

  async function switchChapter(nextArtifactId: string) {
    if (nextArtifactId === selectedChapterArtifactId) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          activeChapterArtifactId: nextArtifactId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown;
        setError(readErrorMessage(payload));
        return;
      }

      const nextChapter = chapters.find((chapter) => chapter.artifactId === nextArtifactId) ?? null;
      const nextContent = nextChapter?.currentRevisionContent ?? "";
      setSelectedChapterArtifactId(nextArtifactId);
      setTitleValue(nextChapter?.title ?? "");
      setContent(nextContent);
      setLastSavedContent(nextContent);
      setDraftId(null);
      setSaveLabel("未保存");
      setMessage("已切换章节。");
      router.refresh();
    });
  }

  async function createChapter() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/artifacts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => null)) as
        | { artifact?: { id?: string } }
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        setError(readErrorMessage(payload));
        return;
      }

      const nextArtifactId =
        payload && typeof payload === "object" && "artifact" in payload && payload.artifact?.id
          ? payload.artifact.id
          : null;

      if (nextArtifactId) {
        setSelectedChapterArtifactId(nextArtifactId);
      }

      setMessage("新章节已创建。");
      router.refresh();
    });
  }

  async function saveChapterTitle() {
    if (!selectedChapter) {
      return;
    }

    const nextTitle = titleValue.trim();

    if (!nextTitle) {
      setError("章节标题不能为空。");
      return;
    }

    if (nextTitle === selectedChapter.title) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/artifacts/${selectedChapter.artifactId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "rename_chapter",
          chapterTitle: nextTitle,
        }),
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setError(readErrorMessage(payload));
        return;
      }

      setMessage("章节标题已保存。");
      router.refresh();
    });
  }

  const wordCount = content.replace(/\s+/g, "").length;
  const isDirty = content !== lastSavedContent;
  const editorWidthClass = buildEditorWidthClass(layoutPrefs.contentWidth);

  return (
    <div className="rounded-[32px] border border-[var(--line)] bg-[rgba(255,250,243,0.92)] p-4 shadow-[0_18px_42px_rgba(78,59,38,0.08)]">
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.64)] p-4">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div>
              <p className="text-xs tracking-[0.24em] text-[var(--muted-ink)] uppercase">章节列表</p>
              <p className="mt-2 text-sm text-[var(--ink)]">{chapters.length} 个章节</p>
            </div>
            <Button type="button" size="sm" onClick={createChapter} disabled={isPending}>
              {isPending ? "处理中" : "新建章节"}
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {chapters.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm leading-7 text-[var(--muted-ink)]">
                当前项目还没有章节。先创建第一个章节，再开始写作或生成续写。
              </div>
            ) : (
              chapters.map((chapter) => (
                <button
                  key={chapter.artifactId}
                  type="button"
                  disabled={isPending}
                  onClick={() => void switchChapter(chapter.artifactId)}
                  className={`w-full rounded-[18px] border px-3 py-3 text-left transition ${
                    chapter.artifactId === selectedChapterArtifactId
                      ? "border-[rgba(115,84,59,0.35)] bg-[rgba(115,84,59,0.08)]"
                      : "border-[var(--line)] bg-[var(--paper)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">
                        {chapter.chapterNumber}
                      </p>
                      <p className="mt-1 truncate text-sm text-[var(--ink)]">{chapter.title}</p>
                    </div>
                    <Badge>{getChapterStatusLabel(chapter.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted-ink)]">
                    {chapter.wordCount} 字 · {chapter.filename}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.7)] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-[0.24em] text-[var(--muted-ink)] uppercase">章节写作区</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  value={titleValue}
                  disabled={!selectedChapter || isPending}
                  onChange={(event) => setTitleValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveChapterTitle();
                    }
                  }}
                  className="max-w-xl"
                  placeholder="输入章节标题"
                />
                <Button type="button" size="sm" variant="secondary" disabled={!selectedChapter || isPending} onClick={() => void saveChapterTitle()}>
                  保存标题
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-ink)]">
              <Badge>{wordCount} 字</Badge>
              <Badge>{draftId ? "草稿已接管" : "正式稿"}</Badge>
              <span>{isDirty && saveLabel !== "保存中..." ? "未保存" : saveLabel}</span>
            </div>
          </div>

          <div className={`${editorWidthClass} mx-auto`}>
            {selectedChapter ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted-ink)]">
                  <span>
                    当前章节：{selectedChapter.chapterNumber} · {selectedChapter.title}
                  </span>
                  <span>
                    自动保存 {layoutPrefs.autosaveEnabled ? `开启 / ${layoutPrefs.autosaveIntervalMs}ms` : "关闭"}
                  </span>
                </div>
                <div className="novel-editor">
                  <CodeMirror
                    value={content}
                    height="auto"
                    extensions={[markdown(), EditorView.lineWrapping, editorTheme]}
                    onChange={setContent}
                    basicSetup={{
                      lineNumbers: false,
                      foldGutter: false,
                      highlightActiveLine: false,
                      highlightActiveLineGutter: false,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-6 text-sm leading-7 text-[var(--muted-ink)]">
                还没有可编辑的章节。创建章节后，这里会按章节加载自动保存草稿或正式版本。
              </div>
            )}
          </div>

          {error ? <p className="mt-4 text-sm text-[#9f3a2f]">{error}</p> : null}
          {message ? <p className="mt-4 text-sm text-[#556d59]">{message}</p> : null}
        </section>
      </div>
    </div>
  );
}
