import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { draftUpdateSchema } from "@/lib/api/schemas";
import { ApiError, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { toPrismaJson } from "@/lib/prisma-json";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  try {
    const [{ id, draftId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const draft = await prisma.draft.findFirst({
      where: {
        id: draftId,
        projectId: id,
        project: {
          userId: user.id,
        },
      },
      include: {
        run: true,
      },
    });

    if (!draft) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Draft not found." } }, { status: 404 });
    }

    return jsonOk(draft);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  try {
    const [{ id, draftId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const payload = await parseJson(request, draftUpdateSchema);

    const existing = await prisma.draft.findFirst({
      where: {
        id: draftId,
        projectId: id,
        project: {
          userId: user.id,
        },
      },
    });

    if (!existing) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Draft not found." } }, { status: 404 });
    }

    const nextDraftKind = payload.draftKind ?? existing.draftKind;
    const nextArtifactId = payload.artifactId !== undefined ? payload.artifactId : existing.artifactId;

    if (nextDraftKind === "editor_autosave" && !nextArtifactId) {
      throw new ApiError(422, "VALIDATION_ERROR", "editor_autosave drafts must target a project_chapter artifact.");
    }

    if (nextArtifactId) {
      const artifact = await prisma.workspaceArtifact.findFirst({
        where: {
          id: nextArtifactId,
          projectId: id,
        },
        select: {
          id: true,
          kind: true,
        },
      });

      if (!artifact) {
        throw new ApiError(404, "NOT_FOUND", "Artifact not found.");
      }

      if (nextDraftKind === "editor_autosave" && artifact.kind !== "project_chapter") {
        throw new ApiError(422, "VALIDATION_ERROR", "editor_autosave drafts must target a project_chapter artifact.");
      }
    }

    const { suggestedPatches, ...rest } = payload;
    const data: Prisma.DraftUncheckedUpdateInput = {
      ...rest,
      ...(payload.artifactId !== undefined ? { artifactId: payload.artifactId } : {}),
      ...(suggestedPatches !== undefined ? { suggestedPatches: toPrismaJson(suggestedPatches) } : {}),
    };

    const draft = await prisma.draft.update({
      where: { id: existing.id },
      data,
    });

    return jsonOk(draft);
  } catch (error) {
    return jsonError(error);
  }
}
