import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateTextMock = vi.fn();

vi.mock("ai", () => ({
  generateText: generateTextMock,
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

describe("provider endpoint probe", () => {
  beforeEach(() => {
    vi.resetModules();
    generateTextMock.mockReset();

    for (const [key, value] of Object.entries(BASE_ENV)) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("marks the endpoint healthy after a successful minimal probe", async () => {
    generateTextMock.mockResolvedValue({
      text: "OK",
    });

    const { encryptString } = await import("@/lib/security/crypto");
    const { probeEndpoint } = await import("./factory");

    const result = await probeEndpoint({
      id: "endpoint-1",
      userId: "user-1",
      providerType: "openai",
      label: "OpenAI Mock",
      baseURL: "https://api.example.com/v1",
      authMode: "bearer",
      encryptedSecret: encryptString("test-secret"),
      encryptedHeaders: {},
      defaultModel: "gpt-test",
      healthStatus: "misconfigured",
      lastHealthCheckAt: null,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    });

    expect(result.status).toBe("healthy");
    expect(result.note).toContain('Minimal model probe succeeded for "gpt-test"');
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Reply with exactly OK.",
        maxOutputTokens: 8,
        temperature: 0,
        maxRetries: 0,
      }),
    );
  });

  it("marks authentication failures as invalid_auth", async () => {
    generateTextMock.mockRejectedValue(new Error("401 Unauthorized: invalid API key"));

    const { encryptString } = await import("@/lib/security/crypto");
    const { probeEndpoint } = await import("./factory");

    const result = await probeEndpoint({
      id: "endpoint-2",
      userId: "user-1",
      providerType: "anthropic",
      label: "Anthropic Mock",
      baseURL: "https://api.example.com",
      authMode: "bearer",
      encryptedSecret: encryptString("bad-secret"),
      encryptedHeaders: {},
      defaultModel: "claude-test",
      healthStatus: "misconfigured",
      lastHealthCheckAt: null,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    });

    expect(result.status).toBe("invalid_auth");
    expect(result.note).toContain("invalid API key");
  });

  it("marks transport failures as unreachable", async () => {
    generateTextMock.mockRejectedValue(new Error("fetch failed: connect ECONNREFUSED"));

    const { encryptString } = await import("@/lib/security/crypto");
    const { probeEndpoint } = await import("./factory");

    const result = await probeEndpoint({
      id: "endpoint-3",
      userId: "user-1",
      providerType: "gemini",
      label: "Gemini Mock",
      baseURL: "https://api.example.com",
      authMode: "bearer",
      encryptedSecret: encryptString("secret"),
      encryptedHeaders: {},
      defaultModel: "gemini-test",
      healthStatus: "misconfigured",
      lastHealthCheckAt: null,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    });

    expect(result.status).toBe("unreachable");
    expect(result.note).toContain("ECONNREFUSED");
  });

  it("marks missing models or bad requests as misconfigured", async () => {
    generateTextMock.mockRejectedValue(new Error("404 model not found"));

    const { encryptString } = await import("@/lib/security/crypto");
    const { probeEndpoint } = await import("./factory");

    const result = await probeEndpoint({
      id: "endpoint-4",
      userId: "user-1",
      providerType: "openai",
      label: "OpenAI Mock",
      baseURL: "https://api.example.com/v1",
      authMode: "bearer",
      encryptedSecret: encryptString("secret"),
      encryptedHeaders: {},
      defaultModel: "missing-model",
      healthStatus: "misconfigured",
      lastHealthCheckAt: null,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    });

    expect(result.status).toBe("misconfigured");
    expect(result.note).toContain("404 model not found");
  });
});
