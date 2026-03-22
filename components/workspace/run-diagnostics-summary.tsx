"use client";

import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  extractSourceDetailItems,
  getExternalSearchStatusLabel,
  getGrokConfigSourceLabel,
  getPromptTemplateSourceLabel,
  getRunFailureHint,
  parseRunDiagnostics,
  type SourceDetailItem,
} from "@/lib/runs/diagnostics";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function previewText(value: string | null | undefined, limit = 160) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "暂无摘要。";
  }

  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function shortenSessionId(value: string | null | undefined) {
  if (!value) {
    return "未返回";
  }

  return value.length > 16 ? `${value.slice(0, 16)}...` : value;
}

function readGrokSourcesError(payload: unknown) {
  if (isRecord(payload)) {
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }

    if (isRecord(payload.error) && typeof payload.error.message === "string" && payload.error.message.trim()) {
      return payload.error.message.trim();
    }
  }

  return "来源明细拉取失败。";
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function RunDiagnosticsSummary({
  projectId,
  toolCallsSummary,
  errorSummary,
  compact = false,
}: {
  projectId?: string;
  toolCallsSummary: unknown;
  errorSummary?: string | null;
  compact?: boolean;
}) {
  const diagnostics = useMemo(() => parseRunDiagnostics(toolCallsSummary), [toolCallsSummary]);
  const failureHint = getRunFailureHint(errorSummary);
  const sessionId = diagnostics.externalSearch?.sessionId ?? null;
  const [sourceItems, setSourceItems] = useState<SourceDetailItem[]>([]);
  const [sourceRaw, setSourceRaw] = useState<unknown>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isCurrentSessionLoaded = loadedSessionId === sessionId;
  const visibleSourceItems = isCurrentSessionLoaded ? sourceItems : [];
  const visibleSourceRaw = isCurrentSessionLoaded ? sourceRaw : null;
  const visibleSourceError = isCurrentSessionLoaded ? sourceError : null;
  const hasAnyDiagnostics =
    Boolean(errorSummary) ||
    Boolean(diagnostics.mcp) ||
    Boolean(diagnostics.externalSearch) ||
    Boolean(diagnostics.externalPromptTemplate);

  if (!hasAnyDiagnostics) {
    return null;
  }

  async function loadSourceDetails(downloadAfterLoad = false) {
    if (!projectId || !sessionId) {
      return;
    }

    setSourceError(null);

    const response = await fetch(`/api/projects/${projectId}/search/grok`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        toolName: "get_sources",
        payload: {
          session_id: sessionId,
        },
      }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(readGrokSourcesError(payload));
    }

    const rawData = isRecord(payload) ? payload.data ?? payload : payload;
    const items = extractSourceDetailItems(rawData);

    setSourceItems(items);
    setSourceRaw(rawData);
    setLoadedSessionId(sessionId);

    if (downloadAfterLoad) {
      downloadJson(`grok-sources-${sessionId.slice(0, 12)}.json`, rawData);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {diagnostics.externalSearch ? (
          <Badge className="bg-[rgba(64,83,102,0.08)] text-[#405366]">
            {`GrokSearch · ${getExternalSearchStatusLabel(diagnostics.externalSearch.status)}`}
          </Badge>
        ) : null}
        {diagnostics.externalSearch?.sourcesCount ? (
          <Badge className="bg-[rgba(85,109,89,0.12)] text-[#556d59]">
            {`来源 ${diagnostics.externalSearch.sourcesCount} 条`}
          </Badge>
        ) : null}
        {diagnostics.mcp ? (
          <Badge className="bg-[rgba(85,109,89,0.12)] text-[#556d59]">
            {`MCP ${diagnostics.mcp.serverCount} 服务 / ${diagnostics.mcp.toolInventoryCount} 工具 / ${diagnostics.mcp.callCount} 次调用`}
          </Badge>
        ) : null}
        {diagnostics.externalPromptTemplate ? (
          <Badge className="bg-[rgba(191,152,69,0.10)] text-[#7f5f1d]">
            {`外部模板 · ${diagnostics.externalPromptTemplate.serverName ?? "未命名来源"}`}
          </Badge>
        ) : null}
        {errorSummary ? (
          <Badge className="bg-[rgba(159,58,47,0.08)] text-[#9f3a2f]">运行失败</Badge>
        ) : null}
      </div>

      <details className="rounded-[18px] border border-[var(--line)] bg-[var(--paper)] p-3">
        <summary className="cursor-pointer text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">
          {compact ? "查看运行诊断" : "展开运行诊断"}
        </summary>

        <div className="mt-3 space-y-3">
          {errorSummary ? (
            <div className="rounded-[16px] border border-[rgba(159,58,47,0.16)] bg-[rgba(159,58,47,0.05)] p-3">
              <p className="text-xs tracking-[0.14em] text-[#9f3a2f] uppercase">失败原因</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{previewText(errorSummary, compact ? 160 : 260)}</p>
              {failureHint ? (
                <p className="mt-2 text-xs leading-6 text-[#9f3a2f]">处理建议：{failureHint}</p>
              ) : null}
            </div>
          ) : null}

          {diagnostics.externalSearch ? (
            <div className="rounded-[16px] border border-[var(--line)] p-3">
              <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">外部事实补充</p>
              <div className="mt-2 space-y-1 text-sm leading-6 text-[var(--ink-soft)]">
                <p>状态：{getExternalSearchStatusLabel(diagnostics.externalSearch.status)}</p>
                <p>配置来源：{getGrokConfigSourceLabel(diagnostics.externalSearch.configSource)}</p>
                <p>调用工具：{diagnostics.externalSearch.toolName ?? "未记录"}</p>
                <p>重试次数：{diagnostics.externalSearch.attemptCount ?? 0}</p>
                <p>来源数量：{diagnostics.externalSearch.sourcesCount ?? "未返回"}</p>
                <p>检索会话：{shortenSessionId(sessionId)}</p>
                {diagnostics.externalSearch.taskType ? <p>任务类型：{diagnostics.externalSearch.taskType}</p> : null}
                {diagnostics.externalSearch.query ? (
                  <p>检索问题：{previewText(diagnostics.externalSearch.query, compact ? 100 : 160)}</p>
                ) : null}
                {diagnostics.externalSearch.contentPreview ? (
                  <p>结果摘要：{previewText(diagnostics.externalSearch.contentPreview, compact ? 120 : 220)}</p>
                ) : null}
              </div>

              {projectId && sessionId ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await loadSourceDetails(false);
                          } catch (error) {
                            setSourceError(error instanceof Error ? error.message : "来源明细拉取失败。");
                          }
                        })
                      }
                    >
                      {isPending ? "加载中" : isCurrentSessionLoaded ? "刷新来源明细" : "查看来源明细"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            if (isCurrentSessionLoaded && visibleSourceRaw) {
                              downloadJson(`grok-sources-${sessionId.slice(0, 12)}.json`, visibleSourceRaw);
                              return;
                            }

                            await loadSourceDetails(true);
                          } catch (error) {
                            setSourceError(error instanceof Error ? error.message : "来源下载失败。");
                          }
                        })
                      }
                    >
                      下载来源 JSON
                    </Button>
                  </div>

                  {visibleSourceError ? <p className="text-xs leading-6 text-[#9f3a2f]">{visibleSourceError}</p> : null}

                  {isCurrentSessionLoaded && visibleSourceItems.length > 0 ? (
                    <div className="rounded-[16px] border border-[var(--line)] bg-[rgba(255,255,255,0.55)] p-3">
                      <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">
                        来源明细
                        {" "}
                        {visibleSourceItems.length} 条
                      </p>
                      <div className="mt-3 space-y-3">
                        {visibleSourceItems.map((item, index) => (
                          <div key={`${item.title ?? "untitled"}-${item.url ?? "no-url"}-${index}`} className="rounded-[14px] border border-[var(--line)] p-3">
                            <p className="text-sm text-[var(--ink)]">{item.title ?? `来源 ${index + 1}`}</p>
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 block break-all text-xs leading-6 text-[#405366] underline"
                              >
                                {item.url}
                              </a>
                            ) : null}
                            {item.snippet ? (
                              <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                                {previewText(item.snippet, compact ? 120 : 220)}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {isCurrentSessionLoaded && visibleSourceItems.length === 0 && visibleSourceRaw ? (
                    <details className="rounded-[16px] border border-[var(--line)] bg-[rgba(255,255,255,0.55)] p-3">
                      <summary className="cursor-pointer text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">
                        查看原始来源 JSON
                      </summary>
                      <pre className="mt-3 whitespace-pre-wrap break-all text-xs leading-6 text-[var(--ink-soft)]">
                        {JSON.stringify(visibleSourceRaw, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {diagnostics.mcp ? (
            <div className="rounded-[16px] border border-[var(--line)] p-3">
              <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">MCP 工具调用</p>
              <div className="mt-2 space-y-1 text-sm leading-6 text-[var(--ink-soft)]">
                <p>接入服务：{diagnostics.mcp.serverNames.length > 0 ? diagnostics.mcp.serverNames.join(" / ") : "未记录"}</p>
                <p>工具库存：{diagnostics.mcp.toolInventoryCount} 个</p>
                <p>实际调用：{diagnostics.mcp.callCount} 次</p>
                {diagnostics.mcp.calledTools.length > 0 ? (
                  <p>调用工具：{previewText(diagnostics.mcp.calledTools.join(" / "), compact ? 120 : 220)}</p>
                ) : (
                  <p>调用工具：本次没有实际触发 MCP 工具。</p>
                )}
              </div>
            </div>
          ) : null}

          {diagnostics.externalPromptTemplate ? (
            <div className="rounded-[16px] border border-[var(--line)] p-3">
              <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">外部提示模板</p>
              <div className="mt-2 space-y-1 text-sm leading-6 text-[var(--ink-soft)]">
                <p>来源类型：{getPromptTemplateSourceLabel(diagnostics.externalPromptTemplate.source)}</p>
                <p>
                  模板来源：
                  {" "}
                  {[diagnostics.externalPromptTemplate.serverName, diagnostics.externalPromptTemplate.promptName]
                    .filter(Boolean)
                    .join(" / ") || "未记录"}
                </p>
                {diagnostics.externalPromptTemplate.preview ? (
                  <p>模板摘要：{previewText(diagnostics.externalPromptTemplate.preview, compact ? 120 : 220)}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
