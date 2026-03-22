import "server-only";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptString } from "@/lib/security/crypto";

export type GrokProviderSource = "user" | "env" | "none";
export type GrokConfigSource = GrokProviderSource | "mixed";

type RuntimeProviderConfig = {
  apiUrl: string;
  apiKey: string;
  source: Exclude<GrokProviderSource, "none">;
};

type RuntimeGrokConfig = RuntimeProviderConfig & {
  model: string;
};

export type GrokRuntimeConfig = {
  source: Exclude<GrokConfigSource, "none">;
  grok: RuntimeGrokConfig | null;
  tavily: RuntimeProviderConfig | null;
  firecrawl: RuntimeProviderConfig | null;
  retryMaxAttempts: number;
  retryMultiplier: number;
  retryMaxWait: number;
};

export type GrokStatusSummary = {
  source: GrokConfigSource;
  enabled: boolean;
  grokApiUrl: string;
  grokModel: string;
  hasGrokApiKey: boolean;
  grokSource: GrokProviderSource;
  tavilyApiUrl: string;
  hasTavilyApiKey: boolean;
  tavilySource: GrokProviderSource;
  firecrawlApiUrl: string;
  hasFirecrawlApiKey: boolean;
  firecrawlSource: GrokProviderSource;
  hasPlatformFallback: boolean;
  canSearch: boolean;
  canFetch: boolean;
  canMap: boolean;
  healthStatus: string | null;
  lastHealthCheckAt: Date | null;
  retryMaxAttempts: number;
  retryMultiplier: number;
  retryMaxWait: number;
};

type UserConfigRecord = Awaited<ReturnType<typeof getUserConfigRecord>>;

function getRetryConfig() {
  return {
    retryMaxAttempts: env.GROK_RETRY_MAX_ATTEMPTS,
    retryMultiplier: env.GROK_RETRY_MULTIPLIER,
    retryMaxWait: env.GROK_RETRY_MAX_WAIT,
  };
}

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function resolveOverallSource(sources: GrokProviderSource[]): GrokConfigSource {
  const effective = [...new Set(sources.filter((source) => source !== "none"))];

  if (effective.length === 0) {
    return "none";
  }

  if (effective.length === 1) {
    return effective[0] ?? "none";
  }

  return "mixed";
}

function resolveUserProviderConfig(
  apiUrl: string | null | undefined,
  encryptedApiKey: string | null | undefined,
): RuntimeProviderConfig | null {
  if (!isFilled(apiUrl) || !isFilled(encryptedApiKey)) {
    return null;
  }

  return {
    apiUrl: apiUrl!.trim(),
    apiKey: decryptString(encryptedApiKey!.trim()),
    source: "user",
  };
}

function resolveEnvProviderConfig(apiUrl: string | null | undefined, apiKey: string | null | undefined): RuntimeProviderConfig | null {
  if (!isFilled(apiUrl) || !isFilled(apiKey)) {
    return null;
  }

  return {
    apiUrl: apiUrl!.trim(),
    apiKey: apiKey!.trim(),
    source: "env",
  };
}

function resolveUserGrokConfig(userConfig: UserConfigRecord): RuntimeGrokConfig | null {
  if (!userConfig || !isFilled(userConfig.grokApiUrl) || !isFilled(userConfig.encryptedGrokApiKey) || !isFilled(userConfig.grokModel)) {
    return null;
  }

  return {
    apiUrl: userConfig.grokApiUrl.trim(),
    apiKey: decryptString(userConfig.encryptedGrokApiKey.trim()),
    model: userConfig.grokModel.trim(),
    source: "user",
  };
}

function resolveEnvGrokConfig(): RuntimeGrokConfig | null {
  if (!isFilled(env.GROK_API_URL) || !isFilled(env.GROK_API_KEY) || !isFilled(env.GROK_MODEL)) {
    return null;
  }

  return {
    apiUrl: env.GROK_API_URL!.trim(),
    apiKey: env.GROK_API_KEY!.trim(),
    model: env.GROK_MODEL!.trim(),
    source: "env",
  };
}

