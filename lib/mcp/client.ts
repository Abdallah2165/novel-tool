import "server-only";

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { Prisma } from "@prisma/client";
import type { McpServer } from "@prisma/client";

import type { HealthStatus } from "@/lib/types/domain";
import { decryptRecord, decryptString } from "@/lib/security/crypto";
import { toPrismaJson } from "@/lib/prisma-json";
import { assertSafeRemoteUrl } from "@/lib/security/url";

type McpFailureHealthStatus = Exclude<HealthStatus, "healthy">;

function buildHeaders(server: McpServer) {
  const extraHeaders = decryptRecord(server.encryptedHeaders);

  if (!server.encryptedAuth || server.authMode === "none") {
    return extraHeaders;
  }

  const authValue = decryptString(server.encryptedAuth);

  if (server.authMode === "bearer") {
    return { ...extraHeaders, Authorization: `Bearer ${authValue}` };
  }

  if (server.authMode === "api_key") {
    return { ...extraHeaders, "x-api-key": authValue };
  }

  return { ...extraHeaders, Authorization: authValue };
}

export async function createRemoteMcpClient(server: McpServer) {
  assertSafeRemoteUrl(server.serverUrl);
  const headers = buildHeaders(server);

  return createMCPClient({
    transport:
      server.transportType === "sse"
        ? {
            type: "sse",
            url: server.serverUrl,
            headers,
          }
        : {
            type: "http",
            url: server.serverUrl,
            headers,
          },
  });
}

export async function snapshotMcpCapabilities(client: MCPClient) {
  const [tools, resources, templates, prompts] = await Promise.all([
    client.tools(),
    client.listResources(),
    client.listResourceTemplates(),
    client.experimental_listPrompts(),
  ]);

  const capabilitiesSnapshot = {
    tools: Object.keys(tools),
    resources: resources.resources,
    resourceTemplates: templates.resourceTemplates,
    prompts: prompts.prompts,
  };

  return {
    toolCount: Object.keys(tools).length as number,
    resourceCount: resources.resources.length as number,
    promptCount: prompts.prompts.length as number,
    capabilitiesSnapshot: toPrismaJson(capabilitiesSnapshot) satisfies Prisma.InputJsonValue,
  };
}

export type McpCapabilitySnapshot = Awaited<ReturnType<typeof snapshotMcpCapabilities>>;

type McpResourcePreview = {
  uri: string;
  name: string | null;
  title: string | null;
  mimeType: string | null;
  kind: "text" | "binary";
  text: string | null;
};

type McpPromptMessagePreview = {
  role: "user" | "assistant";
  preview: string;
};

export type McpResourceReadPreview = {
  contents: McpResourcePreview[];
  combinedText: string;
  primaryMimeType: string | null;
  hasBinaryContent: boolean;
};

export type McpPromptPreview = {
  description: string | null;
  messages: McpPromptMessagePreview[];
  compiledText: string;
};

export type McpProbeSuccess = McpCapabilitySnapshot & {
  status: "healthy";
  syncedAt: string;
  note: string;
};

export type McpProbeFailure = {
  status: McpFailureHealthStatus;
  syncedAt: string;
  note: string;
};

export type McpProbeResult = McpProbeSuccess | McpProbeFailure;

function getMcpErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim() || "Unknown MCP probe error.";
  }

  return "Unknown MCP probe error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildResourceTextPreview(content: McpResourcePreview, index: number) {
  const label = [content.title, content.name, content.uri].filter(Boolean).join(" | ") || `resource-${index + 1}`;

  if (content.text) {
    return `# ${label}\n${content.text}`;
  }

  return `# ${label}\n[binary ${content.mimeType ?? "application/octet-stream"} content omitted]`;
}

function normalizeMcpResourceContent(value: unknown): McpResourcePreview | null {
  if (!isRecord(value)) {
    return null;
  }

  const uri = pickString(value.uri);
  if (!uri) {
    return null;
  }

  const text = pickString(value.text);
  const blob = pickString(value.blob);

  return {
    uri,
    name: pickString(value.name),
    title: pickString(value.title),
    mimeType: pickString(value.mimeType),
    kind: text ? "text" : blob ? "binary" : "text",
    text,
  };
}

