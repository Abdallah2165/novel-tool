import { prisma } from "@/lib/db";
import { grokSearchSchema } from "@/lib/api/schemas";
import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { resolveGrokRuntimeConfig } from "@/lib/search/grok-config";
import { invokeGrokTool, mapGrokStatusToHttpStatus } from "@/lib/search/grok";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!project) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
    }

    const payload = await parseJson(request, grokSearchSchema);
    const grokConfig = await resolveGrokRuntimeConfig(user.id);
    const result = await invokeGrokTool(payload.toolName, payload.payload, grokConfig, {
      projectId: id,
    });

    if (result.status !== "ok") {
      return Response.json(result, { status: mapGrokStatusToHttpStatus(result.status) });
    }

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
