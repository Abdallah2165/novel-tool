import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  workspaceArtifact: {
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

describe("project artifact detail route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.workspaceArtifact.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
    resolveRequestUserMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns artifact detail with recent revisions through GET /api/projects/:id/artifacts/:artifactId", async () => {
    prismaMock.workspaceArtifact.findFirst.mockResolvedValue({
      id: "artifact-1",
      artifactKey: "world_bible",
      filename: "world_bible.md",
      currentRevision: {
        id: "revision-2",
        summary: "Accept latest world bible draft",
        content: "## 世界观\n\n最新设定。",
      },
      revisions: [
        {
          id: "revision-2",
          summary: "Accept latest world bible draft",
          content: "## 世界观\n\n最新设定。",
          sourceDraftId: "draft-2",
          sourceRunId: "run-2",
          createdAt: new Date("2026-03-21T10:00:00.000Z"),
        },
        {
          id: "revision-1",
          summary: "Initial bootstrap",
          content: "## 世界观\n\n初始设定。",
          sourceDraftId: null,
          sourceRunId: null,
          createdAt: new Date("2026-03-20T10:00:00.000Z"),
        },
      ],
    });

    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/projects/project-1/artifacts/artifact-1"), {
      params: Promise.resolve({
        id: "project-1",
        artifactId: "artifact-1",
      }),
    });

    expect(response.status).toBe(200);
    expect(prismaMock.workspaceArtifact.findFirst).toHaveBeenCalledWith({
      where: {
        id: "artifact-1",
        projectId: "project-1",
        project: {
          userId: "user-1",
        },
      },
      include: {
        currentRevision: true,
        revisions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    const payload = await response.json();
    expect(payload.item ?? payload).toMatchObject({
      id: "artifact-1",
      artifactKey: "world_bible",
      filename: "world_bible.md",
      currentRevision: {
        id: "revision-2",
      },
    });
    expect((payload.item ?? payload).revisions).toHaveLength(2);
  });

  it("updates chapter title metadata through PATCH /api/projects/:id/artifacts/:artifactId", async () => {
    prismaMock.workspaceArtifact.findFirst.mockResolvedValue({
      id: "chapter-artifact-1",
      kind: "project_chapter",
      artifactKey: "chapter_001",
    });

    const projectPreferenceDelegate = {
      findUnique: vi.fn().mockResolvedValue({
        projectId: "project-1",
        chapterIndex: [
          {
            chapterId: "chapter_001",
            chapterNumber: "第1章",
            title: "第一章 旧标题",
            artifactId: "chapter-artifact-1",
            latestDraftId: null,
            wordCount: 3200,
            status: "accepted",
            updatedAt: "2026-03-20T15:00:00.000Z",
          },
        ],
      }),
      upsert: vi.fn().mockResolvedValue({
        projectId: "project-1",
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

    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1/artifacts/chapter-artifact-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "rename_chapter",
          chapterTitle: "第一章 新标题",
        }),
      }),
      {
        params: Promise.resolve({
          id: "project-1",
          artifactId: "chapter-artifact-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.workspaceArtifact.findFirst).toHaveBeenCalledWith({
      where: {
        id: "chapter-artifact-1",
        projectId: "project-1",
        project: {
          userId: "user-1",
        },
      },
      select: {
        id: true,
        kind: true,
        artifactKey: true,
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
            title: "第一章 新标题",
            artifactId: "chapter-artifact-1",
            latestDraftId: null,
            wordCount: 3200,
            status: "accepted",
            updatedAt: expect.any(String),
          },
        ],
      },
      create: expect.any(Object),
    });
    expect(projectDelegate.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("saves prompt overlay revisions through PATCH /api/projects/:id/artifacts/:artifactId", async () => {
    prismaMock.workspaceArtifact.findFirst.mockResolvedValue({
      id: "artifact-overlay-1",
      kind: "project_setting",
      artifactKey: "project_prompt_pack",
    });

    const workspaceArtifactRevisionDelegate = {
      create: vi.fn().mockResolvedValue({
        id: "revision-1",
      }),
    };
    const workspaceArtifactDelegate = {
      update: vi.fn().mockResolvedValue({
        id: "artifact-overlay-1",
      }),
    };
    const projectDelegate = {
      update: vi.fn().mockResolvedValue({
        id: "project-1",
      }),
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        workspaceArtifactRevision: workspaceArtifactRevisionDelegate,
        workspaceArtifact: workspaceArtifactDelegate,
        project: projectDelegate,
      }),
    );

    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/projects/project-1/artifacts/artifact-overlay-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "save_overlay",
          revisionContent: "## Overlay\n\n强调项目专属叙事重心。",
          summary: "Update project_prompt_pack from Prompt Studio",
        }),
      }),
      {
        params: Promise.resolve({
          id: "project-1",
          artifactId: "artifact-overlay-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(workspaceArtifactRevisionDelegate.create).toHaveBeenCalledWith({
      data: {
        artifactId: "artifact-overlay-1",
        content: "## Overlay\n\n强调项目专属叙事重心。",
        summary: "Update project_prompt_pack from Prompt Studio",
        acceptedByUserId: "user-1",
      },
    });
    expect(workspaceArtifactDelegate.update).toHaveBeenCalledWith({
      where: { id: "artifact-overlay-1" },
      data: {
        currentRevisionId: "revision-1",
      },
    });
    expect(projectDelegate.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
