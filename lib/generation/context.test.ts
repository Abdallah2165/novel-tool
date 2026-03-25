import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("generation context helpers", () => {
  it("builds project context from current revisions and fills empty artifacts with a placeholder", async () => {
    const { buildProjectContext } = await import("./context");

    const context = buildProjectContext([
      {
        id: "artifact-1",
        projectId: "project-1",
        artifactKey: "writing_rules",
        filename: "writing_rules.md",
        kind: "project_setting",
        currentRevisionId: "rev-1",
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        currentRevision: {
          id: "rev-1",
          artifactId: "artifact-1",
          content: "  保持人物动机一致。  ",
          summary: "seed",
          sourceDraftId: null,
          sourceRunId: null,
          acceptedByUserId: null,
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      },
      {
        id: "artifact-2",
        projectId: "project-1",
        artifactKey: "current_state_card",
        filename: "99_当前状态卡.md",
        kind: "project_state",
        currentRevisionId: null,
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        currentRevision: null,
      },
    ] as never);

    expect(context).toContain("# writing_rules.md\n保持人物动机一致。");
    expect(context).toContain("# 99_当前状态卡.md\n_Empty artifact_");
  });

  it("prefers chapter autosave draft overlays when provided", async () => {
    const { buildProjectContext } = await import("./context");

    const context = buildProjectContext(
      [
        {
          id: "artifact-1",
          projectId: "project-1",
          artifactKey: "chapter_001",
          filename: "chapter_001.md",
          kind: "project_chapter",
          currentRevisionId: "rev-1",
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
          updatedAt: new Date("2026-03-20T00:00:00.000Z"),
          currentRevision: {
            id: "rev-1",
            artifactId: "artifact-1",
            content: "正式稿",
            summary: "seed",
            sourceDraftId: null,
            sourceRunId: null,
            acceptedByUserId: null,
            createdAt: new Date("2026-03-20T00:00:00.000Z"),
          },
        },
      ] as never,
      [
        {
          artifactId: "artifact-1",
          outputContent: "章节 autosave 草稿",
        },
      ],
    );

    expect(context).toContain("# chapter_001.md\n> 使用当前 editor_autosave 草稿作为正文上下文\n章节 autosave 草稿");
    expect(context).not.toContain("正式稿");
  });

  it("prefers normalized reference text and falls back to extracted text", async () => {
    const { buildSelectedReferences } = await import("./context");

    const references = buildSelectedReferences([
      {
        id: "ref-1",
        projectId: "project-1",
        filename: "trade.md",
        sourceType: "markdown",
        mimeType: "text/markdown",
        storageKey: null,
        sourceUrl: null,
        extractionMethod: null,
        extractedText: "旧摘取文本",
        normalizedText: "标准化后的贸易记录",
        tags: [],
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
      },
      {
        id: "ref-2",
        projectId: "project-1",
        filename: "harbor.txt",
        sourceType: "txt",
        mimeType: "text/plain",
        storageKey: null,
        sourceUrl: null,
        extractionMethod: null,
        extractedText: "港口秋季船期更密。",
        normalizedText: null,
        tags: [],
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
      },
    ] as never);

    expect(references).toContain("# trade.md\n标准化后的贸易记录");
    expect(references).toContain("# harbor.txt\n港口秋季船期更密。");
  });

  it("truncates oversized project context to keep generation requests stable", async () => {
    const { buildProjectContext } = await import("./context");

    const oversized = "设定".repeat(4000);
    const context = buildProjectContext([
      {
        id: "artifact-1",
        projectId: "project-1",
        artifactKey: "world_bible",
        filename: "world_bible.md",
        kind: "project_setting",
        currentRevisionId: "rev-1",
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        currentRevision: {
          id: "rev-1",
          artifactId: "artifact-1",
          content: oversized,
          summary: "seed",
          sourceDraftId: null,
          sourceRunId: null,
          acceptedByUserId: null,
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      },
      {
        id: "artifact-2",
        projectId: "project-1",
        artifactKey: "task_plan",
        filename: "task_plan.md",
        kind: "project_setting",
        currentRevisionId: "rev-2",
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        currentRevision: {
          id: "rev-2",
          artifactId: "artifact-2",
          content: oversized,
          summary: "seed",
          sourceDraftId: null,
          sourceRunId: null,
          acceptedByUserId: null,
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      },
      {
        id: "artifact-3",
        projectId: "project-1",
        artifactKey: "findings",
        filename: "findings.md",
        kind: "project_setting",
        currentRevisionId: "rev-3",
        createdAt: new Date("2026-03-20T00:00:00.000Z"),
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
        currentRevision: {
          id: "rev-3",
          artifactId: "artifact-3",
          content: oversized,
          summary: "seed",
          sourceDraftId: null,
          sourceRunId: null,
          acceptedByUserId: null,
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      },
    ] as never);

    expect(context).toContain("# world_bible.md");
    expect(context).toContain("# task_plan.md");
    expect(context).toContain("# findings.md");
    expect(context).toContain("[已截断，避免项目文件上下文过长导致生成失败]");
    expect(context.length).toBeLessThan(19000);
  });

  it('returns "无" when no references are selected', async () => {
    const { buildSelectedReferences } = await import("./context");

    expect(buildSelectedReferences([])).toBe("无");
  });
});
