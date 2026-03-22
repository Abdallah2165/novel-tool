import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { ApiError, jsonCreated, jsonError, parseJson } from "@/lib/api/http";
import { exportRequestSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { buildDefaultEditorLayoutPrefs, normalizeChapterIndex } from "@/lib/projects/editor-state";
import {
  buildProjectExportBundles,
  buildProjectExportDownloadPath,
  normalizeProjectExportRecords,
  PROJECT_EXPORT_RECORD_LIMIT,
} from "@/lib/projects/export-bundles";
import { toPrismaJson } from "@/lib/prisma-json";
import { deleteObject, putObject } from "@/lib/storage/object-store";

export const runtime = "nodejs";

const EXPORT_CONTENT_TYPE = "text/markdown; charset=utf-8";

function buildExportStorageKey(projectId: string, exportId: string, fileName: string) {
  const safeFileName = fileName.replace(/[^\w.\u4e00-\u9fa5-]+/g, "_");
  return `projects/${projectId}/exports/${exportId}/${safeFileName}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let createdStorageKey: string | null = null;

  try {
    const [{ projectId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const payload = await parseJson(request, exportRequestSchema);

    const [project, grokSearchTraces] = await Promise.all([
      prisma.project.findFirst({
        where: {
          id: projectId,
          userId: user.id,
        },
        include: {
          preference: true,
          artifacts: {
            include: {
              currentRevision: true,
            },
            orderBy: [{ kind: "asc" }, { filename: "asc" }],
          },
        },
      }),
      payload.bundleKey === "state-summary"
        ? prisma.grokSearchTrace.findMany({
            where: {
              projectId,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 3,
            select: {
              sessionId: true,
              toolName: true,
              createdAt: true,
              requestPayload: true,
              responsePayload: true,
              sourceItems: true,
            },
          })
        : Promise.resolve([]),
    ]);

    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found.");
    }

    const exportedAt = new Date().toISOString();
    const bundle = buildProjectExportBundles({
      projectName: project.name,
      chapterIndex: normalizeChapterIndex(project.preference?.chapterIndex),
      artifacts: project.artifacts,
      exportedAt,
      externalSearchTraces: grokSearchTraces.map((trace) => ({
        sessionId: trace.sessionId,
        toolName: trace.toolName,
        createdAt: trace.createdAt.toISOString(),
        requestPayload: trace.requestPayload,
        responsePayload: trace.responsePayload,
        sourceItems: trace.sourceItems,
      })),
    }).find((item) => item.key === payload.bundleKey);

    if (!bundle || bundle.fileCount === 0) {
      throw new ApiError(422, "VALIDATION_ERROR", "当前导出分组还没有可归档的 accepted revision。");
    }

    const exportId = randomUUID();
    const storageKey = buildExportStorageKey(projectId, exportId, bundle.fileName);
    createdStorageKey = storageKey;

    const body = Buffer.from(bundle.content, "utf8");
    const storedObject = await putObject({
      key: storageKey,
      body,
      contentType: EXPORT_CONTENT_TYPE,
      metadata: {
        projectId,
        bundleKey: bundle.key,
        exportId,
      },
    });

    const record = {
      id: exportId,
      bundleKey: bundle.key,
      title: bundle.title,
      fileName: bundle.fileName,
      storageKey: storedObject.key,
      contentType: EXPORT_CONTENT_TYPE,
      byteSize: body.byteLength,
      fileCount: bundle.fileCount,
      files: bundle.files,
      sourceArtifactKeys: bundle.sourceArtifactKeys,
      exportedAt,
      objectStoreMode: storedObject.mode,
    } as const;

    const previousRecords = normalizeProjectExportRecords(project.preference?.exportRecords);
    const nextRecords = [record, ...previousRecords].slice(0, PROJECT_EXPORT_RECORD_LIMIT);
    const removedRecords = previousRecords.filter(
      (item) => !nextRecords.some((candidate) => candidate.id === item.id),
    );

    await prisma.projectPreference.upsert({
      where: {
        projectId,
      },
      update: {
        exportRecords: toPrismaJson(nextRecords),
      },
      create: {
        projectId,
        defaultTaskType: "workflow_check",
        apiPresets: toPrismaJson([]),
        exportRecords: toPrismaJson(nextRecords),
        ledgerEnabled: false,
        showSelfCheck: true,
        showSettlement: true,
        activeChapterArtifactId: null,
        chapterIndex: toPrismaJson([]),
        editorLayoutPrefs: toPrismaJson(buildDefaultEditorLayoutPrefs()),
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    await Promise.allSettled(removedRecords.map((item) => deleteObject(item.storageKey)));

    return jsonCreated({
      record,
      downloadUrl: buildProjectExportDownloadPath(projectId, record.id),
    });
  } catch (error) {
    if (createdStorageKey) {
      await deleteObject(createdStorageKey).catch(() => undefined);
    }

    return jsonError(error);
  }
}
