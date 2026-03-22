import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  projectPreference: {
    upsert: vi.fn(),
  },
  grokSearchTrace: {
    findMany: vi.fn(),
  },
};

const resolveRequestUserMock = vi.fn();
const putObjectMock = vi.fn();
const deleteObjectMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/storage/object-store", () => ({
  putObject: putObjectMock,
  deleteObject: deleteObjectMock,
}));

describe("project export route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.project.findFirst.mockReset();
    prismaMock.project.update.mockReset();
    prismaMock.projectPreference.upsert.mockReset();
    prismaMock.grokSearchTrace.findMany.mockReset();
    resolveRequestUserMock.mockReset();
    putObjectMock.mockReset();
    deleteObjectMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
    putObjectMock.mockResolvedValue({
      key: "projects/project-1/exports/export-1/demo.md",
      mode: "local",
    });
    prismaMock.project.update.mockResolvedValue({ id: "project-1" });
    prismaMock.projectPreference.upsert.mockResolvedValue({ projectId: "project-1" });
    prismaMock.grokSearchTrace.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("creates a server-side export, stores it in object storage, and persists the export record", async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: "project-1",
      userId: "user-1",
      name: "测试项目",
      preference: {
        chapterIndex: [
          {
            chapterId: "chapter_001",
            chapterNumber: "第1章",
            title: "第一章",
            artifactId: "artifact-chapter-1",
            latestDraftId: null,
            wordCount: 3200,
            status: "accepted",
            updatedAt: "2026-03-21T08:00:00.000Z",
          },
        ],
        exportRecords: [
          {
            id: "older-record",
            bundleKey: "state-summary",
            title: "项目状态摘要",
            fileName: "old_state.md",
            storageKey: "projects/project-1/exports/older-record/old_state.md",
            contentType: "text/markdown; charset=utf-8",
            byteSize: 128,
            fileCount: 1,
            files: ["99_当前状态卡.md"],
            sourceArtifactKeys: ["current_state_card"],
            exportedAt: "2026-03-20T10:00:00.000Z",
            objectStoreMode: "local",
          },
        ],
      },
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

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/projects/project-1/exports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          bundleKey: "chapters",
        }),
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(putObjectMock).toHaveBeenCalledWith({
      key: expect.stringMatching(/^projects\/project-1\/exports\/.+\/测试项目_chapters\.md$/),
      body: expect.any(Buffer),
      contentType: "text/markdown; charset=utf-8",
      metadata: {
        projectId: "project-1",
        bundleKey: "chapters",
        exportId: expect.any(String),
      },
    });
    const storedBody = putObjectMock.mock.calls[0][0].body as Buffer;
    expect(storedBody.toString("utf8")).toContain("# 测试项目 正式章节");
    expect(storedBody.toString("utf8")).not.toContain("## Knowledge Provenance Snapshot");

    const upsertCall = prismaMock.projectPreference.upsert.mock.calls[0][0];
    expect(upsertCall.where).toEqual({ projectId: "project-1" });
    expect(upsertCall.update.exportRecords).toHaveLength(2);
    expect(upsertCall.update.exportRecords[0]).toMatchObject({
      bundleKey: "chapters",
      title: "正式章节导出",
      fileName: "测试项目_chapters.md",
      storageKey: "projects/project-1/exports/export-1/demo.md",
      contentType: "text/markdown; charset=utf-8",
      fileCount: 1,
      files: ["chapter_001.md"],
      sourceArtifactKeys: ["chapter_001"],
      objectStoreMode: "local",
    });
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { updatedAt: expect.any(Date) },
    });
    expect(deleteObjectMock).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.record).toMatchObject({
      bundleKey: "chapters",
      title: "正式章节导出",
      fileName: "测试项目_chapters.md",
    });
    expect(body.downloadUrl).toMatch(/^\/projects\/project-1\/exports\/.+$/);
  });

  it("rejects exports when the selected bundle has no accepted revisions", async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: "project-1",
      userId: "user-1",
      name: "空项目",
      preference: {
        exportRecords: [],
      },
      artifacts: [],
    });

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/projects/project-1/exports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          bundleKey: "chapters",
        }),
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(422);
    expect(putObjectMock).not.toHaveBeenCalled();
    expect(prismaMock.projectPreference.upsert).not.toHaveBeenCalled();
  });

  it("appends recent GrokSearch traces to the state summary export", async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: "project-1",
      userId: "user-1",
      name: "考据项目",
      preference: {
        exportRecords: [],
      },
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
    });
    prismaMock.grokSearchTrace.findMany.mockResolvedValue([
      {
        sessionId: "session-1",
        toolName: "web_search",
        createdAt: new Date("2026-03-22T08:30:00.000Z"),
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
    ]);

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/projects/project-1/exports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          bundleKey: "state-summary",
        }),
      }),
      {
        params: Promise.resolve({ projectId: "project-1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(prismaMock.grokSearchTrace.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
      select: {
        sessionId: true,
        toolName: true,
        createdAt: true,
        requestPayload: true,
        responsePayload: true,
        sourceItems: true,
      },
    });

    const storedBody = putObjectMock.mock.calls[0][0].body as Buffer;
    expect(storedBody.toString("utf8")).toContain("## External Research Snapshot");
    expect(storedBody.toString("utf8")).toContain("会话 ID：session-1");
    expect(storedBody.toString("utf8")).toContain("港口条例史料 | https://example.com/port-rule | 夜间靠岸需补录值守登记。");
  });
});
