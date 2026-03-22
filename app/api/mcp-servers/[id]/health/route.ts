import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { probeMcpServer } from "@/lib/mcp/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const server = await prisma.mcpServer.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!server) {
      return Response.json({ error: { code: "NOT_FOUND", message: "MCP server not found." } }, { status: 404 });
    }

    const probe = await probeMcpServer(server);

    await prisma.mcpServer.update({
      where: { id: server.id },
      data: {
        healthStatus: probe.status,
        ...(probe.status === "healthy"
          ? {
              toolCount: Number(probe.toolCount),
              resourceCount: Number(probe.resourceCount),
              promptCount: Number(probe.promptCount),
              capabilitiesSnapshot: probe.capabilitiesSnapshot,
              lastSyncAt: new Date(probe.syncedAt),
            }
          : {}),
      },
    });

    return jsonOk(probe);
  } catch (error) {
    return jsonError(error);
  }
}
