import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const runs = await prisma.generationRun.findMany({
      where: {
        projectId: id,
        project: {
          userId: user.id,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk({ items: runs });
  } catch (error) {
    return jsonError(error);
  }
}
