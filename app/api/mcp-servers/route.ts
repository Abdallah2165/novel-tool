import { prisma } from "@/lib/db";
import { jsonCreated, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { mcpServerInputSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { encryptRecord, encryptString } from "@/lib/security/crypto";
import { assertSafeRemoteUrl } from "@/lib/security/url";

export async function GET(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const servers = await prisma.mcpServer.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        transportType: true,
        serverUrl: true,
        authMode: true,
        toolCount: true,
        resourceCount: true,
        promptCount: true,
        healthStatus: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return jsonOk({ items: servers });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const payload = await parseJson(request, mcpServerInputSchema);
    assertSafeRemoteUrl(payload.serverUrl);

    const server = await prisma.mcpServer.create({
      data: {
        userId: user.id,
        name: payload.name,
        transportType: payload.transportType,
        serverUrl: payload.serverUrl,
        authMode: payload.authMode,
        encryptedAuth: payload.authPayload ? encryptString(payload.authPayload) : null,
        encryptedHeaders: encryptRecord(payload.extraHeaders),
      },
      select: {
        id: true,
        name: true,
        transportType: true,
        serverUrl: true,
        authMode: true,
        toolCount: true,
        resourceCount: true,
        promptCount: true,
        healthStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return jsonCreated(server);
  } catch (error) {
    return jsonError(error);
  }
}
