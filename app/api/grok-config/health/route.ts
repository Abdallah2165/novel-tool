import type { HealthStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { resolveGrokRuntimeConfig } from "@/lib/search/grok-config";
import { invokeGrokTool } from "@/lib/search/grok";

function mapGrokResultToHealthStatus(result: {
  status: string;
  httpStatus?: number;
  data?: unknown;
}): HealthStatus {
  if (
    result.status === "ok" &&
    typeof result.data === "object" &&
    result.data !== null &&
    "overallHealthStatus" in result.data &&
    typeof (result.data as { overallHealthStatus?: unknown }).overallHealthStatus === "string"
  ) {
    return (result.data as { overallHealthStatus: HealthStatus }).overallHealthStatus;
  }

  if (result.status === "ok") {
    return "healthy";
  }

  if (result.status === "AUTH_ERROR") {
    return "invalid_auth";
  }

  if (result.status === "NETWORK_ERROR" || result.status === "TIMEOUT") {
    return "unreachable";
  }

  if (result.httpStatus === 400 || result.httpStatus === 404) {
    return "misconfigured";
  }

  return "degraded";
}

export async function POST(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const runtimeConfig = await resolveGrokRuntimeConfig(user.id);

    if (!runtimeConfig) {
      throw new ApiError(422, "VALIDATION_ERROR", "当前用户未配置 GrokSearch，平台也没有可用的默认回退。");
    }

    const result = await invokeGrokTool("get_config_info", {}, runtimeConfig);
    const healthStatus = mapGrokResultToHealthStatus(result);

    if (runtimeConfig.source === "user" || runtimeConfig.source === "mixed") {
      await prisma.userGrokConfig.update({
        where: { userId: user.id },
        data: {
          healthStatus,
          lastHealthCheckAt: new Date(),
        },
      });
    }

    return jsonOk({
      source: runtimeConfig.source,
      healthStatus,
      result,
    });
  } catch (error) {
    return jsonError(error);
  }
}
