import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  userGrokConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
};

const resolveRequestUserMock = vi.fn();
const getGrokStatusSummaryMock = vi.fn();
const encryptStringMock = vi.fn((value: string) => `enc:${value}`);

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/search/grok-config", () => ({
  getGrokStatusSummary: getGrokStatusSummaryMock,
}));

vi.mock("@/lib/security/crypto", () => ({
  encryptString: encryptStringMock,
}));

vi.mock("@/lib/security/url", () => ({
  assertSafeRemoteUrl: vi.fn(),
}));

describe("grok config route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.userGrokConfig.findUnique.mockReset();
    prismaMock.userGrokConfig.upsert.mockReset();
    prismaMock.userGrokConfig.deleteMany.mockReset();
    resolveRequestUserMock.mockReset();
    getGrokStatusSummaryMock.mockReset();
    encryptStringMock.mockClear();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("saves user grok config and returns the refreshed summary", async () => {
    prismaMock.userGrokConfig.findUnique.mockResolvedValue(null);
    prismaMock.userGrokConfig.upsert.mockResolvedValue({ id: "grok-1" });
    getGrokStatusSummaryMock.mockResolvedValue({
      source: "user",
      enabled: true,
      grokApiUrl: "https://api.x.ai/v1",
      grokModel: "grok-4-fast",
      hasGrokApiKey: true,
      grokSource: "user",
      tavilyApiUrl: "https://api.tavily.com",
      hasTavilyApiKey: true,
      tavilySource: "user",
      firecrawlApiUrl: "https://api.firecrawl.dev",
      hasFirecrawlApiKey: true,
      firecrawlSource: "user",
      hasPlatformFallback: true,
      canSearch: true,
      canFetch: true,
      canMap: true,
      healthStatus: "misconfigured",
      lastHealthCheckAt: null,
      retryMaxAttempts: 2,
      retryMultiplier: 2,
      retryMaxWait: 30000,
    });

    const { PUT } = await import("./route");

    const response = await PUT(
      new Request("http://localhost/api/grok-config", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          grokApiUrl: "https://api.x.ai/v1",
          grokApiKey: "secret-key",
          grokModel: "grok-4-fast",
          tavilyApiUrl: "https://api.tavily.com",
          tavilyApiKey: "tvly-key",
          firecrawlApiUrl: "https://api.firecrawl.dev",
          firecrawlApiKey: "firecrawl-key",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.userGrokConfig.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      update: {
        grokApiUrl: "https://api.x.ai/v1",
        encryptedGrokApiKey: "enc:secret-key",
        grokModel: "grok-4-fast",
        tavilyApiUrl: "https://api.tavily.com",
        encryptedTavilyApiKey: "enc:tvly-key",
        firecrawlApiUrl: "https://api.firecrawl.dev",
        encryptedFirecrawlApiKey: "enc:firecrawl-key",
        healthStatus: "misconfigured",
        lastHealthCheckAt: null,
      },
      create: {
        userId: "user-1",
        grokApiUrl: "https://api.x.ai/v1",
        encryptedGrokApiKey: "enc:secret-key",
        grokModel: "grok-4-fast",
        tavilyApiUrl: "https://api.tavily.com",
        encryptedTavilyApiKey: "enc:tvly-key",
        firecrawlApiUrl: "https://api.firecrawl.dev",
        encryptedFirecrawlApiKey: "enc:firecrawl-key",
      },
    });
  });

  it("keeps the existing secret when apiKey is omitted on update", async () => {
    prismaMock.userGrokConfig.findUnique.mockResolvedValue({
      encryptedGrokApiKey: "enc:existing",
      encryptedTavilyApiKey: "enc:tvly-existing",
      encryptedFirecrawlApiKey: "enc:firecrawl-existing",
    });
    prismaMock.userGrokConfig.upsert.mockResolvedValue({ id: "grok-1" });
    getGrokStatusSummaryMock.mockResolvedValue({
      source: "user",
      enabled: true,
      grokApiUrl: "https://api.x.ai/v1",
      grokModel: "grok-4-fast",
      hasGrokApiKey: true,
      grokSource: "user",
      tavilyApiUrl: "https://api.tavily.com",
      hasTavilyApiKey: true,
      tavilySource: "user",
      firecrawlApiUrl: "https://api.firecrawl.dev",
      hasFirecrawlApiKey: true,
      firecrawlSource: "user",
      hasPlatformFallback: false,
      canSearch: true,
      canFetch: true,
      canMap: true,
      healthStatus: "misconfigured",
      lastHealthCheckAt: null,
      retryMaxAttempts: 2,
      retryMultiplier: 2,
      retryMaxWait: 30000,
    });

    const { PUT } = await import("./route");

    const response = await PUT(
      new Request("http://localhost/api/grok-config", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          grokApiUrl: "https://api.x.ai/v1",
          grokModel: "grok-4-fast",
          tavilyApiUrl: "https://api.tavily.com",
          firecrawlApiUrl: "https://api.firecrawl.dev",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(encryptStringMock).not.toHaveBeenCalled();
    expect(prismaMock.userGrokConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          encryptedGrokApiKey: "enc:existing",
          encryptedTavilyApiKey: "enc:tvly-existing",
          encryptedFirecrawlApiKey: "enc:firecrawl-existing",
        }),
      }),
    );
  });

  it("removes the user config and falls back to the refreshed summary", async () => {
    prismaMock.userGrokConfig.deleteMany.mockResolvedValue({ count: 1 });
    getGrokStatusSummaryMock.mockResolvedValue({
      source: "env",
      enabled: true,
      grokApiUrl: "https://api.x.ai/v1",
      grokModel: "grok-platform",
      hasGrokApiKey: true,
      grokSource: "env",
      tavilyApiUrl: "https://api.tavily.com",
      hasTavilyApiKey: true,
      tavilySource: "env",
      firecrawlApiUrl: "https://api.firecrawl.dev",
      hasFirecrawlApiKey: true,
      firecrawlSource: "env",
      hasPlatformFallback: true,
      canSearch: true,
      canFetch: true,
      canMap: true,
      healthStatus: null,
      lastHealthCheckAt: null,
      retryMaxAttempts: 2,
      retryMultiplier: 2,
      retryMaxWait: 30000,
    });

    const { DELETE } = await import("./route");

    const response = await DELETE(new Request("http://localhost/api/grok-config", { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(prismaMock.userGrokConfig.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});
