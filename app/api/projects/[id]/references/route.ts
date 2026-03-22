import { prisma } from "@/lib/db";
import { ApiError, jsonCreated, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { referenceInputSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { deleteObject } from "@/lib/storage/object-store";
import { ingestUploadedReference } from "@/lib/references/ingest";

export const runtime = "nodejs";

async function ensureProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: { id: true },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const project = await ensureProject(id, user.id);
    if (!project) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
    }

    const items = await prisma.referenceDocument.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk({ items });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let uploadedStorageKey: string | null = null;

  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const project = await ensureProject(id, user.id);
    if (!project) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("multipart/form-data")
      ? await parseReferenceUpload(request, id)
      : await parseJson(request, referenceInputSchema);

    uploadedStorageKey = payload.storageKey ?? null;

    const reference = await prisma.referenceDocument.create({
      data: {
        projectId: id,
        ...payload,
      },
    });

    return jsonCreated(reference);
  } catch (error) {
    if (uploadedStorageKey) {
      await deleteObject(uploadedStorageKey).catch(() => undefined);
    }

    return jsonError(error);
  }
}

function parseTagList(rawValues: FormDataEntryValue[]) {
  const tags = rawValues.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }

    return entry
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });

  return Array.from(new Set(tags));
}

async function parseReferenceUpload(request: Request, projectId: string) {
  const formData = await request.formData();
  const file = formData.get("file");
  const sourceUrlValue = formData.get("sourceUrl");
  const sourceUrl = typeof sourceUrlValue === "string" ? sourceUrlValue.trim() : "";

  if (!(file instanceof File)) {
    throw new ApiError(422, "VALIDATION_ERROR", "A reference file is required.");
  }

  if (sourceUrl) {
    try {
      // Reuse URL validation instead of trusting browser-side input validation.
      new URL(sourceUrl);
    } catch {
      throw new ApiError(422, "VALIDATION_ERROR", "Reference sourceUrl must be a valid URL.");
    }
  }

  const tags = parseTagList([...formData.getAll("tags"), ...formData.getAll("tags[]")]);

  return ingestUploadedReference({
    projectId,
    file,
    sourceUrl: sourceUrl || undefined,
    tags,
  });
}
