import { prisma } from "@/lib/db";
import { grokConfigInputSchema } from "@/lib/api/schemas";
import { ApiError, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { getGrokStatusSummary } from "@/lib/search/grok-config";
import { encryptString } from "@/lib/security/crypto";
import { assertSafeRemoteUrl } from "@/lib/security/url";

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const summary = await getGrokStatusSummary(user.id);
    return jsonOk({ summary });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const payload = await parseJson(request, grokConfigInputSchema);
    const grokApiUrl = normalizeOptionalText(payload.grokApiUrl);
    const grokApiKey = normalizeOptionalText(payload.grokApiKey);
    const grokModel = normalizeOptionalText(payload.grokModel);
    const tavilyApiUrl = normalizeOptionalText(payload.tavilyApiUrl);
    const tavilyApiKey = normalizeOptionalText(payload.tavilyApiKey);
    const firecrawlApiUrl = normalizeOptionalText(payload.firecrawlApiUrl);
    const firecrawlApiKey = normalizeOptionalText(payload.firecrawlApiKey);

    if (!grokApiUrl || !grokModel) {
      throw new ApiError(422, "VALIDATION_ERROR", "保存个人 Grok 配置时必须填写 Grok API URL 和默认模型。");
    }

    assertSafeRemoteUrl(grokApiUrl);

    if (tavilyApiUrl) {
      assertSafeRemoteUrl(tavilyApiUrl);
    }

    if (firecrawlApiUrl) {
      assertSafeRemoteUrl(firecrawlApiUrl);
    }

    const existing = await prisma.userGrokConfig.findUnique({
      where: { userId: user.id },
      select: {
        encryptedGrokApiKey: true,
        encryptedTavilyApiKey: true,
        encryptedFirecrawlApiKey: true,
      },
    });
    const nextGrokApiKey = grokApiKey ? encryptString(grokApiKey) : existing?.encryptedGrokApiKey ?? null;
    const nextTavilyApiKey = tavilyApiUrl
      ? tavilyApiKey
        ? encryptString(tavilyApiKey)
        : existing?.encryptedTavilyApiKey ?? null
      : null;
    const nextFirecrawlApiKey = firecrawlApiUrl
      ? firecrawlApiKey
        ? encryptString(firecrawlApiKey)
        : existing?.encryptedFirecrawlApiKey ?? null
      : null;

    if (!nextGrokApiKey) {
      throw new ApiError(422, "VALIDATION_ERROR", "首次保存个人 Grok 配置时必须填写访问密钥。");
    }

    if (tavilyApiUrl && !nextTavilyApiKey) {
      throw new ApiError(422, "VALIDATION_ERROR", "首次保存 Tavily 配置时必须填写访问密钥。");
    }

    if (firecrawlApiUrl && !nextFirecrawlApiKey) {
      throw new ApiError(422, "VALIDATION_ERROR", "首次保存 Firecrawl 配置时必须填写访问密钥。");
    }

    await prisma.userGrokConfig.upsert({
      where: { userId: user.id },
      update: {
        grokApiUrl,
        encryptedGrokApiKey: nextGrokApiKey,
        grokModel,
        tavilyApiUrl,
        encryptedTavilyApiKey: nextTavilyApiKey,
        firecrawlApiUrl,
        encryptedFirecrawlApiKey: nextFirecrawlApiKey,
        healthStatus: "misconfigured",
        lastHealthCheckAt: null,
      },
      create: {
        userId: user.id,
        grokApiUrl,
        encryptedGrokApiKey: nextGrokApiKey,
        grokModel,
        tavilyApiUrl,
        encryptedTavilyApiKey: nextTavilyApiKey,
        firecrawlApiUrl,
        encryptedFirecrawlApiKey: nextFirecrawlApiKey,
      },
    });

    const summary = await getGrokStatusSummary(user.id);
    return jsonOk({ summary });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await resolveRequestUser(request);

    await prisma.userGrokConfig.deleteMany({
      where: { userId: user.id },
    });

    const summary = await getGrokStatusSummary(user.id);
    return jsonOk({
      removed: true,
      summary,
    });
  } catch (error) {
    return jsonError(error);
  }
}
