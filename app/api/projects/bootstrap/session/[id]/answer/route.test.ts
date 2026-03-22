import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  projectOnboardingSession: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

const resolveRequestUserMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

describe("project onboarding answer route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.projectOnboardingSession.findFirst.mockReset();
    prismaMock.projectOnboardingSession.update.mockReset();
    resolveRequestUserMock.mockReset();
    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("records an answer and advances the onboarding session", async () => {
    prismaMock.projectOnboardingSession.findFirst.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      status: "active",
      currentQuestionIndex: 0,
      answers: [],
      summary: {},
      finalizedProjectId: null,
      completedAt: null,
      createdAt: new Date("2026-03-20T22:50:00.000Z"),
      updatedAt: new Date("2026-03-20T22:50:00.000Z"),
    });
    prismaMock.projectOnboardingSession.update.mockImplementation(async ({ data }) => ({
      id: "session-1",
      userId: "user-1",
      status: data.status,
      currentQuestionIndex: data.currentQuestionIndex,
      answers: data.answers,
      summary: data.summary,
      finalizedProjectId: null,
      completedAt: null,
      createdAt: new Date("2026-03-20T22:50:00.000Z"),
      updatedAt: new Date("2026-03-20T22:51:00.000Z"),
    }));

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/bootstrap/session/session-1/answer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "answer",
          answer: "暂定名《港综资本局》，题材是港综商战，平台走番茄，目标长篇。",
        }),
      }),
      {
        params: Promise.resolve({ id: "session-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(prismaMock.projectOnboardingSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({
        status: "active",
        currentQuestionIndex: 1,
        answers: [
          expect.objectContaining({
            questionKey: "project_basics",
            answer: "暂定名《港综资本局》，题材是港综商战，平台走番茄，目标长篇。",
            skipped: false,
          }),
        ],
      }),
    });

    const body = await response.json();
    expect(body.session.status).toBe("active");
    expect(body.session.currentQuestionIndex).toBe(1);
    expect(body.session.currentQuestion).toMatchObject({
      key: "core_conflict",
      title: "主角目标与核心冲突",
    });
    expect(body.session.currentQuestion.recommendedOptions).toHaveLength(3);
    expect(body.session.summary.metadata).toMatchObject({
      nameHint: "港综资本局",
      genreHint: "港综",
      platformHint: "番茄",
      lengthHint: "长篇",
    });
  });
});
