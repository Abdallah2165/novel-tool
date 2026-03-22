import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  mcpServer: {
    findFirst: vi.fn(),
  },
};

const resolveRequestUserMock = vi.fn();
const readMcpResourceMock = vi.fn();
const getMcpPromptMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/mcp/client", () => ({
  readMcpResource: readMcpResourceMock,
  getMcpPrompt: getMcpPromptMock,
}));

describe("mcp capabilities route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.mcpServer.findFirst.mockReset();
    resolveRequestUserMock.mockReset();
    readMcpResourceMock.mockReset();
    getMcpPromptMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
    prismaMock.mcpServer.findFirst.mockResolvedValue({
      id: "mcp-1",
      userId: "user-1",
      name: "Archive Search",
      transportType: "streamable_http",
      serverUrl: "https://mcp.example.com",
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns stored capabilities snapshot on GET", async () => {
    prismaMock.mcpServer.findFirst.mockResolvedValue({
      id: "mcp-1",
      name: "Archive Search",
      transportType: "streamable_http",
      serverUrl: "https://mcp.example.com",
      toolCount: 1,
      resourceCount: 1,
      promptCount: 1,
      capabilitiesSnapshot: {
        resources: [{ uri: "resource://story" }],
        prompts: [{ name: "review_with_fact" }],
      },
      healthStatus: "healthy",
      lastSyncAt: new Date("2026-03-20T00:00:00.000Z"),
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/mcp-servers/mcp-1/capabilities"), {
      params: Promise.resolve({ id: "mcp-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.capabilitiesSnapshot.resources).toHaveLength(1);
    expect(payload.capabilitiesSnapshot.prompts).toHaveLength(1);
  });

  it("reads MCP resource content via POST action", async () => {
    readMcpResourceMock.mockResolvedValue({
      contents: [
        {
          uri: "resource://story",
          name: "story",
          title: "Story",
          mimeType: "text/plain",
          kind: "text",
          text: "九州城依河设港。",
        },
      ],
      combinedText: "# Story\n九州城依河设港。",
      primaryMimeType: "text/plain",
      hasBinaryContent: false,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/mcp-servers/mcp-1/capabilities", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "read_resource",
          uri: "resource://story",
        }),
      }),
      {
        params: Promise.resolve({ id: "mcp-1" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(readMcpResourceMock).toHaveBeenCalledWith(expect.objectContaining({ id: "mcp-1" }), "resource://story");
    expect(payload.combinedText).toContain("九州城依河设港");
  });

  it("loads MCP prompt content via POST action", async () => {
    getMcpPromptMock.mockResolvedValue({
      description: "Prompt stub",
      messages: [{ role: "user", preview: "请先调用 lookup_fact。" }],
      compiledText: "## user\n请先调用 lookup_fact。",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/mcp-servers/mcp-1/capabilities", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "get_prompt",
          name: "review_with_fact",
          arguments: {
            chapter: "第一章",
          },
        }),
      }),
      {
        params: Promise.resolve({ id: "mcp-1" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getMcpPromptMock).toHaveBeenCalledWith(expect.objectContaining({ id: "mcp-1" }), "review_with_fact", {
      chapter: "第一章",
    });
    expect(payload.compiledText).toContain("lookup_fact");
  });
});
