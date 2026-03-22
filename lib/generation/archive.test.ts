import { describe, expect, it } from "vitest";

import { buildGenerationArchiveCandidate, getGenerationArchiveThresholdBytes } from "./archive";

describe("buildGenerationArchiveCandidate", () => {
  it("returns null when payload is below the archive threshold", () => {
    const candidate = buildGenerationArchiveCandidate(
      {
        projectId: "project-1",
        runId: "run-1",
        taskType: "workflow_check",
        endpointId: "endpoint-1",
        modelId: "model-1",
        resolvedPrompt: "short prompt",
        resolvedSkills: [{ name: "planner" }],
        resolvedContextArtifacts: [],
        toolCallsSummary: null,
        usage: { outputTokens: 8 },
        output: "短输出",
        suggestedPatches: [],
        targetArtifactId: null,
      },
      10_000,
    );

    expect(candidate).toBeNull();
  });

  it("builds an object-store archive when payload exceeds the threshold", () => {
    const repeatedOutput = "港口账册".repeat(2_000);
    const candidate = buildGenerationArchiveCandidate(
      {
        projectId: "project-1",
        runId: "run-1",
        taskType: "generate_setting",
        endpointId: "endpoint-1",
        modelId: "model-1",
        resolvedPrompt: "请输出完整设定。",
        resolvedSkills: [{ name: "setting_architect" }],
        resolvedContextArtifacts: [{ id: "artifact-1", artifactKey: "world_bible" }],
        toolCallsSummary: { externalSearch: { status: "ok" } },
        usage: { outputTokens: 2048 },
        output: repeatedOutput,
        suggestedPatches: ["world_bible.md"],
        targetArtifactId: "artifact-1",
        externalSearchTrace: {
          sessionId: "session-1",
          createdAt: "2026-03-22T12:00:00.000Z",
          requestPayload: {
            query: "查证 19 世纪港口条例",
          },
          responsePayload: {
            content: "港口条例要求夜间登记。",
          },
          sourceItems: [
            {
              title: "港口条例",
              url: "https://example.com/port-rule",
              snippet: "夜间靠岸需补录登记。",
            },
          ],
        },
      },
      1_024,
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.key).toBe("projects/project-1/generation-runs/run-1/result.json");
    expect(candidate?.contentType).toBe("application/json; charset=utf-8");
    expect(candidate?.byteSize).toBeGreaterThan(1_024);

    const parsed = JSON.parse(candidate!.body.toString("utf8"));
    expect(parsed.run.id).toBe("run-1");
    expect(parsed.run.targetArtifactId).toBe("artifact-1");
    expect(parsed.run.externalSearchTrace).toMatchObject({
      sessionId: "session-1",
      requestPayload: {
        query: "查证 19 世纪港口条例",
      },
    });
    expect(parsed.draft.outputContent).toBe(repeatedOutput);
  });

  it("exports a stable default threshold", () => {
    expect(getGenerationArchiveThresholdBytes()).toBe(12 * 1024);
  });
});
