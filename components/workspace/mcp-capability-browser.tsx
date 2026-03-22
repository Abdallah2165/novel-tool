"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMcpTransportTypeLabel } from "@/lib/integrations/display-labels";
import { getHealthStatusLabel } from "@/lib/integrations/health-status";

type McpServerItem = {
  id: string;
  name: string;
  transportType: string;
  serverUrl: string;
  authMode: string;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  healthStatus: string;
  lastSyncAt?: string | Date | null;
  updatedAt: string | Date;
};

export type AppliedMcpPromptTemplate = {
  source: "mcp_prompt";
  serverId: string;
  serverName: string;
  promptName: string;
  content: string;
};

type SnapshotResource = {
  uri: string;
  name?: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
};

type SnapshotPrompt = {
  name: string;
  title?: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
};

type CapabilitiesSnapshot = {
  resources: SnapshotResource[];
  prompts: SnapshotPrompt[];
  resourceTemplates: Array<{
    uriTemplate: string;
    name?: string;
    title?: string;
    description?: string;
    mimeType?: string;
  }>;
};

type ResourcePreviewPayload = {
  contents: Array<{
    uri: string;
    name: string | null;
    title: string | null;
    mimeType: string | null;
    kind: "text" | "binary";
    text: string | null;
  }>;
  combinedText: string;
  primaryMimeType: string | null;
  hasBinaryContent: boolean;
};

type PromptPreviewPayload = {
  description: string | null;
  messages: Array<{
    role: "user" | "assistant";
    preview: string;
  }>;
  compiledText: string;
};

type McpCapabilityBrowserProps = {
  projectId: string;
  servers: McpServerItem[];
  selectedServerIds: string[];
  onToggleServer: (serverId: string) => void;
  appliedPromptTemplate: AppliedMcpPromptTemplate | null;
  onApplyPromptTemplate: (template: AppliedMcpPromptTemplate) => void;
  disabled?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readErrorMessage(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return "请求失败。";
}

function normalizeSnapshot(snapshot: unknown): CapabilitiesSnapshot {
  if (!isRecord(snapshot)) {
    return {
      resources: [],
      prompts: [],
      resourceTemplates: [],
    };
  }

  const resources = Array.isArray(snapshot.resources)
    ? snapshot.resources.filter(
        (item): item is SnapshotResource => isRecord(item) && typeof item.uri === "string",
      )
    : [];
  const prompts = Array.isArray(snapshot.prompts)
    ? snapshot.prompts.filter(
        (item): item is SnapshotPrompt => isRecord(item) && typeof item.name === "string",
      )
    : [];
  const resourceTemplates = Array.isArray(snapshot.resourceTemplates)
    ? snapshot.resourceTemplates.filter(
        (item): item is CapabilitiesSnapshot["resourceTemplates"][number] =>
          isRecord(item) && typeof item.uriTemplate === "string",
      )
    : [];

  return {
    resources,
    prompts,
    resourceTemplates,
  };
}

function guessFilename(resource: SnapshotResource, mimeType: string | null) {
  const fallback = resource.name || resource.title || resource.uri.split("/").pop() || "mcp-resource";
  const sanitizedBase = fallback
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = sanitizedBase || "mcp-resource";
  const hasExtension = /\.[a-z0-9]{1,10}$/i.test(base);

  if (hasExtension) {
    return base;
  }

  if ((mimeType || resource.mimeType || "").includes("markdown")) {
    return `${base}.md`;
  }

  return `${base}.txt`;
}

function resolveReferenceSourceType(mimeType: string | null, filename: string) {
  if ((mimeType || "").includes("markdown") || /\.md$/i.test(filename)) {
    return "markdown";
  }

  return "txt";
}

async function fetchJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload;
}

