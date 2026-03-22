import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createMCPClientMock = vi.fn();

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: createMCPClientMock,
}));

const BASE_ENV = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/novel_tools?schema=public",
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_BASE_URL: "http://localhost:3000",
  APP_ENV: "test",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  GROK_API_URL: "",
  GROK_API_KEY: "",
  GROK_MODEL: "",
  TAVILY_API_URL: "",
  TAVILY_API_KEY: "",
  FIRECRAWL_API_URL: "",
  FIRECRAWL_API_KEY: "",
  GROK_RETRY_MAX_ATTEMPTS: "2",
  GROK_RETRY_MULTIPLIER: "2",
  GROK_RETRY_MAX_WAIT: "30000",
} as const;

async function createMockServer(overrides: Partial<Record<string, unknown>> = {}) {
  const { encryptRecord, encryptString } = await import("@/lib/security/crypto");

  return {
    id: "mcp-1",
    userId: "user-1",
    name: "Archive Search",
    transportType: "streamable_http",
    serverUrl: "https://mcp.example.com",
    authMode: "bearer",
    encryptedAuth: encryptString("mcp-secret"),
    encryptedHeaders: encryptRecord({ "x-trace-id": "trace-123" }),
    toolCount: 0,
    resourceCount: 0,
    promptCount: 0,
    capabilitiesSnapshot: null,
    healthStatus: "misconfigured",
    lastSyncAt: null,
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    ...overrides,
  } as const;
}

describe("mcp client helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    createMCPClientMock.mockReset();

    for (const [key, value] of Object.entries(BASE_ENV)) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("builds the correct remote MCP transport and decrypted headers", async () => {
    const fakeClient = { close: vi.fn() };
    createMCPClientMock.mockResolvedValue(fakeClient);

    const server = await createMockServer();
    const { createRemoteMcpClient } = await import("./client");
    const client = await createRemoteMcpClient(server);

    expect(client).toBe(fakeClient);
    expect(createMCPClientMock).toHaveBeenCalledWith({
      transport: {
        type: "http",
        url: "https://mcp.example.com",
        headers: {
          Authorization: "Bearer mcp-secret",
          "x-trace-id": "trace-123",
        },
      },
    });
  });

  it("probes capabilities successfully and reports healthy", async () => {
    const fakeClient = {
      tools: vi.fn().mockResolvedValue({
        search_docs: { description: "Search docs" },
      }),
      listResources: vi.fn().mockResolvedValue({
        resources: [{ uri: "resource://story" }],
      }),
      listResourceTemplates: vi.fn().mockResolvedValue({
        resourceTemplates: [{ uriTemplate: "resource://story/{id}" }],
      }),
      experimental_listPrompts: vi.fn().mockResolvedValue({
        prompts: [{ name: "summarize_story" }],
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    createMCPClientMock.mockResolvedValue(fakeClient);

    const server = await createMockServer();
    const { probeMcpServer } = await import("./client");
    const result = await probeMcpServer(server);

    expect(result.status).toBe("healthy");
    if (result.status !== "healthy") {
      throw new Error(`Expected healthy status, received ${result.status}.`);
    }
    expect(result.toolCount).toBe(1);
    expect(result.resourceCount).toBe(1);
    expect(result.promptCount).toBe(1);
    expect(result.note).toContain('Capability probe succeeded for "Archive Search"');
    expect(fakeClient.close).toHaveBeenCalledTimes(1);
  });

  it("maps authentication failures to invalid_auth", async () => {
    const fakeClient = {
      tools: vi.fn().mockRejectedValue(new Error("401 Unauthorized")),
      listResources: vi.fn(),
      listResourceTemplates: vi.fn(),
      experimental_listPrompts: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    createMCPClientMock.mockResolvedValue(fakeClient);

    const server = await createMockServer();
    const { probeMcpServer } = await import("./client");
    const result = await probeMcpServer(server);

    expect(result.status).toBe("invalid_auth");
    expect(result.note).toContain("401 Unauthorized");
    expect(fakeClient.close).toHaveBeenCalledTimes(1);
  });

  it("maps transport failures to unreachable", async () => {
    createMCPClientMock.mockRejectedValue(new Error("fetch failed: connect ECONNREFUSED"));

    const server = await createMockServer();
    const { probeMcpServer } = await import("./client");
    const result = await probeMcpServer(server);

    expect(result.status).toBe("unreachable");
    expect(result.note).toContain("ECONNREFUSED");
  });

  it("reads MCP resource content and normalizes it for import workflows", async () => {
    const fakeClient = {
      readResource: vi.fn().mockResolvedValue({
        contents: [
          {
            uri: "https://example.com/story-reference",
            name: "story-reference",
            title: "Story Reference",
            mimeType: "text/markdown",
            text: "# 港口设定\n\n九州城依河设港。",
          },
        ],
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    createMCPClientMock.mockResolvedValue(fakeClient);

    const server = await createMockServer();
    const { readMcpResource } = await import("./client");
    const result = await readMcpResource(server, "https://example.com/story-reference");

    expect(fakeClient.readResource).toHaveBeenCalledWith({
      uri: "https://example.com/story-reference",
    });
    expect(result.primaryMimeType).toBe("text/markdown");
    expect(result.hasBinaryContent).toBe(false);
    expect(result.combinedText).toContain("Story Reference");
    expect(result.combinedText).toContain("九州城依河设港");
    expect(fakeClient.close).toHaveBeenCalledTimes(1);
  });

  it("loads MCP prompt content and compiles a preview block", async () => {
    const fakeClient = {
      experimental_getPrompt: vi.fn().mockResolvedValue({
        description: "Prompt stub",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "请先调用 lookup_fact，再输出审稿结论。",
            },
          },
        ],
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    createMCPClientMock.mockResolvedValue(fakeClient);

    const server = await createMockServer();
    const { getMcpPrompt } = await import("./client");
    const result = await getMcpPrompt(server, "review_with_fact", { chapter: "第一章" });

    expect(fakeClient.experimental_getPrompt).toHaveBeenCalledWith({
      name: "review_with_fact",
      arguments: { chapter: "第一章" },
    });
    expect(result.description).toBe("Prompt stub");
    expect(result.compiledText).toContain("## user");
    expect(result.compiledText).toContain("请先调用 lookup_fact");
    expect(fakeClient.close).toHaveBeenCalledTimes(1);
  });
});