function formatPromptMessagePreview(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  const content = value.content;
  if (!isRecord(content)) {
    return "";
  }

  if (content.type === "text") {
    return pickString(content.text) ?? "";
  }

  if (content.type === "resource" && isRecord(content.resource)) {
    const resource = normalizeMcpResourceContent(content.resource);
    if (!resource) {
      return "";
    }

    return buildResourceTextPreview(resource, 0);
  }

  if (content.type === "image") {
    return `[image ${pickString(content.mimeType) ?? "unknown"} omitted]`;
  }

  return "";
}

async function withMcpClient<T>(server: McpServer, action: (client: MCPClient) => Promise<T>) {
  const client = await createRemoteMcpClient(server);

  try {
    return await action(client);
  } finally {
    await client.close();
  }
}

export function normalizeMcpResourceReadResult(
  result: Awaited<ReturnType<MCPClient["readResource"]>>,
): McpResourceReadPreview {
  const contents = Array.isArray(result.contents)
    ? result.contents
        .map((content) => normalizeMcpResourceContent(content))
        .filter((content): content is McpResourcePreview => Boolean(content))
    : [];

  return {
    contents,
    combinedText: contents.map((content, index) => buildResourceTextPreview(content, index)).join("\n\n").trim(),
    primaryMimeType: contents.find((content) => content.mimeType)?.mimeType ?? null,
    hasBinaryContent: contents.some((content) => content.kind === "binary"),
  };
}

export function normalizeMcpPromptResult(
  result: Awaited<ReturnType<MCPClient["experimental_getPrompt"]>>,
): McpPromptPreview {
  const messages = Array.isArray(result.messages)
    ? result.messages
        .map((message) => {
          if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant")) {
            return null;
          }

          return {
            role: message.role,
            preview: formatPromptMessagePreview(message),
          } satisfies McpPromptMessagePreview;
        })
        .filter((message): message is McpPromptMessagePreview => Boolean(message))
    : [];

  return {
    description: pickString(result.description),
    messages,
    compiledText: messages
      .map((message) => `## ${message.role}\n${message.preview || "_Empty message_"}`)
      .join("\n\n")
      .trim(),
  };
}

export async function readMcpResource(server: McpServer, uri: string) {
  return withMcpClient(server, async (client) => {
    const result = await client.readResource({ uri });
    return normalizeMcpResourceReadResult(result);
  });
}

export async function getMcpPrompt(server: McpServer, name: string, args?: Record<string, unknown>) {
  return withMcpClient(server, async (client) => {
    const result = await client.experimental_getPrompt({
      name,
      arguments: args,
    });
    return normalizeMcpPromptResult(result);
  });
}

function buildProbeNote(prefix: string, message?: string) {
  if (!message) {
    return prefix;
  }

  return `${prefix} ${message}`;
}

export function mapMcpErrorToHealthStatus(error: unknown): McpFailureHealthStatus {
  const message = getMcpErrorMessage(error).toLowerCase();

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("authentication") ||
    message.includes("api key") ||
    message.includes("token")
  ) {
    return "invalid_auth";
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("abort") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return "unreachable";
  }

  if (
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("overloaded") ||
    message.includes("service unavailable") ||
    message.includes("rate limit")
  ) {
    return "degraded";
  }

  if (
    message.includes("url format is invalid") ||
    message.includes("only http") ||
    message.includes("private, loopback") ||
    message.includes("invalid url") ||
    message.includes("unsupported") ||
    message.includes("bad request")
  ) {
    return "misconfigured";
  }

  return "misconfigured";
}

export async function probeMcpServer(server: McpServer): Promise<McpProbeResult> {
  const syncedAt = new Date().toISOString();

  try {
    const snapshot = await withMcpClient(server, async (client) => snapshotMcpCapabilities(client));

    return {
      status: "healthy" as const,
      syncedAt,
      note: `Capability probe succeeded for "${server.name}" over ${server.transportType}.`,
      ...snapshot,
    };
  } catch (error) {
    return {
      status: mapMcpErrorToHealthStatus(error),
      syncedAt,
      note: buildProbeNote(`Capability probe failed for "${server.name}".`, getMcpErrorMessage(error)),
    };
  }
}
