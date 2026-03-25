import "server-only";

import type { ReferenceDocument, WorkspaceArtifact, WorkspaceArtifactRevision } from "@prisma/client";

type ArtifactWithRevision = WorkspaceArtifact & {
  currentRevision: WorkspaceArtifactRevision | null;
};

type DraftOverlay = {
  artifactId: string;
  outputContent: string;
};

const MAX_ARTIFACT_CONTEXT_CHARS_TOTAL = 18000;
const MAX_ARTIFACT_CONTEXT_CHARS_PER_FILE = 6000;
const TRUNCATION_NOTICE = "\n\n[已截断，避免项目文件上下文过长导致生成失败]";

function trimArtifactContext(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}${TRUNCATION_NOTICE}`;
}

export function buildProjectContext(artifacts: ArtifactWithRevision[], draftOverlays: DraftOverlay[] = []) {
  const draftOverlayMap = new Map(
    draftOverlays
      .filter((overlay) => overlay.artifactId && overlay.outputContent.trim())
      .map((overlay) => [overlay.artifactId, overlay.outputContent.trim()]),
  );
  let remainingBudget = MAX_ARTIFACT_CONTEXT_CHARS_TOTAL;

  return artifacts
    .map((artifact) => {
      const draftOverlay = draftOverlayMap.get(artifact.id);
      const rawBody = draftOverlay ?? artifact.currentRevision?.content?.trim() ?? "_Empty artifact_";
      const perFileTrimmed = trimArtifactContext(rawBody, MAX_ARTIFACT_CONTEXT_CHARS_PER_FILE);
      const budgetedBody =
        remainingBudget > 0 ? trimArtifactContext(perFileTrimmed, remainingBudget) : "[已跳过，避免项目文件上下文过长导致生成失败]";

      remainingBudget = Math.max(remainingBudget - budgetedBody.length, 0);

      const draftHeader = draftOverlay ? "\n> 使用当前 editor_autosave 草稿作为正文上下文" : "";
      return `# ${artifact.filename}${draftHeader}\n${budgetedBody}`;
    })
    .join("\n\n");
}

export function buildSelectedReferences(references: ReferenceDocument[]) {
  if (!references.length) {
    return "无";
  }

  return references
    .map((reference) => `# ${reference.filename}\n${reference.normalizedText ?? reference.extractedText ?? ""}`.trim())
    .join("\n\n");
}
