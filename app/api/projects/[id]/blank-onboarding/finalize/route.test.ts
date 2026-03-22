import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  project: {
    findFirst: vi.fn(),
  },
  draft: {
    findFirst: vi.fn(),
  },
  referenceDocument: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const resolveRequestUserMock = vi.fn();
const buildBlankOnboardingBootstrapPackageMock = vi.fn();
const upsertArtifactRevisionMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/projects/blank-onboarding", () => ({
  buildBlankOnboardingBootstrapPackage: buildBlankOnboardingBootstrapPackageMock,
}));

vi.mock("@/lib/projects/bootstrap", () => ({
  upsertArtifactRevision: upsertArtifactRevisionMock,
}));

describe("blank onboarding finalize route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.project.findFirst.mockReset();
    prismaMock.draft.findFirst.mockReset();
    prismaMock.referenceDocument.findMany.mockReset();
    prismaMock.$transaction.mockReset();
    resolveRequestUserMock.mockReset();
    buildBlankOnboardingBootstrapPackageMock.mockReset();
    upsertArtifactRevisionMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("writes blank onboarding bootstrap content and overlays after follow-up answers", async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: "project-1",
      name: "港综资本局",
      genre: "港综商战",
      platform: "番茄",
    });
    prismaMock.draft.findFirst.mockResolvedValue({
      id: "draft-1",
      runId: "run-1",
    });
    prismaMock.referenceDocument.findMany.mockResolvedValue([
      { id: "ref-1", filename: "世界观设定.md" },
      { id: "ref-2", filename: "角色草案.txt" },
    ]);
    buildBlankOnboardingBootstrapPackageMock.mockReturnValue({
      artifactContentOverrides: {
        story_background: "# story background",
        findings: "# findings",
      },
      extraArtifacts: [
        {
          artifactKey: "project_prompt_pack",
          filename: "project_prompt_pack.md",
          kind: "project_setting",
          summary: "Blank onboarding prompt overlay pack",
          content: "# project prompt pack",
        },
      ],
    });
    upsertArtifactRevisionMock.mockResolvedValue({ artifactId: "artifact-1", revisionId: "rev-1", createdArtifact: false });

    const projectDelegate = {
      update: vi.fn().mockResolvedValue({ id: "project-1" }),
    };

    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        project: projectDelegate,
      }),
    );

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/blank-onboarding/finalize", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          digestDraftId: "draft-1",
          digestOutput: "# 初始化整理摘要\n\n## 待补充问题\n\n- [核心冲突] 请补主角目标。",
          authorNotes: "不要写成纯黑帮文。",
          importedReferenceIds: ["ref-1", "ref-2"],
          followUpAnswers: [
            {
              questionKey: "core_conflict",
              answer: "主角要借资本局在港岛金融圈站稳脚跟。",
            },
          ],
        }),
      }),
      {
        params: Promise.resolve({ id: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(buildBlankOnboardingBootstrapPackageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "港综资本局",
        materialFileNames: ["世界观设定.md", "角色草案.txt"],
        followUpAnswers: [
          {
            questionKey: "core_conflict",
            answer: "主角要借资本局在港岛金融圈站稳脚跟。",
          },
        ],
      }),
    );
    expect(upsertArtifactRevisionMock).toHaveBeenCalledTimes(3);
    expect(upsertArtifactRevisionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        artifactKey: "story_background",
        sourceDraftId: "draft-1",
        sourceRunId: "run-1",
        acceptedByUserId: "user-1",
      }),
    );
    expect(upsertArtifactRevisionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        artifactKey: "project_prompt_pack",
        filename: "project_prompt_pack.md",
      }),
    );
    expect(projectDelegate.update).toHaveBeenCalledWith({
      where: {
        id: "project-1",
      },
      data: {
        updatedAt: expect.any(Date),
      },
    });

    const body = await response.json();
    expect(body.appliedArtifactKeys).toEqual(["story_background", "findings", "project_prompt_pack"]);
    expect(body.followUpAnswerCount).toBe(1);
  });
});
