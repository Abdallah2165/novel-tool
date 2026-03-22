import { prisma } from "@/lib/db";
import { ApiError, jsonCreated, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { chapterArtifactCreateSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { createProjectChapterArtifact } from "@/lib/projects/bootstrap";
import {
  appendChapterIndexEntry,
  buildDefaultEditorLayoutPrefs,
  getNextChapterNumber,
  normalizeChapterIndex,
} from "@/lib/projects/editor-state";
import { toPrismaJson } from "@/lib/prisma-json";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const artifacts = await prisma.workspaceArtifact.findMany({
      where: {
        projectId: id,
        project: {
          userId: user.id,
        },
      },
      include: {
        currentRevision: {
          select: {
            id: true,
            summary: true,
            createdAt: true,
            content: true,
          },
        },
      },
      orderBy: [{ kind: "asc" }, { filename: "asc" }],
    });

    return jsonOk({ items: artifacts });
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
    const payload = await parseJson(request, chapterArtifactCreateSchema);

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        preference: true,
      },
    });

    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found.");
    }

    const chapterIndex = normalizeChapterIndex(project.preference?.chapterIndex);
    const nextChapterNumber = getNextChapterNumber(chapterIndex);

    const result = await prisma.$transaction(async (tx) => {
      const { artifact, chapter } = await createProjectChapterArtifact(tx, id, nextChapterNumber, payload.chapterTitle);
      const nextChapterIndex = appendChapterIndexEntry(chapterIndex, chapter);

      const preference = await tx.projectPreference.upsert({
        where: {
          projectId: id,
        },
        update: {
          chapterIndex: toPrismaJson(nextChapterIndex),
          activeChapterArtifactId: artifact.id,
        },
        create: {
          projectId: id,
          defaultTaskType: "workflow_check",
          ledgerEnabled: false,
          showSelfCheck: true,
          showSettlement: true,
          activeChapterArtifactId: artifact.id,
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
        chapter,
        preference,
      };
    });

    return jsonCreated(result);
  } catch (error) {
    return jsonError(error);
  }
}
