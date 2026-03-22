"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SectionPanel } from "@/components/section-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildProjectExportBundles,
  buildProjectExportDownloadPath,
  normalizeProjectExportRecords,
  type ExportBundleKey,
} from "@/lib/projects/export-bundles";
import type { getWorkbenchSnapshot } from "@/lib/scaffold-data";

type WorkbenchProject = Awaited<ReturnType<typeof getWorkbenchSnapshot>>;
type ResolvedWorkbenchProject = NonNullable<WorkbenchProject>;

function previewText(value: string, limit = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "暂无内容。";
  }

  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function triggerDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.click();
}

function formatExportedAt(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

function formatByteSize(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportCenterPanel({ project }: { project: ResolvedWorkbenchProject }) {
  const router = useRouter();
  const [activeBundleKey, setActiveBundleKey] = useState<ExportBundleKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bundles = useMemo(
    () =>
      buildProjectExportBundles({
        projectName: project.name,
        chapterIndex: project.chapterIndex,
        artifacts: project.artifacts,
        exportedAt: "preview",
      }),
    [project.artifacts, project.chapterIndex, project.name],
  );
  const exportRecords = useMemo(
    () => normalizeProjectExportRecords(project.preference?.exportRecords),
    [project.preference?.exportRecords],
  );

  async function handleExport(bundleKey: ExportBundleKey) {
    setActiveBundleKey(bundleKey);
    setErrorMessage(null);

    try {
      const response = await fetch(`/projects/${project.id}/exports`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ bundleKey }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string }; downloadUrl?: string }
        | null;

      if (!response.ok || !payload?.downloadUrl) {
        throw new Error(payload?.error?.message ?? "导出失败。");
      }

      router.refresh();
      triggerDownload(payload.downloadUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导出失败。");
    } finally {
      setActiveBundleKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <SectionPanel
        title="导出中心"
        description="服务端会打包 Markdown 导出并归档到存储，导出内容聚焦正式正文、设定与状态快照。"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {bundles.map((bundle) => (
            <div key={bundle.key} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
              <p className="text-sm text-[var(--ink)]">{bundle.title}</p>
              <p className="mt-2 text-2xl text-[var(--ink)]">{bundle.fileCount}</p>
              <p className="mt-1 text-sm text-[var(--muted-ink)]">{bundle.description}</p>
            </div>
          ))}
        </div>
      </SectionPanel>

      {errorMessage ? (
        <div className="rounded-[20px] border border-[rgba(151,74,74,0.28)] bg-[rgba(151,74,74,0.08)] p-4 text-sm text-[#8a3f3f]">
          {errorMessage}
        </div>
      ) : null}

      {bundles.map((bundle) => (
        <SectionPanel
          key={bundle.key}
          title={bundle.title}
          description={bundle.description}
          action={<Badge>{bundle.fileCount} 个文件</Badge>}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--ink)]">{bundle.fileName}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
                  {bundle.files.length > 0 ? bundle.files.join(" / ") : "当前没有可导出的文件。"}
                </p>
                <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
                  实际导出文件会额外附带来源摘要与规则追溯附录。
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={bundle.fileCount === 0 || activeBundleKey !== null}
                onClick={() => handleExport(bundle.key)}
              >
                {activeBundleKey === bundle.key ? "导出中..." : "生成导出"}
              </Button>
            </div>

            <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
              <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">预览</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">
                {bundle.fileCount > 0 ? previewText(bundle.content) : "当前还没有形成可导出的正式版本。"}
              </p>
            </div>
          </div>
        </SectionPanel>
      ))}

      <SectionPanel
        title="最近导出"
        description="保留最近 20 次服务端导出，可随时重新下载历史归档。"
        action={<Badge>{exportRecords.length} 条记录</Badge>}
      >
        <div className="space-y-3">
          {exportRecords.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted-ink)]">
              还没有导出记录。生成一次导出后，这里会保留对象存储归档和来源文件清单。
            </div>
          ) : null}

          {exportRecords.map((record) => (
            <div key={record.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--ink)]">{record.title}</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
                    {record.fileName} / {record.fileCount} 个文件 / {formatByteSize(record.byteSize)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => triggerDownload(buildProjectExportDownloadPath(project.id, record.id))}
                >
                  下载归档
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{record.objectStoreMode === "s3" ? "对象存储" : "本地归档"}</Badge>
                <Badge className="bg-[rgba(64,83,102,0.08)] text-[#405366]">{formatExportedAt(record.exportedAt)}</Badge>
              </div>

              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {record.files.length > 0 ? record.files.join(" / ") : "该导出记录没有文件明细。"}
              </p>
            </div>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
