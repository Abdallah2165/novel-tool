import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn(),
};

const resolveRequestUserMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

describe("draft accept route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.$transaction.mockReset();
    resolveRequestUserMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("creates a revision, updates currentRevision, and marks the draft accepted", async () => {
    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });

    const draftDelegate = {
      findFirst: vi.fn().mockResolvedValue({
        id: "draft-1",
        projectId: "project-1",
        runId: "run-1",
        taskType: "review_content",
        outputContent: "审稿后正文",
      }),
      update: vi.fn().mockResolvedValue({ id: "draft-1", status: "accepted" }),
    };
    const artifactDelegate = {
      findFirst: vi.fn().mockResolvedValue({
        id: "artifact-1",
        projectId: "project-1",
        artifactKey: "review_report",
        filename: "findings.md",
        currentRevision: {
          id: "rev-current",
          content: "旧 findings",
        },
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "artifact-progress",
          artifactKey: "progress",
          filename: "progress.md",
          currentRevision: {
            id: "progress-rev-0",
            content: "# progress\n",
          },
        },
        {
          id: "artifact-state",
          artifactKey: "current_state_card",
          filename: "99_当前状态卡.md",
          currentRevision: {
            id: "state-rev-0",
            content: "# 99_当前状态卡\n",
          },
        },
      ]),
      update: vi.fn().mockResolvedValue({ id: "artifact-1", currentRevisionId: "revision-1" }),
    };
    const revisionDelegate = {
      create: vi
        .fn()
        .mockResolvedValueOnce({
          id: "revision-1",
          artifactId: "artifact-1",
          content: "审稿后正文",
          summary: "Accept smoke revision",
          sourceDraftId: "draft-1",
          sourceRunId: "run-1",
          acceptedByUserId: "user-1",
        })
        .mockResolvedValueOnce({
          id: "revision-progress-1",
          artifactId: "artifact-progress",
          content: "# progress\n\n## 接受日志\n",
          summary: "Auto sync after accepting findings.md",
          sourceDraftId: "draft-1",
          sourceRunId: "run-1",
          acceptedByUserId: "user-1",
        })
        .mockResolvedValueOnce({
          id: "revision-state-1",
          artifactId: "artifact-state",
          content: "# 99_当前状态卡\n\n## 自动同步记录\n",
          summary: "Auto sync after accepting findings.md",
          sourceDraftId: "draft-1",
          sourceRunId: "run-1",
          acceptedByUserId: "user-1",
        }),
    };
    const projectDelegate = {
      update: vi.fn().mockResolvedValue({
        updatedAt: new Date("2026-03-20T13:45:00.000Z"),
      }),
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        draft: draftDelegate,
        workspaceArtifact: artifactDelegate,
        workspaceArtifactRevision: revisionDelegate,
        project: projectDelegate,
      }),
    );

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/drafts/draft-1/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          artifactId: "artifact-1",
          summary: "Accept smoke revision",
        }),
      }),
      {
        params: Promise.resolve({
          id: "project-1",
          draftId: "draft-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(draftDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        id: "draft-1",
        projectId: "project-1",
        project: {
          userId: "user-1",
        },
      },
    });
    expect(artifactDelegate.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        artifactKey: {
          in: ["progress", "current_state_card"],
        },
      },
      include: {
        currentRevision: true,
      },
    });
    expect(revisionDelegate.create).toHaveBeenCalledWith({
      data: {
        artifactId: "artifact-1",
        content: "审稿后正文",
        summary: "Accept smoke revision",
        sourceDraftId: "draft-1",
        sourceRunId: "run-1",
        acceptedByUserId: "user-1",
      },
    });
    expect(artifactDelegate.update).toHaveBeenNthCalledWith(1, {
      where: { id: "artifact-1" },
      data: { currentRevisionId: "revision-1" },
    });
    expect(artifactDelegate.update).toHaveBeenNthCalledWith(2, {
      where: { id: "artifact-progress" },
      data: { currentRevisionId: "revision-progress-1" },
    });
    expect(artifactDelegate.update).toHaveBeenNthCalledWith(3, {
      where: { id: "artifact-state" },
      data: { currentRevisionId: "revision-state-1" },
    });
    expect(draftDelegate.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: { status: "accepted" },
    });
    expect(projectDelegate.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { updatedAt: expect.any(Date) },
      select: { updatedAt: true },
    });

    const body = await response.json();
    expect(body).toMatchObject({
      id: "revision-1",
      sourceDraftId: "draft-1",
      sourceRunId: "run-1",
      syncedArtifacts: [
        {
          artifactId: "artifact-progress",
          artifactKey: "progress",
          revisionId: "revision-progress-1",
        },
        {
          artifactId: "artifact-state",
          artifactKey: "current_state_card",
          revisionId: "revision-state-1",
        },
      ],
    });
  });

  it("syncs chapter_index metadata when accepting a chapter-bound draft", async () => {
    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });

    const draftDelegate = {
      findFirst: vi.fn().mockResolvedValue({
        id: "draft-chapter-1",
        projectId: "project-1",
        artifactId: "chapter-artifact-1",
        runId: "run-1",
        taskType: "generate_chapter",
        outputContent: "新的章节正文",
        draftKind: "generated_output",
      }),
      update: vi.fn().mockResolvedValue({ id: "draft-chapter-1", status: "accepted" }),
    };
    const artifactDelegate = {
      findFirst: vi.fn().mockResolvedValue({
        id: "chapter-artifact-1",
        projectId: "project-1",
        artifactKey: "chapter_001",
        filename: "chapter_001.md",
        kind: "project_chapter",
        currentRevision: {
          id: "rev-current",
          content: "",
        },
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "artifact-progress",
          artifactKey: "progress",
          filename: "progress.md",
          currentRevision: {
            id: "progress-rev-0",
            content: "# progress\n",
          },
        },
      ]),
      update: vi.fn().mockResolvedValue({ id: "chapter-artifact-1", currentRevisionId: "revision-1" }),
    };
    const revisionDelegate = {
      create: vi
        .fn()
        .mockResolvedValueOnce({
          id: "revision-1",
          artifactId: "chapter-artifact-1",
          content: "新的章节正文",
          summary: "接受章节草稿",
          sourceDraftId: "draft-chapter-1",
          sourceRunId: "run-1",
          acceptedByUserId: "user-1",
        })
        .mockResolvedValueOnce({
          id: "revision-progress-1",
          artifactId: "artifact-progress",
          content: "# progress\n\n## 接受日志\n",
          summary: "Auto sync after accepting chapter_001.md",
          sourceDraftId: "draft-chapter-1",
          sourceRunId: "run-1",
          acceptedByUserId: "user-1",
        }),
    };
    const projectPreferenceDelegate = {
      findUnique: vi.fn().mockResolvedValue({
        projectId: "project-1",
        chapterIndex: [
          {
            chapterId: "chapter_001",
            chapterNumber: "第1章",
            title: "第一章 试写",
            artifactId: "chapter-artifact-1",
            latestDraftId: null,
            wordCount: 0,
            status: "reviewing",
            updatedAt: "2026-03-20T15:00:00.000Z",
          },
        ],
      }),
      upsert: vi.fn().mockResolvedValue({
        projectId: "project-1",
        activeChapterArtifactId: "chapter-artifact-1",
      }),
    };
    const projectDelegate = {
      update: vi.fn().mockResolvedValue({
        updatedAt: new Date("2026-03-20T13:45:00.000Z"),
      }),
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        draft: draftDelegate,
        workspaceArtifact: artifactDelegate,
        workspaceArtifactRevision: revisionDelegate,
        projectPreference: projectPreferenceDelegate,
        project: projectDelegate,
      }),
    );

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/drafts/draft-chapter-1/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          artifactId: "chapter-artifact-1",
          summary: "接受章节草稿",
        }),
      }),
      {
        params: Promise.resolve({
          id: "project-1",
          draftId: "draft-chapter-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(projectPreferenceDelegate.upsert).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
      },
      update: {
        activeChapterArtifactId: "chapter-artifact-1",
        chapterIndex: [
          {
            chapterId: "chapter_001",
            chapterNumber: "第1章",
            title: "第一章 试写",
            artifactId: "chapter-artifact-1",
            latestDraftId: "draft-chapter-1",
            wordCount: 6,
            status: "accepted",
            updatedAt: expect.any(String),
          },
        ],
      },
      create: expect.any(Object),
    });

    const body = await response.json();
    expect(body).toMatchObject({
      id: "revision-1",
      chapter: {
        artifactId: "chapter-artifact-1",
        latestDraftId: "draft-chapter-1",
        status: "accepted",
      },
    });
  });

  it("rejects editor autosave drafts", async () => {
    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });

    const draftDelegate = {
      findFirst: vi.fn().mockResolvedValue({
        id: "draft-1",
        projectId: "project-1",
        runId: null,
        taskType: "generate_chapter",
        outputContent: "编辑器草稿",
        draftKind: "editor_autosave",
      }),
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        draft: draftDelegate,
        workspaceArtifact: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
        workspaceArtifactRevision: {
          create: vi.fn(),
        },
        project: {
          update: vi.fn(),
        },
      }),
    );

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/drafts/draft-1/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          artifactId: "artifact-1",
          summary: "不应该成功",
        }),
      }),
      {
        params: Promise.resolve({
          id: "project-1",
          draftId: "draft-1",
        }),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });
});
