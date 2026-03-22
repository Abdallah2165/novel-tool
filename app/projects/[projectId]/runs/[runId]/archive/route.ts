import { prisma } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { readObject } from "@/lib/storage/object-store";

export const runtime = "nodejs";

function buildAttachmentDisposition(fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "");
  return `attachment; filename="${asciiFallback || "generation-run.json"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function isMissingObjectError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = String(Reflect.get(error, "code") ?? "");
  const name = String(Reflect.get(error, "name") ?? "");
  const message = String(Reflect.get(error, "message") ?? "").toLowerCase();

  return (
    code === "ENOENT" ||
    name === "NoSuchKey" ||
    name === "NotFound" ||
    message.includes("no such key") ||
    message.includes("not found")
  );
}

function buildArchiveFileName(projectName: string, taskType: string, createdAt: Date) {
  const timestamp = createdAt.toISOString().replace(/[:]/g, "-");
  const safeProjectName = projectName.replace(/[\\/:*?"<>|]+/g, "_").trim() || "project";
  return `${safeProjectName}_${taskType}_${timestamp}.json`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) {
  try {
    const [{ projectId, runId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const run = await prisma.generationRun.findFirst({
      where: {
        id: runId,
        projectId,
        project: {
          userId: user.id,
        },
      },
      select: {
        id: true,
        taskType: true,
        createdAt: true,
        archiveStorageKey: true,
        archiveContentType: true,
        project: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!run) {
      throw new ApiError(404, "NOT_FOUND", "Run not found.");
    }

    if (!run.archiveStorageKey) {
      throw new ApiError(404, "NOT_FOUND", "Generation archive not found.");
    }

    const body = await readObject(run.archiveStorageKey).catch((error) => {
      if (isMissingObjectError(error)) {
        throw new ApiError(404, "NOT_FOUND", "Generation archive object not found.");
      }

      throw error;
    });

    const fileName = buildArchiveFileName(run.project.name, run.taskType, run.createdAt);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": run.archiveContentType ?? "application/json; charset=utf-8",
        "content-length": String(body.byteLength),
        "content-disposition": buildAttachmentDisposition(fileName),
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
