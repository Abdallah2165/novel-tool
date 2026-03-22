import { prisma } from "@/lib/db";
import { draftAcceptSchema } from "@/lib/api/schemas";
import { ApiError, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { appendAcceptLog, applyCurrentStateSync } from "@/lib/drafts/accept";
import {
  buildDefaultEditorLayoutPrefs,
  countNovelWords,
  normalizeChapterIndex,
  updateChapterIndexEntry,
} from "@/lib/projects/editor-state";
import { toPrismaJson } from "@/lib/prisma-json";

const ACCEPT_SYNC_ARTIFACT_KEYS = ["progress", "current_state_card"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> },
) {
  try {
    const [{ id, draftId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const payload = await parseJson(request, draftAcceptSchema);

    const result = await prisma.$transaction(async (tx) => {
      const acceptedAt = new Date();
      const draft = await tx.draft.findFirst({
        where: {
          id: draftId,
          projectId: id,
          project: {
            userId: user.id,
          },
        },
      });

      if (!draft) {
        throw new Error("Draft not found.");
      }

      if (draft.draftKind === "editor_autosave" || !draft.runId) {
        throw new ApiError(422, "VALIDATION_ERROR", "editor_autosave drafts cannot be accepted into revisions.");
      }

      if (draft.artifactId && draft.artifactId !== payload.artifactId) {
        throw new ApiError(422, "VALIDATION_ERROR", "This draft is already bound to another artifact.");
      }

      const artifact = await tx.workspaceArtifact.findFirst({
        where: {
          id: payload.artifactId,
          projectId: id,
        },
        include: {
          currentRevision: true,
        },
      });

      const syncArtifacts = await tx.workspaceArtifact.findMany({
        where: {
          projectId: id,
          artifactKey: {
            in: [...ACCEPT_SYNC_ARTIFACT_KEYS],
          },
        },
        include: {
          currentRevision: true,
        },
      });

      if (!artifact) {
        throw new Error("Artifact not found.");
      }

      const acceptContext = {
        acceptedAt,
        artifactFilename: artifact.filename,
        taskType: draft.taskType,
        summary: payload.summary,
        draftId: draft.id,
        runId: draft.runId,
      };

      const acceptedContent =
        artifact.artifactKey === "progress"
          ? appendAcceptLog(draft.outputContent, acceptContext)
          : artifact.artifactKey === "current_state_card"
            ? applyCurrentStateSync(draft.outputContent, acceptContext)
            : draft.outputContent;

      const revision = await tx.workspaceArtifactRevision.create({
        data: {
          artifactId: artifact.id,
          content: acceptedContent,
          summary: payload.summary,
          sourceDraftId: draft.id,
          sourceRunId: draft.runId,
          acceptedByUserId: user.id,
        },
      });

      await tx.workspaceArtifact.update({
        where: { id: artifact.id },
        data: { currentRevisionId: revision.id },
      });

      const syncedArtifacts = [] as Array<{ artifactId: string; artifactKey: string; revisionId: string }>;

      for (const syncArtifact of syncArtifacts) {
        if (syncArtifact.id === artifact.id) {
          continue;
        }

        const nextContent =
          syncArtifact.artifactKey === "progress"
            ? appendAcceptLog(syncArtifact.currentRevision?.content, acceptContext)
            : applyCurrentStateSync(syncArtifact.currentRevision?.content, acceptContext);

        const syncRevision = await tx.workspaceArtifactRevision.create({
          data: {
            artifactId: syncArtifact.id,
            content: nextContent,
            summary: `Auto sync after accepting ${artifact.filename}`,
            sourceDraftId: draft.id,
            sourceRunId: draft.runId,
            acceptedByUserId: user.id,
          },
        });

        await tx.workspaceArtifact.update({
          where: { id: syncArtifact.id },
          data: { currentRevisionId: syncRevision.id },
        });

        syncedArtifacts.push({
          artifactId: syncArtifact.id,
          artifactKey: syncArtifact.artifactKey,
          revisionId: syncRevision.id,
        });
      }

      let chapter = null;

      if (artifact.kind === "project_chapter") {
        const preference = await tx.projectPreference.findUnique({
          where: {
            projectId: id,
          },
        });
        const chapterIndex = normalizeChapterIndex(preference?.chapterIndex);
        const nextChapterIndex = updateChapterIndexEntry(chapterIndex, artifact.id, {
          latestDraftId: draft.id,
          wordCount: countNovelWords(acceptedContent),
          status: "accepted",
          updatedAt: acceptedAt.toISOString(),
        });

        await tx.projectPreference.upsert({
          where: {
            projectId: id,
          },
          update: {
            activeChapterArtifactId: artifact.id,
            chapterIndex: toPrismaJson(nextChapterIndex),
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

        chapter = nextChapterIndex.find((entry) => entry.artifactId === artifact.id) ?? null;
      }

      await tx.draft.update({
        where: { id: draft.id },
        data: { status: "accepted" },
      });

      const project = await tx.project.update({
        where: { id },
        data: { updatedAt: acceptedAt },
        select: { updatedAt: true },
      });

      return {
        ...revision,
        chapter,
        syncedArtifacts,
        projectUpdatedAt: project.updatedAt,
      };
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
