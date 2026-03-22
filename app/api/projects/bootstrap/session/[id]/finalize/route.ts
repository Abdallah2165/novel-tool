import { prisma } from "@/lib/db";
import { ApiError, jsonCreated, jsonError, parseJson } from "@/lib/api/http";
import { onboardingSessionFinalizeSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import { createProjectWithBootstrap } from "@/lib/projects/create-project";
import {
  buildOnboardingBootstrapPackage,
  buildOnboardingSummary,
  normalizeOnboardingAnswers,
  ONBOARDING_QUESTIONS,
  serializeOnboardingSession,
} from "@/lib/projects/onboarding";
import { toPrismaJson } from "@/lib/prisma-json";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const payload = await parseJson(request, onboardingSessionFinalizeSchema);
    const session = await prisma.projectOnboardingSession.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!session) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Onboarding session not found." } }, { status: 404 });
    }

    if (session.status === "finalized") {
      throw new ApiError(409, "CONFLICT", "This onboarding session has already been finalized.");
    }

    if (session.currentQuestionIndex < ONBOARDING_QUESTIONS.length) {
      throw new ApiError(422, "VALIDATION_ERROR", "Finish or skip all onboarding questions before finalizing.");
    }

    const answers = normalizeOnboardingAnswers(session.answers);
    const summary = buildOnboardingSummary(answers);
    const bootstrapPackage = buildOnboardingBootstrapPackage({
      name: payload.name,
      genre: payload.genre,
      platform: payload.platform,
      summary,
    });

    const result = await prisma.$transaction(async (tx) => {
      const created = await createProjectWithBootstrap(
        tx,
        {
          userId: user.id,
          name: payload.name,
          genre: payload.genre,
          platform: payload.platform,
          status: payload.status,
        },
        {
          artifactContentOverrides: bootstrapPackage.artifactContentOverrides,
          extraArtifacts: bootstrapPackage.extraArtifacts,
        },
      );

      const onboardingSession = await tx.projectOnboardingSession.update({
        where: { id: session.id },
        data: {
          status: "finalized",
          currentQuestionIndex: ONBOARDING_QUESTIONS.length,
          finalizedProjectId: created.project.id,
          completedAt: new Date(),
          summary: toPrismaJson(summary),
          answers: toPrismaJson(answers),
        },
      });

      return {
        ...created,
        onboardingSession,
      };
    });

    return jsonCreated({
      project: result.project,
      preference: result.preference,
      onboardingSession: serializeOnboardingSession({
        ...result.onboardingSession,
        status: result.onboardingSession.status,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
