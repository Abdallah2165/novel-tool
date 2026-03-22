import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import {
  buildDefaultEditorLayoutPrefs,
  normalizeChapterIndex,
  updateChapterIndexEntry,
} from "@/lib/projects/editor-state";
import { toPrismaJson } from "@/lib/prisma-json";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  try {
    const [{ id, draftId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const result = await prisma.$transaction(async (tx) => {
      const rejectedAt = new Date();
      const draft = await tx.draft.findFirst({
        where: {
          id: draftId,
          projectId: id,
          project: {
            userId: user.id,
          },
        },
        include: {
          artifact: {
            select: {
              id: true,
              kind: true,
              currentRevision: {
                select: {
                  sourceDraftId: true,
                },
              },
            },
          },
        },
      });

      if (!draft) {
        throw new ApiError(404, "NOT_FOUND", "Draft not found.");
      }

      const nextDraft = await tx.draft.update({
        where: { id: draft.id },
        data: {
          status: "rejected",
        },
      });

      let chapter = null;

      if (draft.artifact?.kind === "project_chapter") {
        const preference = await tx.projectPreference.findUnique({
          where: {
            projectId: id,
          },
        });
        const chapterIndex = normalizeChapterIndex(preference?.chapterIndex);
        const nextChapterIndex = updateChapterIndexEntry(chapterIndex, draft.artifact.id, {
          status: draft.artifact.currentRevision?.sourceDraftId ? "accepted" : "draft",
          updatedAt: rejectedAt.toISOString(),
        });

        await tx.projectPreference.upsert({
          where: {
            projectId: id,
          },
          update: {
            activeChapterArtifactId: draft.artifact.id,
            chapterIndex: toPrismaJson(nextChapterIndex),
          },
          create: {
            projectId: id,
            defaultTaskType: "workflow_check",
            ledgerEnabled: false,
            showSelfCheck: true,
            showSettlement: true,
            activeChapterArtifactId: draft.artifact.id,
            chapterIndex: toPrismaJson(nextChapterIndex),
            editorLayoutPrefs: toPrismaJson(buildDefaultEditorLayoutPrefs()),
          },
        });

        chapter = nextChapterIndex.find((entry) => entry.artifactId === draft.artifact?.id) ?? null;
      }

      await tx.project.update({
        where: { id },
        data: { updatedAt: rejectedAt },
      });

      return {
        draft: nextDraft,
        chapter,
      };
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
