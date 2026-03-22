import { describe, expect, it } from "vitest";

import { buildSeededProjectBasicsAnswer, serializeOnboardingSession } from "@/lib/projects/onboarding";

describe("onboarding helpers", () => {
  it("builds a seeded project basics answer from the author's initial inputs", () => {
    expect(
      buildSeededProjectBasicsAnswer({
        name: "港综资本局",
        genre: "港综商战",
        platform: "番茄",
        lengthHint: "180 万字长篇",
        era: "90 年代港岛",
        keywords: "资本局、势力经营、上位",
      }),
    ).toContain("关键词包括资本局、势力经营、上位");
  });

  it("includes recommended options in the current onboarding question payload", () => {
    const payload = serializeOnboardingSession({
      id: "session-1",
      status: "active",
      currentQuestionIndex: 1,
      answers: [
        {
          questionKey: "project_basics",
          answer: "暂定名《港综资本局》，题材是港综商战，发布平台偏番茄，目标做长篇。",
          skipped: false,
          updatedAt: "2026-03-22T10:00:00.000Z",
        },
      ],
      summary: {},
      finalizedProjectId: null,
      completedAt: null,
      createdAt: "2026-03-22T10:00:00.000Z",
      updatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(payload.currentQuestion).toMatchObject({
      key: "core_conflict",
    });
    expect(payload.currentQuestion?.recommendedOptions).toHaveLength(3);
    expect(payload.currentQuestion?.recommendedOptions[0]?.value).toContain("主角");
  });
});