function getPlatformFallbackAvailable() {
  return Boolean(
    (isFilled(env.GROK_API_URL) && isFilled(env.GROK_API_KEY) && isFilled(env.GROK_MODEL)) ||
      (isFilled(env.TAVILY_API_URL) && isFilled(env.TAVILY_API_KEY)) ||
      (isFilled(env.FIRECRAWL_API_URL) && isFilled(env.FIRECRAWL_API_KEY)),
  );
}

async function getUserConfigRecord(userId: string) {
  return prisma.userGrokConfig.findUnique({
    where: { userId },
    select: {
      grokApiUrl: true,
      encryptedGrokApiKey: true,
      grokModel: true,
      tavilyApiUrl: true,
      encryptedTavilyApiKey: true,
      firecrawlApiUrl: true,
      encryptedFirecrawlApiKey: true,
      healthStatus: true,
      lastHealthCheckAt: true,
    },
  });
}

function resolveRuntimeProviders(userConfig: UserConfigRecord) {
  const grok = resolveUserGrokConfig(userConfig) ?? resolveEnvGrokConfig();
  const tavily =
    resolveUserProviderConfig(userConfig?.tavilyApiUrl, userConfig?.encryptedTavilyApiKey) ??
    resolveEnvProviderConfig(env.TAVILY_API_URL, env.TAVILY_API_KEY);
  const firecrawl =
    resolveUserProviderConfig(userConfig?.firecrawlApiUrl, userConfig?.encryptedFirecrawlApiKey) ??
    resolveEnvProviderConfig(env.FIRECRAWL_API_URL, env.FIRECRAWL_API_KEY);

  return { grok, tavily, firecrawl };
}

export async function resolveGrokRuntimeConfig(userId: string): Promise<GrokRuntimeConfig | null> {
  const userConfig = await getUserConfigRecord(userId);
  const runtimeProviders = resolveRuntimeProviders(userConfig);
  const source = resolveOverallSource([
    runtimeProviders.grok?.source ?? "none",
    runtimeProviders.tavily?.source ?? "none",
    runtimeProviders.firecrawl?.source ?? "none",
  ]);

  if (source === "none") {
    return null;
  }

  return {
    source,
    ...runtimeProviders,
    ...getRetryConfig(),
  };
}

export async function getGrokStatusSummary(userId: string): Promise<GrokStatusSummary> {
  const userConfig = await getUserConfigRecord(userId);
  const runtimeProviders = resolveRuntimeProviders(userConfig);
  const source = resolveOverallSource([
    runtimeProviders.grok?.source ?? "none",
    runtimeProviders.tavily?.source ?? "none",
    runtimeProviders.firecrawl?.source ?? "none",
  ]);
  const hasPlatformFallback = getPlatformFallbackAvailable();
  const canSearch = Boolean(runtimeProviders.grok && runtimeProviders.tavily);
  const canFetch = Boolean(runtimeProviders.firecrawl);
  const canMap = Boolean(runtimeProviders.firecrawl);

  return {
    source,
    enabled: Boolean(runtimeProviders.grok || runtimeProviders.tavily || runtimeProviders.firecrawl),
    grokApiUrl: runtimeProviders.grok?.apiUrl ?? "",
    grokModel: runtimeProviders.grok?.model ?? "",
    hasGrokApiKey: Boolean(runtimeProviders.grok?.apiKey),
    grokSource: runtimeProviders.grok?.source ?? "none",
    tavilyApiUrl: runtimeProviders.tavily?.apiUrl ?? "",
    hasTavilyApiKey: Boolean(runtimeProviders.tavily?.apiKey),
    tavilySource: runtimeProviders.tavily?.source ?? "none",
    firecrawlApiUrl: runtimeProviders.firecrawl?.apiUrl ?? "",
    hasFirecrawlApiKey: Boolean(runtimeProviders.firecrawl?.apiKey),
    firecrawlSource: runtimeProviders.firecrawl?.source ?? "none",
    hasPlatformFallback,
    canSearch,
    canFetch,
    canMap,
    healthStatus: userConfig?.healthStatus ?? null,
    lastHealthCheckAt: userConfig?.lastHealthCheckAt ?? null,
    ...getRetryConfig(),
  };
}
