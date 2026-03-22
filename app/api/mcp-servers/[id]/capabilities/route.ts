import { prisma } from "@/lib/db";
import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { mcpCapabilitiesActionSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { getMcpPrompt, readMcpResource } from "@/lib/mcp/client";

export async function GET(
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
      select: {
        id: true,
        name: true,
        transportType: true,
        serverUrl: true,
        toolCount: true,
        resourceCount: true,
        promptCount: true,
        capabilitiesSnapshot: true,
        healthStatus: true,
        lastSyncAt: true,
      },
    });

    if (!server) {
      return Response.json({ error: { code: "NOT_FOUND", message: "MCP server not found." } }, { status: 404 });
    }

    return jsonOk(server);
  } catch (error) {
    return jsonError(error);
  }
}

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

    const payload = await parseJson(request, mcpCapabilitiesActionSchema);

    if (payload.action === "read_resource") {
      const result = await readMcpResource(server, payload.uri);
      return jsonOk({
        action: payload.action,
        uri: payload.uri,
        ...result,
      });
    }

    const result = await getMcpPrompt(server, payload.name, payload.arguments);
    return jsonOk({
      action: payload.action,
      name: payload.name,
      ...result,
    });
  } catch (error) {
    return jsonError(error);
  }
}
