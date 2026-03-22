import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  projectOnboardingSession: {
    create: vi.fn(),
  },
};

const resolveRequestUserMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

describe("project onboarding create route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.projectOnboardingSession.create.mockReset();
    resolveRequestUserMock.mockReset();
    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("creates a seeded onboarding session from the author's initial topic input", async () => {
    prismaMock.projectOnboardingSession.create.mockImplementation(async ({ data }) => ({
      id: "session-1",
      userId: "user-1",
      status: "active",
      currentQuestionIndex: 0,
      answers: data.answers,
      summary: data.summary,
      finalizedProjectId: null,
      completedAt: null,
      createdAt: new Date("2026-03-22T10:00:00.000Z"),
      updatedAt: new Date("2026-03-22T10:00:00.000Z"),
    }));

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/bootstrap/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "港综资本局",
          genre: "港综商战",
          platform: "番茄",
          lengthHint: "180 万字长篇",
          era: "90 年代港岛",
          keywords: "资本局、上位、势力经营",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(prismaMock.projectOnboardingSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        status: "active",
        currentQuestionIndex: 0,
        answers: [
          expect.objectContaining({
            questionKey: "project_basics",
            answer: expect.stringContaining("题材是港综商战"),
            skipped: false,
          }),
        ],
      }),
    });

    const body = await response.json();
    expect(body.session.currentQuestion).toMatchObject({
      key: "project_basics",
      answer: expect.stringContaining("90 年代港岛"),
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
