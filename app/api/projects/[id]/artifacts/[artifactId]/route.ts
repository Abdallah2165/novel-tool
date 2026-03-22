import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { workspaceArtifactUpdateSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import {
  buildDefaultEditorLayoutPrefs,
  normalizeChapterIndex,
  updateChapterIndexEntry,
} from "@/lib/projects/editor-state";
import { toPrismaJson } from "@/lib/prisma-json";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; artifactId: string }> },
) {
  try {
    const [{ id, artifactId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const artifact = await prisma.workspaceArtifact.findFirst({
      where: {
        id: artifactId,
        projectId: id,
        project: {
          userId: user.id,
        },
      },
      include: {
        currentRevision: true,
        revisions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!artifact) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Artifact not found." } }, { status: 404 });
    }

    return jsonOk(artifact);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; artifactId: string }> },
) {
  try {
    const [{ id, artifactId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const payload = await parseJson(request, workspaceArtifactUpdateSchema);

    const artifact = await prisma.workspaceArtifact.findFirst({
      where: {
        id: artifactId,
        projectId: id,
        project: {
          userId: user.id,
        },
      },
      select: {
        id: true,
        kind: true,
        artifactKey: true,
      },
    });

    if (!artifact) {
      throw new ApiError(404, "NOT_FOUND", "Artifact not found.");
    }

    if (payload.action === "rename_chapter") {
      if (artifact.kind !== "project_chapter") {
        throw new ApiError(422, "VALIDATION_ERROR", "Only project_chapter artifacts support chapter title updates.");
      }

      const result = await prisma.$transaction(async (tx) => {
        const preference = await tx.projectPreference.findUnique({
          where: {
            projectId: id,
          },
        });

        const chapterIndex = normalizeChapterIndex(preference?.chapterIndex);
        const nextChapterIndex = updateChapterIndexEntry(chapterIndex, artifactId, {
          title: payload.chapterTitle,
          updatedAt: new Date().toISOString(),
        });

        const nextPreference = await tx.projectPreference.upsert({
          where: {
            projectId: id,
          },
          update: {
            chapterIndex: toPrismaJson(nextChapterIndex),
          },
          create: {
            projectId: id,
            defaultTaskType: "workflow_check",
            ledgerEnabled: false,
            showSelfCheck: true,
            showSettlement: true,
            activeChapterArtifactId: artifactId,
            chapterIndex: toPrismaJson(nextChapterIndex),
            editorLayoutPrefs: toPrismaJson(buildDefaultEditorLayoutPrefs()),
          },
        });

        await tx.project.update({
          where: { id },
          data: { updatedAt: new Date() },
        });

        return {
          artifact,
          chapter: nextChapterIndex.find((entry) => entry.artifactId === artifactId) ?? null,
          preference: nextPreference,
        };
      });

      return jsonOk(result);
    }

    if (!["project_prompt_pack", "project_skill_pack"].includes(artifact.artifactKey)) {
      throw new ApiError(422, "VALIDATION_ERROR", "Only project overlay artifacts support direct content updates.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const revision = await tx.workspaceArtifactRevision.create({
        data: {
          artifactId: artifact.id,
          content: payload.revisionContent.trimEnd(),
          summary: payload.summary,
          acceptedByUserId: user.id,
        },
      });

      await tx.workspaceArtifact.update({
        where: { id: artifact.id },
        data: {
          currentRevisionId: revision.id,
        },
      });

      await tx.project.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return {
        artifact,
        revision,
      };
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
