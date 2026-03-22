import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  projectOnboardingSession: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

const resolveRequestUserMock = vi.fn();
const createProjectWithBootstrapMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/projects/create-project", () => ({
  createProjectWithBootstrap: createProjectWithBootstrapMock,
}));

describe("project onboarding finalize route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.projectOnboardingSession.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
    resolveRequestUserMock.mockReset();
    createProjectWithBootstrapMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("finalizes onboarding into a real project and marks the session finalized", async () => {
    prismaMock.projectOnboardingSession.findFirst.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      status: "ready",
      currentQuestionIndex: 6,
      answers: [
        {
          questionKey: "project_basics",
          answer: "暂定名《港综资本局》，题材是港综商战，平台走番茄，目标长篇。",
          skipped: false,
          updatedAt: "2026-03-20T22:50:00.000Z",
        },
        {
          questionKey: "core_conflict",
          answer: "主角要在港岛金融圈站稳脚跟，但黑白两道都盯着他的底牌。",
          skipped: false,
          updatedAt: "2026-03-20T22:51:00.000Z",
        },
        {
          questionKey: "world_rules",
          answer: "异能必须付出寿命代价，不能公开展示。",
          skipped: false,
          updatedAt: "2026-03-20T22:52:00.000Z",
        },
        {
          questionKey: "factions",
          answer: "财阀、社团、警方内线和师门是四条核心关系线。",
          skipped: false,
          updatedAt: "2026-03-20T22:53:00.000Z",
        },
        {
          questionKey: "style_rules",
          answer: "章节要短钩子强，禁写降智误会。",
          skipped: false,
          updatedAt: "2026-03-20T22:54:00.000Z",
        },
        {
          questionKey: "research_needs",
          answer: "金融法规和港岛地理要考据。",
          skipped: false,
          updatedAt: "2026-03-20T22:55:00.000Z",
        },
      ],
      summary: {},
      finalizedProjectId: null,
      completedAt: null,
      createdAt: new Date("2026-03-20T22:50:00.000Z"),
      updatedAt: new Date("2026-03-20T22:55:00.000Z"),
    });

    const projectOnboardingSessionDelegate = {
      update: vi.fn().mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        status: "finalized",
        currentQuestionIndex: 6,
        answers: [],
        summary: {},
        finalizedProjectId: "project-1",
        completedAt: new Date("2026-03-20T23:00:00.000Z"),
        createdAt: new Date("2026-03-20T22:50:00.000Z"),
        updatedAt: new Date("2026-03-20T23:00:00.000Z"),
      }),
    };

    createProjectWithBootstrapMock.mockResolvedValue({
      project: {
        id: "project-1",
        name: "港综资本局",
        genre: "港综商战",
        platform: "番茄",
      },
      preference: {
        id: "pref-1",
        projectId: "project-1",
      },
      metadataFiles: {},
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        projectOnboardingSession: projectOnboardingSessionDelegate,
      }),
    );

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/bootstrap/session/session-1/finalize", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "港综资本局",
          genre: "港综商战",
          platform: "番茄",
        }),
      }),
      {
        params: Promise.resolve({ id: "session-1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(createProjectWithBootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectOnboardingSession: projectOnboardingSessionDelegate,
      }),
      {
        userId: "user-1",
        name: "港综资本局",
        genre: "港综商战",
        platform: "番茄",
        status: "active",
      },
      expect.objectContaining({
        artifactContentOverrides: expect.objectContaining({
          story_background: expect.stringContaining("港综资本局"),
          writing_rules: expect.stringContaining("番茄"),
        }),
        extraArtifacts: expect.arrayContaining([
          expect.objectContaining({ artifactKey: "onboarding_brief" }),
          expect.objectContaining({ artifactKey: "project_prompt_pack" }),
          expect.objectContaining({ artifactKey: "project_skill_pack" }),
        ]),
      }),
    );
    expect(projectOnboardingSessionDelegate.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({
        status: "finalized",
        currentQuestionIndex: 6,
        finalizedProjectId: "project-1",
        completedAt: expect.any(Date),
      }),
    });

    const body = await response.json();
    expect(body.project).toMatchObject({
      id: "project-1",
      name: "港综资本局",
    });
    expect(body.onboardingSession).toMatchObject({
      status: "finalized",
      finalizedProjectId: "project-1",
    });
  });
});
