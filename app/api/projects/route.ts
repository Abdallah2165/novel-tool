import { prisma } from "@/lib/db";
import { jsonCreated, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { projectInputSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { createProjectWithBootstrap } from "@/lib/projects/create-project";

export async function GET(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        preference: true,
        _count: {
          select: {
            artifacts: true,
            references: true,
            drafts: true,
          },
        },
      },
    });

    return jsonOk({ items: projects });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const payload = await parseJson(request, projectInputSchema);

    const result = await prisma.$transaction(async (tx) => {
      return createProjectWithBootstrap(tx, {
        userId: user.id,
        name: payload.name,
        genre: payload.genre,
        platform: payload.platform,
        status: payload.status,
      });
    });

    return jsonCreated(result);
  } catch (error) {
    return jsonError(error);
  }
}
