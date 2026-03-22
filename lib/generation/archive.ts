const DEFAULT_GENERATION_ARCHIVE_THRESHOLD_BYTES = 12 * 1024;
const GENERATION_ARCHIVE_CONTENT_TYPE = "application/json; charset=utf-8";

type GenerationArchiveInput = {
  projectId: string;
  runId: string;
  taskType: string;
  endpointId: string;
  modelId: string;
  resolvedPrompt: string;
  resolvedSkills: unknown;
  resolvedContextArtifacts: unknown;
  toolCallsSummary: unknown;
  usage: unknown;
  output: string;
  suggestedPatches: unknown;
  targetArtifactId?: string | null;
  externalSearchTrace?: {
    sessionId: string;
    createdAt: string;
    requestPayload: unknown;
    responsePayload: unknown;
    sourceItems: unknown;
  } | null;
};

export type GenerationArchiveCandidate = {
  body: Buffer;
  byteSize: number;
  contentType: string;
  key: string;
};

export function getGenerationArchiveThresholdBytes() {
  return DEFAULT_GENERATION_ARCHIVE_THRESHOLD_BYTES;
}

export function buildGenerationArchiveDownloadPath(projectId: string, runId: string) {
  return `/projects/${projectId}/runs/${runId}/archive`;
}

function buildGenerationArchiveKey(projectId: string, runId: string) {
  return `projects/${projectId}/generation-runs/${runId}/result.json`;
}

export function buildGenerationArchiveCandidate(
  input: GenerationArchiveInput,
  thresholdBytes = DEFAULT_GENERATION_ARCHIVE_THRESHOLD_BYTES,
): GenerationArchiveCandidate | null {
  const payload = {
    version: 1,
    archivedAt: new Date().toISOString(),
    run: {
      id: input.runId,
      projectId: input.projectId,
      taskType: input.taskType,
      endpointId: input.endpointId,
      modelId: input.modelId,
      targetArtifactId: input.targetArtifactId ?? null,
      resolvedPrompt: input.resolvedPrompt,
      resolvedSkills: input.resolvedSkills,
      resolvedContextArtifacts: input.resolvedContextArtifacts,
      toolCallsSummary: input.toolCallsSummary ?? null,
      externalSearchTrace: input.externalSearchTrace ?? null,
      usage: input.usage ?? null,
    },
    draft: {
      outputContent: input.output,
      suggestedPatches: input.suggestedPatches,
    },
  };

  const body = Buffer.from(JSON.stringify(payload, null, 2), "utf8");

  if (body.byteLength < thresholdBytes) {
    return null;
  }

  return {
    key: buildGenerationArchiveKey(input.projectId, input.runId),
    body,
    byteSize: body.byteLength,
    contentType: GENERATION_ARCHIVE_CONTENT_TYPE,
  };
}
