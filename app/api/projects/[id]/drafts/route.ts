import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { draftCreateSchema } from "@/lib/api/schemas";
import { ApiError, jsonCreated, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import {
  buildDefaultEditorLayoutPrefs,
  countNovelWords,
  normalizeChapterIndex,
  updateChapterIndexEntry,
} from "@/lib/projects/editor-state";
import { toPrismaJson } from "@/lib/prisma-json";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const drafts = await prisma.draft.findMany({
      where: {
        projectId: id,
        project: {
          userId: user.id,
        },
      },
      include: {
        run: {
          select: {
            id: true,
            taskType: true,
            modelId: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return jsonOk({ items: drafts });
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
    const payload = await parseJson(request, draftCreateSchema);

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found.");
    }

    const targetArtifact = payload.artifactId
      ? await prisma.workspaceArtifact.findFirst({
          where: {
            id: payload.artifactId,
            projectId: id,
          },
          select: {
            id: true,
            kind: true,
          },
        })
      : null;

    if (payload.artifactId && !targetArtifact) {
      throw new ApiError(404, "NOT_FOUND", "Artifact not found.");
    }

    if (payload.draftKind === "editor_autosave" && targetArtifact?.kind !== "project_chapter") {
      throw new ApiError(422, "VALIDATION_ERROR", "editor_autosave drafts must target a project_chapter artifact.");
    }

    if (payload.runId) {
      const run = await prisma.generationRun.findFirst({
        where: {
          id: payload.runId,
          projectId: id,
        },
        select: { id: true },
      });

      if (!run) {
        throw new ApiError(404, "NOT_FOUND", "Generation run not found.");
      }
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const data: Prisma.DraftUncheckedCreateInput = {
        projectId: id,
        ...(payload.runId ? { runId: payload.runId } : {}),
        ...(payload.artifactId ? { artifactId: payload.artifactId } : {}),
        taskType: payload.taskType,
        outputContent: payload.outputContent,
        suggestedPatches: toPrismaJson(payload.suggestedPatches),
        status: payload.status,
        draftKind: payload.draftKind,
      };

      let draft;

      if (payload.draftKind === "editor_autosave" && !payload.runId) {
        const existingAutosave = await tx.draft.findFirst({
          where: {
            projectId: id,
            artifactId: payload.artifactId ?? undefined,
            draftKind: "editor_autosave",
          },
          orderBy: { updatedAt: "desc" },
        });

        if (existingAutosave) {
          draft = await tx.draft.update({
            where: { id: existingAutosave.id },
            data: {
              taskType: payload.taskType,
              outputContent: payload.outputContent,
              suggestedPatches: toPrismaJson(payload.suggestedPatches),
              status: payload.status,
            },
          });
        } else {
          draft = await tx.draft.create({ data });
        }
      } else {
        draft = await tx.draft.create({ data });
      }

      if (targetArtifact?.kind === "project_chapter") {
        const preference = await tx.projectPreference.findUnique({
          where: {
            projectId: id,
          },
        });
        const chapterIndex = normalizeChapterIndex(preference?.chapterIndex);
        const nextChapterIndex = updateChapterIndexEntry(chapterIndex, targetArtifact.id, {
          latestDraftId: draft.id,
          wordCount: countNovelWords(payload.outputContent),
          status: payload.draftKind === "editor_autosave" ? "draft" : "reviewing",
          updatedAt: now.toISOString(),
        });

        await tx.projectPreference.upsert({
          where: {
            projectId: id,
          },
          update: {
            chapterIndex: toPrismaJson(nextChapterIndex),
            activeChapterArtifactId: targetArtifact.id,
          },
          create: {
            projectId: id,
            defaultTaskType: "workflow_check",
            ledgerEnabled: false,
            showSelfCheck: true,
            showSettlement: true,
            activeChapterArtifactId: targetArtifact.id,
            chapterIndex: toPrismaJson(nextChapterIndex),
            editorLayoutPrefs: toPrismaJson(buildDefaultEditorLayoutPrefs()),
          },
        });
      }

      await tx.project.update({
        where: { id },
        data: { updatedAt: now },
      });

      return draft;
    });

    return jsonCreated(result);
  } catch (error) {
    return jsonError(error);
  }
}
