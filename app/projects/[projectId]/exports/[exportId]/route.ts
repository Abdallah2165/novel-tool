import { prisma } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/api/http";
import { resolveRequestUser } from "@/lib/auth/identity";
import { normalizeProjectExportRecords } from "@/lib/projects/export-bundles";
import { readObject } from "@/lib/storage/object-store";

export const runtime = "nodejs";

function buildAttachmentDisposition(fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "");
  return `attachment; filename="${asciiFallback || "export.md"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; exportId: string }> },
) {
  try {
    const [{ projectId, exportId }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      select: {
        id: true,
        preference: {
          select: {
            exportRecords: true,
          },
        },
      },
    });

    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found.");
    }

    const record = normalizeProjectExportRecords(project.preference?.exportRecords).find((item) => item.id === exportId);

    if (!record) {
      throw new ApiError(404, "NOT_FOUND", "Export record not found.");
    }

    const body = await readObject(record.storageKey).catch((error) => {
      if (isMissingObjectError(error)) {
        throw new ApiError(404, "NOT_FOUND", "Export object not found.");
      }

      throw error;
    });

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": record.contentType,
        "content-length": String(body.byteLength),
        "content-disposition": buildAttachmentDisposition(record.fileName),
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
