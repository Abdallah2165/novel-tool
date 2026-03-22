import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  project: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

const resolveRequestUserMock = vi.fn();
const createProjectChapterArtifactMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/projects/bootstrap", () => ({
  createProjectChapterArtifact: createProjectChapterArtifactMock,
}));

describe("project artifacts route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.project.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
    resolveRequestUserMock.mockReset();
    createProjectChapterArtifactMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("creates a new chapter artifact and appends it to chapter_index", async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: "project-1",
      preference: {
        chapterIndex: [
          {
            chapterId: "chapter_001",
            chapterNumber: "第1章",
            title: "第一章 旧标题",
            artifactId: "chapter-artifact-1",
            latestDraftId: null,
            wordCount: 0,
            status: "draft",
            updatedAt: "2026-03-20T15:00:00.000Z",
          },
        ],
      },
    });
    createProjectChapterArtifactMock.mockResolvedValue({
      artifact: {
        id: "chapter-artifact-2",
        artifactKey: "chapter_002",
        filename: "chapter_002.md",
        kind: "project_chapter",
      },
      chapter: {
        chapterId: "chapter_002",
        chapterNumber: "第2章",
        title: "第二章 新章",
        artifactId: "chapter-artifact-2",
        latestDraftId: null,
        wordCount: 0,
        status: "draft",
        updatedAt: "2026-03-20T16:00:00.000Z",
      },
    });

    const projectPreferenceDelegate = {
      upsert: vi.fn().mockResolvedValue({
        projectId: "project-1",
        activeChapterArtifactId: "chapter-artifact-2",
      }),
    };
    const projectDelegate = {
      update: vi.fn().mockResolvedValue({
        id: "project-1",
      }),
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        projectPreference: projectPreferenceDelegate,
        project: projectDelegate,
      }),
    );

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/artifacts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chapterTitle: "第二章 新章",
        }),
      }),
      {
        params: Promise.resolve({ id: "project-1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(createProjectChapterArtifactMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPreference: projectPreferenceDelegate,
        project: projectDelegate,
      }),
      "project-1",
      2,
      "第二章 新章",
    );
    expect(projectPreferenceDelegate.upsert).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
      },
      update: {
        chapterIndex: [
          {
            chapterId: "chapter_001",
            chapterNumber: "第1章",
            title: "第一章 旧标题",
            artifactId: "chapter-artifact-1",
            latestDraftId: null,
            wordCount: 0,
            status: "draft",
            updatedAt: "2026-03-20T15:00:00.000Z",
          },
          {
            chapterId: "chapter_002",
            chapterNumber: "第2章",
            title: "第二章 新章",
            artifactId: "chapter-artifact-2",
            latestDraftId: null,
            wordCount: 0,
            status: "draft",
            updatedAt: "2026-03-20T16:00:00.000Z",
          },
        ],
        activeChapterArtifactId: "chapter-artifact-2",
      },
      create: expect.any(Object),
    });
    expect(projectDelegate.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
