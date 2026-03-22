import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type RequestListener, type Server } from "node:http";

vi.mock("server-only", () => ({}));

const createGrokSearchTraceMock = vi.fn();
const getGrokSearchTraceMock = vi.fn();

vi.mock("@/lib/search/grok-source-cache", () => ({
  createGrokSearchTrace: createGrokSearchTraceMock,
  getGrokSearchTrace: getGrokSearchTraceMock,
}));

const BASE_ENV = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/novel_tools?schema=public",
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_BASE_URL: "http://localhost:3000",
  APP_ENV: "test",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  GROK_API_URL: "",
  GROK_API_KEY: "test-grok-key",
  GROK_MODEL: "grok-test-model",
  TAVILY_API_URL: "",
  TAVILY_API_KEY: "test-tavily-key",
  FIRECRAWL_API_URL: "",
  FIRECRAWL_API_KEY: "",
  GROK_RETRY_MAX_ATTEMPTS: "2",
  GROK_RETRY_MULTIPLIER: "1",
  GROK_RETRY_MAX_WAIT: "1",
} as const;

async function startServer(handler: RequestListener): Promise<{ server: Server; url: string }> {
  const server = createServer(handler);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server.");
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe("grok search integration helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    createGrokSearchTraceMock.mockReset();
    getGrokSearchTraceMock.mockReset();

    for (const [key, value] of Object.entries(BASE_ENV)) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("retries transient Tavily failures and stores a source trace for web_search", async () => {
    let searchRequestCount = 0;
    const { server, url } = await startServer((request, response) => {
      if (request.method === "POST" && request.url === "/search") {
        searchRequestCount += 1;

        if (searchRequestCount === 1) {
          response.writeHead(503, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: { message: "temporary outage" } }));
          return;
        }

        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            request_id: "tavily-request-1",
            answer: "秋季到港量增加，税率同步调整。",
            results: [
              {
                title: "Harbor Report",
                url: "https://example.com/harbor-report",
                content: "Steamship arrivals peaked in the autumn quarter.",
              },
            ],
          }),
        );
        return;
      }

      if (request.method === "POST" && request.url === "/v1/chat/completions") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "秋季到港量上升，主要依据 Harbor Report，税率调整需结合港务公报继续核对。",
                },
              },
            ],
          }),
        );
        return;
      }

      response.writeHead(404).end();
    });

    vi.stubEnv("GROK_API_URL", `${url}/v1`);
    vi.stubEnv("TAVILY_API_URL", url);

    try {
      const { invokeGrokTool } = await import("./grok");
      const result = await invokeGrokTool(
        "web_search",
        {
          query: "核查近代港口秋季到港量与关税调整",
        },
        undefined,
        { projectId: "project-1" },
      );

      expect(result.status).toBe("ok");
      expect(result.attemptCount).toBe(2);
      expect(searchRequestCount).toBe(2);
      expect(result.data).toMatchObject({
        session_id: "tavily-request-1",
        sources_count: 1,
        content: "秋季到港量上升，主要依据 Harbor Report，税率调整需结合港务公报继续核对。",
      });
      expect(createGrokSearchTraceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-1",
          sessionId: "tavily-request-1",
          toolName: "web_search",
        }),
      );
    } finally {
      await closeServer(server);
    }
  });

  it("formats resolved external facts into prompt-safe summaries and keeps session metadata", async () => {
    const { server, url } = await startServer((request, response) => {
      if (request.method === "POST" && request.url === "/search") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            request_id: "session-abc123",
            answer: "Harbor Report 与 Customs Bulletin 已命中。",
            results: [
              {
                title: "Harbor Report",
                url: "https://example.com/harbor-report",
                content: "Steamship arrivals peaked in the autumn quarter.",
              },
              {
                title: "Customs Bulletin",
                url: "https://example.com/customs-bulletin",
                content: "Import duties changed after the port inspection reform.",
              },
            ],
          }),
        );
        return;
      }

      if (request.method === "POST" && request.url === "/v1/chat/completions") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "秋季船期走高，税率调整与口岸检查改革有关，主要来源为 Harbor Report 和 Customs Bulletin。",
                },
              },
            ],
          }),
        );
        return;
      }

      response.writeHead(404).end();
    });

    vi.stubEnv("GROK_API_URL", `${url}/v1`);
    vi.stubEnv("TAVILY_API_URL", url);

    try {
      const { resolveExternalFacts } = await import("./grok");
      const result = await resolveExternalFacts({
        projectId: "project-1",
        taskType: "research_fact_check",
        userInstruction: "核查近代港口秋季到港量与关税调整",
        projectContext: "当前剧情需要确认洋行到港量与税率变化的现实背景。",
        selectedReferences: "参考资料：主角上一章提到秋季船期变密。",
        currentTime: "2026-03-20T00:00:00.000Z",
      });

      expect(result.factsForPrompt).toContain("以下内容来自 GrokSearch");
      expect(result.factsForPrompt).toContain("Harbor Report");
      expect(result.factsForPrompt).toContain("https://example.com/customs-bulletin");
      expect(result.toolCallSummary).toMatchObject({
        externalSearch: {
          provider: "groksearch",
          toolName: "web_search",
          status: "ok",
          attemptCount: 1,
          sessionId: "session-abc123",
          sourcesCount: 2,
        },
      });
      expect(createGrokSearchTraceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-1",
          sessionId: "session-abc123",
        }),
      );
    } finally {
      await closeServer(server);
    }
  });

  it("returns cached sources for get_sources", async () => {
    getGrokSearchTraceMock.mockResolvedValue({
      sessionId: "session-cached",
      responsePayload: {
        session_id: "session-cached",
        sources: [
          {
            title: "Cached Source",
            url: "https://example.com/cached",
            snippet: "cached snippet",
          },
        ],
      },
    });

    const { invokeGrokTool } = await import("./grok");
    const result = await invokeGrokTool(
      "get_sources",
      {
        session_id: "session-cached",
      },
      {
        source: "user",
        grok: {
          apiUrl: "https://api.x.ai/v1",
          apiKey: "secret",
          model: "grok-4-fast",
          source: "user",
        },
        tavily: null,
        firecrawl: null,
        retryMaxAttempts: 1,
        retryMultiplier: 1,
        retryMaxWait: 1,
      },
      { projectId: "project-1" },
    );

    expect(result.status).toBe("ok");
    expect(result.data).toMatchObject({
      session_id: "session-cached",
    });
    expect(getGrokSearchTraceMock).toHaveBeenCalledWith("project-1", "session-cached");
  });
});
