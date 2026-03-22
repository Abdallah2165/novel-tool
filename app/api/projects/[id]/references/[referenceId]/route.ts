import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; referenceId: string }> },
) {
  try {
    const [{ id, referenceId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const reference = await prisma.referenceDocument.findFirst({
      where: {
        id: referenceId,
        projectId: id,
        project: {
          userId: user.id,
        },
      },
    });

    if (!reference) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Reference not found." } }, { status: 404 });
    }

    return jsonOk(reference);
  } catch (error) {
    return jsonError(error);
  }
}