export function McpCapabilityBrowser({
  projectId,
  servers,
  selectedServerIds,
  onToggleServer,
  appliedPromptTemplate,
  onApplyPromptTemplate,
  disabled = false,
}: McpCapabilityBrowserProps) {
  const router = useRouter();
  const [openServerIds, setOpenServerIds] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, CapabilitiesSnapshot>>({});
  const [resourcePreviews, setResourcePreviews] = useState<Record<string, ResourcePreviewPayload>>({});
  const [promptPreviews, setPromptPreviews] = useState<Record<string, PromptPreviewPayload>>({});
  const [promptArgs, setPromptArgs] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function toggleOpen(serverId: string) {
    setOpenServerIds((current) =>
      current.includes(serverId) ? current.filter((item) => item !== serverId) : [...current, serverId],
    );
  }

  function ensureOpen(serverId: string) {
    setOpenServerIds((current) => (current.includes(serverId) ? current : [...current, serverId]));
  }

  async function loadSnapshot(serverId: string) {
    const payload = (await fetchJson(`/api/mcp-servers/${serverId}/capabilities`)) as {
      capabilitiesSnapshot?: unknown;
    };

    setSnapshots((current) => ({
      ...current,
      [serverId]: normalizeSnapshot(payload.capabilitiesSnapshot),
    }));
  }

  async function syncSnapshot(serverId: string) {
    await fetchJson(`/api/mcp-servers/${serverId}/health`, {
      method: "POST",
    });
    await loadSnapshot(serverId);
    router.refresh();
  }

  function parsePromptArgs(raw: string) {
    if (!raw.trim()) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("模板参数必须是合法 JSON。");
    }

    if (!isRecord(parsed)) {
      throw new Error("模板参数必须是 JSON 对象。");
    }

    return parsed;
  }

  async function previewResource(serverId: string, uri: string) {
    const payload = (await fetchJson(`/api/mcp-servers/${serverId}/capabilities`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "read_resource",
        uri,
      }),
    })) as ResourcePreviewPayload;

    setResourcePreviews((current) => ({
      ...current,
      [`${serverId}:${uri}`]: payload,
    }));

    return payload;
  }

  async function previewPrompt(server: McpServerItem, prompt: SnapshotPrompt) {
    const rawArgs = promptArgs[`${server.id}:${prompt.name}`] ?? "";
    const payload = (await fetchJson(`/api/mcp-servers/${server.id}/capabilities`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "get_prompt",
        name: prompt.name,
        arguments: parsePromptArgs(rawArgs),
      }),
    })) as PromptPreviewPayload;

    setPromptPreviews((current) => ({
      ...current,
      [`${server.id}:${prompt.name}`]: payload,
    }));

    return payload;
  }

  async function importResource(server: McpServerItem, resource: SnapshotResource) {
    const preview = await previewResource(server.id, resource.uri);

    if (!preview.combinedText.trim()) {
      throw new Error("该 MCP resource 当前没有可导入的文本内容。");
    }

    const filename = guessFilename(resource, preview.primaryMimeType);
    await fetchJson(`/api/projects/${projectId}/references`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        filename,
        sourceType: resolveReferenceSourceType(preview.primaryMimeType, filename),
        mimeType: preview.primaryMimeType ?? resource.mimeType ?? "text/plain",
        sourceUrl: resource.uri.startsWith("http://") || resource.uri.startsWith("https://") ? resource.uri : undefined,
        extractionMethod: `mcp_resource_import:${server.name}`,
        extractedText: preview.combinedText,
        normalizedText: preview.combinedText,
        tags: [`mcp:${server.name}`, "mcp-resource"],
      }),
    });

    setMessage(`已把 ${resource.title || resource.name || resource.uri} 导入到资料区。`);
    router.refresh();
  }

  async function applyPrompt(server: McpServerItem, prompt: SnapshotPrompt) {
    const preview = await previewPrompt(server, prompt);

    if (!preview.compiledText.trim()) {
      throw new Error("该 MCP prompt 当前没有可用文本。");
    }

    onApplyPromptTemplate({
      source: "mcp_prompt",
      serverId: server.id,
      serverName: server.name,
      promptName: prompt.name,
      content: preview.compiledText,
    });

    setMessage(`已应用外部提示模板 ${server.name} / ${prompt.name}。`);
  }

  return (
    <div className="space-y-3">
      {servers.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted-ink)]">
          还没有可用 MCP server。先去设置页添加并做健康检查。
        </div>
      ) : null}

      {servers.map((server) => {
        const isOpen = openServerIds.includes(server.id);
        const snapshot = snapshots[server.id];

        return (
          <div key={server.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[var(--ink)]">{server.name}</p>
                <p className="mt-1 text-xs text-[var(--muted-ink)]">
                  {getMcpTransportTypeLabel(server.transportType)} · {server.toolCount} 个工具 · {server.resourceCount} 份资料 · {server.promptCount} 个模板
                </p>
                <p className="mt-1 text-xs text-[var(--muted-ink)]">状态：{getHealthStatusLabel(server.healthStatus)}</p>
              </div>
              <input
                type="checkbox"
                checked={selectedServerIds.includes(server.id)}
                onChange={() => onToggleServer(server.id)}
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled || busyKey === `sync:${server.id}`}
                onClick={async () => {
                  setError(null);
                  setMessage(null);
                  setBusyKey(`sync:${server.id}`);
                  try {
                    await syncSnapshot(server.id);
                    ensureOpen(server.id);
                    setMessage(`已同步 ${server.name} 的能力快照。`);
                  } catch (actionError) {
                    setError(actionError instanceof Error ? actionError.message : "同步 MCP 能力快照失败。");
                  } finally {
                    setBusyKey(null);
                  }
                }}
              >
                {busyKey === `sync:${server.id}` ? "同步中" : "同步快照"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled || busyKey === `load:${server.id}`}
                onClick={async () => {
                  setError(null);
                  setMessage(null);
                  setBusyKey(`load:${server.id}`);
                  try {
                    if (!snapshot) {
                      await loadSnapshot(server.id);
                    }
                    toggleOpen(server.id);
                  } catch (actionError) {
                    setError(actionError instanceof Error ? actionError.message : "读取 MCP 能力快照失败。");
                  } finally {
                    setBusyKey(null);
                  }
                }}
              >
                {isOpen ? "收起详情" : "查看详情"}
              </Button>
            </div>

            {isOpen ? (
              <div className="mt-4 space-y-4 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.54)] p-3">
                {!snapshot ? (
                  <p className="text-xs leading-6 text-[var(--muted-ink)]">
                    当前还没有能力快照。先执行一次“同步快照”。
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">资料资源</p>
                        <Badge>{snapshot.resources.length}</Badge>
                      </div>
                      {snapshot.resources.length === 0 ? (
                        <p className="text-xs leading-6 text-[var(--muted-ink)]">该服务当前没有可浏览的资料资源。</p>
                      ) : null}
                      {snapshot.resources.map((resource) => {
                        const preview = resourcePreviews[`${server.id}:${resource.uri}`];

                        return (
                          <div key={resource.uri} className="rounded-[16px] border border-[var(--line)] bg-[var(--paper)] p-3">
                            <p className="truncate text-sm text-[var(--ink)]">{resource.title || resource.name || resource.uri}</p>
                            <p className="mt-1 text-xs text-[var(--muted-ink)]">{resource.mimeType || "unknown"} · {resource.uri}</p>
                            {resource.description ? (
                              <p className="mt-2 text-xs leading-6 text-[var(--muted-ink)]">{resource.description}</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={disabled || busyKey === `resource-preview:${server.id}:${resource.uri}`}
                                onClick={async () => {
                                  setError(null);
                                  setMessage(null);
                                  setBusyKey(`resource-preview:${server.id}:${resource.uri}`);
                                  try {
                                    await previewResource(server.id, resource.uri);
                                  } catch (actionError) {
                                    setError(actionError instanceof Error ? actionError.message : "读取 MCP 资料失败。");
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                              >
                                {busyKey === `resource-preview:${server.id}:${resource.uri}` ? "读取中" : "预览"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={disabled || busyKey === `resource-import:${server.id}:${resource.uri}`}
                                onClick={async () => {
                                  setError(null);
                                  setMessage(null);
                                  setBusyKey(`resource-import:${server.id}:${resource.uri}`);
                                  try {
                                    await importResource(server, resource);
                                  } catch (actionError) {
                                    setError(actionError instanceof Error ? actionError.message : "导入 MCP 资料失败。");
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                              >
                                {busyKey === `resource-import:${server.id}:${resource.uri}` ? "导入中" : "导入资料区"}
                              </Button>
                            </div>
                            {preview ? (
                              <pre className="mt-3 whitespace-pre-wrap rounded-[12px] border border-[var(--line)] bg-[rgba(255,248,238,0.72)] p-3 text-xs leading-6 text-[var(--ink-soft)]">
                                {preview.combinedText || "暂无文本内容。"}
                              </pre>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">外部提示模板</p>
                        <Badge>{snapshot.prompts.length}</Badge>
                      </div>
                      {snapshot.prompts.length === 0 ? (
                        <p className="text-xs leading-6 text-[var(--muted-ink)]">该服务当前没有可浏览的提示模板。</p>
                      ) : null}
                      {snapshot.prompts.map((prompt) => {
                        const preview = promptPreviews[`${server.id}:${prompt.name}`];
                        const isApplied =
                          appliedPromptTemplate?.serverId === server.id &&
                          appliedPromptTemplate?.promptName === prompt.name;

                        return (
                          <div key={prompt.name} className="rounded-[16px] border border-[var(--line)] bg-[var(--paper)] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm text-[var(--ink)]">{prompt.title || prompt.name}</p>
                                <p className="mt-1 text-xs text-[var(--muted-ink)]">{prompt.name}</p>
                              </div>
                              {isApplied ? <Badge className="bg-[rgba(85,109,89,0.12)] text-[#556d59]">已应用</Badge> : null}
                            </div>
                            {prompt.description ? (
                              <p className="mt-2 text-xs leading-6 text-[var(--muted-ink)]">{prompt.description}</p>
                            ) : null}
                            {Array.isArray(prompt.arguments) && prompt.arguments.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">模板参数 JSON</p>
                                <Input
                                  value={promptArgs[`${server.id}:${prompt.name}`] ?? ""}
                                  placeholder='{"chapter":"第一章"}'
                                  onChange={(event) =>
                                    setPromptArgs((current) => ({
                                      ...current,
                                      [`${server.id}:${prompt.name}`]: event.target.value,
                                    }))
                                  }
                                />
                                <p className="text-xs leading-6 text-[var(--muted-ink)]">
                                  {prompt.arguments.map((argument) => `${argument.name}${argument.required ? "*" : ""}`).join(" / ")}
                                </p>
                              </div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={disabled || busyKey === `prompt-preview:${server.id}:${prompt.name}`}
                                onClick={async () => {
                                  setError(null);
                                  setMessage(null);
                                  setBusyKey(`prompt-preview:${server.id}:${prompt.name}`);
                                  try {
                                    await previewPrompt(server, prompt);
                                  } catch (actionError) {
                                    setError(actionError instanceof Error ? actionError.message : "读取 MCP 提示模板失败。");
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                              >
                                {busyKey === `prompt-preview:${server.id}:${prompt.name}` ? "读取中" : "预览模板"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={disabled || busyKey === `prompt-apply:${server.id}:${prompt.name}`}
                                onClick={async () => {
                                  setError(null);
                                  setMessage(null);
                                  setBusyKey(`prompt-apply:${server.id}:${prompt.name}`);
                                  try {
                                    await applyPrompt(server, prompt);
                                  } catch (actionError) {
                                    setError(actionError instanceof Error ? actionError.message : "应用 MCP 提示模板失败。");
                                  } finally {
                                    setBusyKey(null);
                                  }
                                }}
                              >
                                {busyKey === `prompt-apply:${server.id}:${prompt.name}` ? "应用中" : "应用到本次生成"}
                              </Button>
                            </div>
                            {preview ? (
                              <Textarea
                                className="mt-3 min-h-[120px]"
                                value={preview.compiledText}
                                readOnly
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {snapshot.resourceTemplates.length > 0 ? (
                      <div className="rounded-[16px] border border-[var(--line)] bg-[var(--paper)] p-3">
                        <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">资源模板</p>
                        <ul className="mt-2 space-y-2 text-xs leading-6 text-[var(--muted-ink)]">
                          {snapshot.resourceTemplates.map((template) => (
                            <li key={template.uriTemplate}>
                              {template.name || template.title || template.uriTemplate}
                              {" "}
                              ·
                              {" "}
                              {template.uriTemplate}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      {error ? <p className="text-sm text-[#9f3a2f]">{error}</p> : null}
      {message ? <p className="text-sm text-[#556d59]">{message}</p> : null}
    </div>
  );
}
