import { describe, expect, it } from "vitest";

import { buildProjectExportBundles, normalizeProjectExportRecords } from "@/lib/projects/export-bundles";

describe("project export bundle helpers", () => {
  it("builds the three export bundle groups from current accepted revisions", () => {
    const bundles = buildProjectExportBundles({
      projectName: "演示项目",
      exportedAt: "2026-03-21T08:00:00.000Z",
      chapterIndex: [
        {
          chapterId: "chapter_001",
          chapterNumber: "第1章",
          title: "风雪夜归人",
          artifactId: "artifact-chapter-1",
          latestDraftId: null,
          wordCount: 3200,
          status: "accepted",
          updatedAt: "2026-03-21T07:00:00.000Z",
        },
      ],
      artifacts: [
        {
          id: "artifact-chapter-1",
          artifactKey: "chapter_001",
          filename: "chapter_001.md",
          kind: "project_chapter",
          currentRevision: {
            content: "# 第一章\n\n正文",
          },
        },
        {
          id: "artifact-setting-1",
          artifactKey: "story_background",
          filename: "story_background.md",
          kind: "project_setting",
          currentRevision: {
            content: "# 背景设定",
          },
        },
        {
          id: "artifact-state-1",
          artifactKey: "current_state_card",
          filename: "99_当前状态卡.md",
          kind: "project_state",
          currentRevision: {
            content: "# 当前状态",
          },
        },
      ],
    });

    expect(bundles).toHaveLength(3);
    expect(bundles[0]).toMatchObject({
      key: "chapters",
      fileCount: 1,
      files: ["chapter_001.md"],
      sourceArtifactKeys: ["chapter_001"],
    });
    expect(bundles[1]).toMatchObject({
      key: "setting-outline",
      fileCount: 1,
      files: ["story_background.md"],
      sourceArtifactKeys: ["story_background"],
    });
    expect(bundles[2]).toMatchObject({
      key: "state-summary",
      fileCount: 1,
      files: ["99_当前状态卡.md"],
      sourceArtifactKeys: ["current_state_card"],
    });
    expect(bundles[0].content).toContain("Exported At: 2026-03-21T08:00:00.000Z");
  });

  it("keeps public export bundles free of provenance appendices", () => {
    const bundles = buildProjectExportBundles({
      projectName: "演示项目",
      exportedAt: "2026-03-21T08:00:00.000Z",
      chapterIndex: [
        {
          chapterId: "chapter_001",
          chapterNumber: "第1章",
          title: "风雪夜归人",
          artifactId: "artifact-chapter-1",
          latestDraftId: null,
          wordCount: 3200,
          status: "accepted",
          updatedAt: "2026-03-21T07:00:00.000Z",
        },
      ],
      artifacts: [
        {
          id: "artifact-chapter-1",
          artifactKey: "chapter_001",
          filename: "chapter_001.md",
          kind: "project_chapter",
          currentRevision: {
            content: "# 第一章\n\n正文",
          },
        },
      ],
    });

    expect(bundles[0].content).not.toContain("## Knowledge Provenance Snapshot");
    expect(bundles[0].content).not.toContain("Source Trace");
  });

  it("filters invalid export records and sorts newest first", () => {
    const records = normalizeProjectExportRecords([
      {
        id: "older",
        bundleKey: "chapters",
        title: "旧记录",
        fileName: "old.md",
        storageKey: "projects/a/old.md",
        contentType: "text/markdown; charset=utf-8",
        byteSize: 20,
        fileCount: 1,
        files: ["old.md"],
        sourceArtifactKeys: ["chapter_001"],
        exportedAt: "2026-03-20T08:00:00.000Z",
        objectStoreMode: "local",
      },
      {
        id: "newer",
        bundleKey: "state-summary",
        title: "新记录",
        fileName: "new.md",
        storageKey: "projects/a/new.md",
        contentType: "text/markdown; charset=utf-8",
        byteSize: 30,
        fileCount: 1,
        files: ["new.md"],
        sourceArtifactKeys: ["current_state_card"],
        exportedAt: "2026-03-21T08:00:00.000Z",
        objectStoreMode: "s3",
      },
      {
        id: "broken",
        bundleKey: "invalid",
      },
    ]);

    expect(records.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("adds recent GrokSearch source snapshots to the state summary bundle", () => {
    const bundles = buildProjectExportBundles({
      projectName: "演示项目",
      exportedAt: "2026-03-22T09:00:00.000Z",
      chapterIndex: [],
      artifacts: [
        {
          id: "artifact-state-1",
          artifactKey: "current_state_card",
          filename: "99_当前状态卡.md",
          kind: "project_state",
          currentRevision: {
            content: "# 当前状态\n\n主角已抵达港口。",
          },
        },
      ],
      externalSearchTraces: [
        {
          sessionId: "session-1",
          toolName: "web_search",
          createdAt: "2026-03-22T08:30:00.000Z",
          requestPayload: {
            query: "19 世纪港口夜间条例",
          },
          responsePayload: {
            content: "夜间到港通常需要补录值守登记。",
          },
          sourceItems: [
            {
              title: "港口条例史料",
              url: "https://example.com/port-rule",
              snippet: "夜间靠岸需补录值守登记。",
            },
          ],
        },
      ],
    });

    expect(bundles[2].content).toContain("## External Research Snapshot");
    expect(bundles[2].content).toContain("### 检索留档 1");
    expect(bundles[2].content).toContain("会话 ID：session-1");
    expect(bundles[2].content).toContain("检索问题：19 世纪港口夜间条例");
    expect(bundles[2].content).toContain("港口条例史料 | https://example.com/port-rule | 夜间靠岸需补录值守登记。");
  });
});
