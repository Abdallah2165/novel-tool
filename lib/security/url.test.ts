import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("remote URL safety guard", () => {
  beforeEach(() => {
    vi.resetModules();

    for (const [key, value] of Object.entries(BASE_ENV)) {
      vi.stubEnv(key, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts public HTTP(S) URLs in non-production environments", async () => {
    const { assertSafeRemoteUrl } = await import("./url");

    expect(assertSafeRemoteUrl("https://api.example.com/v1").href).toBe("https://api.example.com/v1");
    expect(assertSafeRemoteUrl("http://api.example.com/v1").href).toBe("http://api.example.com/v1");
  });

  it("rejects non-http protocols and malformed URLs", async () => {
    const { assertSafeRemoteUrl } = await import("./url");

    expect(() => assertSafeRemoteUrl("ftp://example.com")).toThrowError("Only HTTP(S) endpoints are allowed.");
    expect(() => assertSafeRemoteUrl("not-a-url")).toThrowError("URL format is invalid.");
  });

  it("rejects loopback, metadata, and private IPv4 hosts", async () => {
    const { assertSafeRemoteUrl } = await import("./url");

    expect(() => assertSafeRemoteUrl("http://localhost:3000")).toThrowError(
      "Private, loopback, or metadata endpoints are blocked.",
    );
    expect(() => assertSafeRemoteUrl("http://127.0.0.1:3000")).toThrowError(
      "Private, loopback, or metadata endpoints are blocked.",
    );
    expect(() => assertSafeRemoteUrl("http://192.168.1.10/service")).toThrowError(
      "Private, loopback, or metadata endpoints are blocked.",
    );
    expect(() => assertSafeRemoteUrl("http://169.254.169.254/latest/meta-data")).toThrowError(
      "Private, loopback, or metadata endpoints are blocked.",
    );
  });

  it("requires HTTPS in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.resetModules();

    const { assertSafeRemoteUrl } = await import("./url");

    expect(() => assertSafeRemoteUrl("http://api.example.com/v1")).toThrowError(
      "Production only allows HTTPS endpoints.",
    );
    expect(assertSafeRemoteUrl("https://api.example.com/v1").href).toBe("https://api.example.com/v1");
  });
});
