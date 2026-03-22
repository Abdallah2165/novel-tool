import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";

import { ApiError } from "@/lib/api/http";
import { putObject } from "@/lib/storage/object-store";
import type { ReferenceSourceType } from "@/lib/types/domain";

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const TEXT_EXTENSIONS = new Set([".txt"]);

type ExtractedReferenceContent = {
  sourceType: ReferenceSourceType;
  extractionMethod: string;
  extractedText: string;
  normalizedText: string;
};

type IngestUploadedReferenceInput = {
  projectId: string;
  file: File;
  tags: string[];
  sourceUrl?: string;
};

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    mdash: "-",
    ndash: "-",
    hellip: "...",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = String(entity).toLowerCase();

    if (normalized.startsWith("#x")) {
      const value = Number.parseInt(normalized.slice(2), 16);
      return Number.isNaN(value) ? match : String.fromCodePoint(value);
    }

    if (normalized.startsWith("#")) {
      const value = Number.parseInt(normalized.slice(1), 10);
      return Number.isNaN(value) ? match : String.fromCodePoint(value);
    }

    return namedEntities[normalized] ?? match;
  });
}

function stripHtmlToReadableText(value: string) {
  const withoutScripts = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  const withBlockSpacing = withoutScripts
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|br|tr|table|blockquote)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n");

  const withoutTags = withBlockSpacing.replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeHtmlEntities(withoutTags));
}

function resolveSourceType(filename: string, mimeType: string): ReferenceSourceType {
  const extension = path.extname(filename).toLowerCase();

  if (MARKDOWN_EXTENSIONS.has(extension) || mimeType.includes("markdown")) {
    return "markdown";
  }

  if (HTML_EXTENSIONS.has(extension) || mimeType.includes("html")) {
    return "html_static_topic";
  }

  if (TEXT_EXTENSIONS.has(extension) || mimeType.startsWith("text/")) {
    return "txt";
  }

  throw new ApiError(422, "VALIDATION_ERROR", "Only .txt, .md, and .html reference files are supported.");
}

function resolveMimeType(filename: string, declaredType?: string) {
  if (declaredType?.trim()) {
    return declaredType;
  }

  const extension = path.extname(filename).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return "text/markdown";
  }

  if (HTML_EXTENSIONS.has(extension)) {
    return "text/html";
  }

  return "text/plain";
}

function extractReferenceContent(sourceType: ReferenceSourceType, rawText: string): ExtractedReferenceContent {
  if (sourceType === "html_static_topic") {
    const extractedText = stripHtmlToReadableText(rawText);
    return {
      sourceType,
      extractionMethod: "html:readable_text",
      extractedText,
      normalizedText: extractedText,
    };
  }

  const extractedText = normalizeWhitespace(rawText);
  return {
    sourceType,
    extractionMethod: sourceType === "markdown" ? "markdown:utf8" : "text:utf8",
    extractedText,
    normalizedText: extractedText,
  };
}

function buildStorageKey(projectId: string, filename: string) {
  const extension = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, extension);
  const slug = basename
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `projects/${projectId}/references/${Date.now()}-${randomUUID()}-${slug || "reference"}${extension}`;
}

export async function ingestUploadedReference(input: IngestUploadedReferenceInput) {
  if (!(input.file instanceof File)) {
    throw new ApiError(422, "VALIDATION_ERROR", "A reference file is required.");
  }

  if (!input.file.name.trim()) {
    throw new ApiError(422, "VALIDATION_ERROR", "Reference filename is required.");
  }

  const mimeType = resolveMimeType(input.file.name, input.file.type);
  const sourceType = resolveSourceType(input.file.name, mimeType);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const rawText = buffer.toString("utf8");
  const extracted = extractReferenceContent(sourceType, rawText);
  const storageKey = buildStorageKey(input.projectId, input.file.name);

  await putObject({
    key: storageKey,
    body: buffer,
    contentType: mimeType,
    metadata: {
      projectId: input.projectId,
      sourceType,
    },
  });

  return {
    filename: input.file.name,
    mimeType,
    sourceType,
    storageKey,
    sourceUrl: input.sourceUrl,
    extractionMethod: extracted.extractionMethod,
    extractedText: extracted.extractedText,
    normalizedText: extracted.normalizedText,
    tags: input.tags,
  };
}
