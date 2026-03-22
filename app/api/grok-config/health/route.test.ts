import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  userGrokConfig: {
    update: vi.fn(),
  },
};

const resolveRequestUserMock = vi.fn();
const resolveGrokRuntimeConfigMock = vi.fn();
const invokeGrokToolMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/search/grok-config", () => ({
  resolveGrokRuntimeConfig: resolveGrokRuntimeConfigMock,
}));

vi.mock("@/lib/search/grok", () => ({
  invokeGrokTool: invokeGrokToolMock,
}));

describe("grok config health route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.userGrokConfig.update.mockReset();
    resolveRequestUserMock.mockReset();
    resolveGrokRuntimeConfigMock.mockReset();
    invokeGrokToolMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("updates user grok health status after a successful probe", async () => {
    resolveGrokRuntimeConfigMock.mockResolvedValue({
      source: "user",
      grok: {
        apiUrl: "https://api.x.ai/v1",
        apiKey: "secret",
        model: "grok-4-fast",
        source: "user",
      },
      tavily: {
        apiUrl: "https://api.tavily.com",
        apiKey: "tvly-key",
        source: "user",
      },
      firecrawl: {
        apiUrl: "https://api.firecrawl.dev",
        apiKey: "firecrawl-key",
        source: "user",
      },
      retryMaxAttempts: 2,
      retryMultiplier: 2,
      retryMaxWait: 30000,
    });
    invokeGrokToolMock.mockResolvedValue({
      toolName: "get_config_info",
      enabled: true,
      status: "ok",
      attemptCount: 1,
      data: { overallHealthStatus: "healthy" },
    });

    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/grok-config/health", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(invokeGrokToolMock).toHaveBeenCalledWith(
      "get_config_info",
      {},
      expect.objectContaining({
        source: "user",
      }),
    );
    expect(prismaMock.userGrokConfig.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: {
        healthStatus: "healthy",
        lastHealthCheckAt: expect.any(Date),
      },
    });
  });

  it("returns validation error when neither user config nor platform fallback exists", async () => {
    resolveGrokRuntimeConfigMock.mockResolvedValue(null);

    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/grok-config/health", { method: "POST" }));

    expect(response.status).toBe(422);
    expect(invokeGrokToolMock).not.toHaveBeenCalled();
    expect(prismaMock.userGrokConfig.update).not.toHaveBeenCalled();
  });
});
