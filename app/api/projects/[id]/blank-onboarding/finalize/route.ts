import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { blankOnboardingFinalizeSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { upsertArtifactRevision } from "@/lib/projects/bootstrap";
import { buildBlankOnboardingBootstrapPackage } from "@/lib/projects/blank-onboarding";

const BLANK_STANDARD_ARTIFACTS: Record<
  string,
  {
    filename: string;
    kind: "project_setting" | "project_state" | "project_outline" | "ledger" | "hook_pool";
  }
> = {
  story_background: {
    filename: "story_background.md",
    kind: "project_setting",
  },
  world_bible: {
    filename: "world_bible.md",
    kind: "project_setting",
  },
  protagonist_card: {
    filename: "protagonist_card.md",
    kind: "project_setting",
  },
  factions_and_characters: {
    filename: "factions_and_characters.md",
    kind: "project_setting",
  },
  writing_rules: {
    filename: "writing_rules.md",
    kind: "project_setting",
  },
  task_plan: {
    filename: "task_plan.md",
    kind: "project_setting",
  },
  findings: {
    filename: "findings.md",
    kind: "project_setting",
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const payload = await parseJson(request, blankOnboardingFinalizeSchema);

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        genre: true,
        platform: true,
      },
    });

    if (!project) {
      throw new ApiError(404, "NOT_FOUND", "Project not found.");
    }

    const [digestDraft, references] = await Promise.all([
      payload.digestDraftId
        ? prisma.draft.findFirst({
            where: {
              id: payload.digestDraftId,
              projectId: id,
            },
            select: {
              id: true,
              runId: true,
            },
          })
        : Promise.resolve(null),
      payload.importedReferenceIds.length > 0
        ? prisma.referenceDocument.findMany({
            where: {
              id: {
                in: payload.importedReferenceIds,
              },
              projectId: id,
            },
            select: {
              id: true,
              filename: true,
            },
          })
        : Promise.resolve([]),
    ]);

    if (payload.digestDraftId && !digestDraft) {
      throw new ApiError(404, "NOT_FOUND", "Material digest draft not found.");
    }

    const bootstrapPackage = buildBlankOnboardingBootstrapPackage({
      projectName: project.name,
      genre: project.genre,
      platform: project.platform,
      authorNotes: payload.authorNotes,
      materialFileNames: references.map((reference) => reference.filename),
      digestOutput: payload.digestOutput,
      followUpAnswers: payload.followUpAnswers,
    });

    const result = await prisma.$transaction(async (tx) => {
      const appliedArtifactKeys: string[] = [];
      const createdArtifactKeys: string[] = [];

      for (const [artifactKey, content] of Object.entries(bootstrapPackage.artifactContentOverrides)) {
        const artifactConfig = BLANK_STANDARD_ARTIFACTS[artifactKey];
        if (!artifactConfig) {
          continue;
        }

        const upsertResult = await upsertArtifactRevision(tx, {
          projectId: id,
          artifactKey,
          filename: artifactConfig.filename,
          kind: artifactConfig.kind,
          content,
          summary: "Blank onboarding bootstrap",
          sourceDraftId: digestDraft?.id ?? null,
          sourceRunId: digestDraft?.runId ?? null,
          acceptedByUserId: user.id,
        });

        appliedArtifactKeys.push(artifactKey);
        if (upsertResult.createdArtifact) {
          createdArtifactKeys.push(artifactKey);
        }
      }

      for (const extraArtifact of bootstrapPackage.extraArtifacts) {
        const upsertResult = await upsertArtifactRevision(tx, {
          projectId: id,
          artifactKey: extraArtifact.artifactKey,
          filename: extraArtifact.filename,
          kind: extraArtifact.kind,
          content: extraArtifact.content,
          summary: extraArtifact.summary ?? "Blank onboarding overlay",
          sourceDraftId: digestDraft?.id ?? null,
          sourceRunId: digestDraft?.runId ?? null,
          acceptedByUserId: user.id,
        });

        appliedArtifactKeys.push(extraArtifact.artifactKey);
        if (upsertResult.createdArtifact) {
          createdArtifactKeys.push(extraArtifact.artifactKey);
        }
      }

      await tx.project.update({
        where: {
          id,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return {
        appliedArtifactKeys,
        createdArtifactKeys,
      };
    });

    return jsonOk({
      ...result,
      followUpAnswerCount: payload.followUpAnswers.filter((entry) => entry.answer.trim()).length,
      digestDraftId: digestDraft?.id ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
