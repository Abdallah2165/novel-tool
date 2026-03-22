import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  workspaceArtifact: {
    findFirst: vi.fn(),
  },
  generationRun: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

const resolveRequestUserMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

describe("draft route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.project.findFirst.mockReset();
    prismaMock.project.update.mockReset();
    prismaMock.workspaceArtifact.findFirst.mockReset();
    prismaMock.generationRun.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
    resolveRequestUserMock.mockReset();
    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("upserts chapter autosave drafts and syncs chapter_index metadata", async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
    prismaMock.workspaceArtifact.findFirst.mockResolvedValue({
      id: "chapter-artifact-1",
      kind: "project_chapter",
    });

    const draftDelegate = {
      findFirst: vi.fn().mockResolvedValue({
        id: "draft-autosave-1",
        projectId: "project-1",
        artifactId: "chapter-artifact-1",
        runId: null,
        taskType: "generate_chapter",
        outputContent: "旧内容",
        suggestedPatches: [],
        status: "pending",
        draftKind: "editor_autosave",
        updatedAt: new Date("2026-03-20T15:00:00.000Z"),
      }),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({
        id: "draft-autosave-1",
        projectId: "project-1",
        artifactId: "chapter-artifact-1",
        runId: null,
        taskType: "generate_chapter",
        outputContent: "新的章节草稿",
        suggestedPatches: [],
        status: "pending",
        draftKind: "editor_autosave",
        updatedAt: new Date("2026-03-20T15:01:00.000Z"),
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
            status: "draft",
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
        id: "project-1",
      }),
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        draft: draftDelegate,
        projectPreference: projectPreferenceDelegate,
        project: projectDelegate,
      }),
    );

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/drafts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          artifactId: "chapter-artifact-1",
          taskType: "generate_chapter",
          outputContent: "新的章节草稿",
          suggestedPatches: [],
          status: "pending",
          draftKind: "editor_autosave",
          runId: null,
        }),
      }),
      {
        params: Promise.resolve({ id: "project-1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
      where: {
        id: "project-1",
        userId: "user-1",
      },
      select: { id: true },
    });
    expect(prismaMock.workspaceArtifact.findFirst).toHaveBeenCalledWith({
      where: {
        id: "chapter-artifact-1",
        projectId: "project-1",
      },
      select: {
        id: true,
        kind: true,
      },
    });
    expect(prismaMock.generationRun.findFirst).not.toHaveBeenCalled();
    expect(draftDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        artifactId: "chapter-artifact-1",
        draftKind: "editor_autosave",
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(draftDelegate.update).toHaveBeenCalledWith({
      where: { id: "draft-autosave-1" },
      data: {
        taskType: "generate_chapter",
        outputContent: "新的章节草稿",
        suggestedPatches: [],
        status: "pending",
      },
    });
    expect(projectPreferenceDelegate.upsert).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
      },
      update: {
        chapterIndex: [
          {
            chapterId: "chapter_001",
            chapterNumber: "第1章",
            title: "第一章 试写",
            artifactId: "chapter-artifact-1",
            latestDraftId: "draft-autosave-1",
            wordCount: 6,
            status: "draft",
            updatedAt: expect.any(String),
          },
        ],
        activeChapterArtifactId: "chapter-artifact-1",
      },
      create: expect.any(Object),
    });
    expect(projectDelegate.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
