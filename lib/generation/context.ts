import "server-only";

import type { ReferenceDocument, WorkspaceArtifact, WorkspaceArtifactRevision } from "@prisma/client";

type ArtifactWithRevision = WorkspaceArtifact & {
  currentRevision: WorkspaceArtifactRevision | null;
};

type DraftOverlay = {
  artifactId: string;
  outputContent: string;
};

export function buildProjectContext(artifacts: ArtifactWithRevision[], draftOverlays: DraftOverlay[] = []) {
  const draftOverlayMap = new Map(
    draftOverlays
      .filter((overlay) => overlay.artifactId && overlay.outputContent.trim())
      .map((overlay) => [overlay.artifactId, overlay.outputContent.trim()]),
  );

  return artifacts
    .map((artifact) => {
      const draftOverlay = draftOverlayMap.get(artifact.id);
      const body = draftOverlay ?? artifact.currentRevision?.content?.trim() ?? "_Empty artifact_";
      const draftHeader = draftOverlay ? "\n> 使用当前 editor_autosave 草稿作为正文上下文" : "";
      return `# ${artifact.filename}${draftHeader}\n${body}`;
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
