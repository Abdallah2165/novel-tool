import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { onboardingSessionAnswerSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import {
  buildOnboardingSummary,
  getOnboardingQuestion,
  normalizeOnboardingAnswers,
  ONBOARDING_QUESTIONS,
  serializeOnboardingSession,
  upsertOnboardingAnswer,
} from "@/lib/projects/onboarding";
import { toPrismaJson } from "@/lib/prisma-json";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, resolveRequestUser(request)]);
    const payload = await parseJson(request, onboardingSessionAnswerSchema);
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

    const answers = normalizeOnboardingAnswers(session.answers);
    let nextAnswers = answers;
    let nextQuestionIndex = session.currentQuestionIndex;
    const currentQuestion =
      session.currentQuestionIndex >= ONBOARDING_QUESTIONS.length
        ? null
        : getOnboardingQuestion(session.currentQuestionIndex);

    if (payload.action === "back") {
      nextQuestionIndex = Math.max(session.currentQuestionIndex - 1, 0);
    } else {
      if (!currentQuestion) {
        throw new ApiError(422, "VALIDATION_ERROR", "The onboarding session is ready to finalize.");
      }

      if (payload.action === "skip" && !currentQuestion.optional) {
        throw new ApiError(422, "VALIDATION_ERROR", "This question cannot be skipped.");
      }

      const answer = (payload.answer ?? "").trim();
      if (payload.action === "answer" && !answer) {
        throw new ApiError(422, "VALIDATION_ERROR", "Answer content is required.");
      }

      nextAnswers = upsertOnboardingAnswer(answers, currentQuestion.key, answer, payload.action === "skip");
      nextQuestionIndex = Math.min(session.currentQuestionIndex + 1, ONBOARDING_QUESTIONS.length);
    }

    const summary = buildOnboardingSummary(nextAnswers);
    const nextStatus = nextQuestionIndex >= ONBOARDING_QUESTIONS.length ? "ready" : "active";
    const updatedSession = await prisma.projectOnboardingSession.update({
      where: { id: session.id },
      data: {
        status: nextStatus,
        currentQuestionIndex: nextQuestionIndex,
        answers: toPrismaJson(nextAnswers),
        summary: toPrismaJson(summary),
      },
    });

    return jsonOk({
      session: serializeOnboardingSession({
        ...updatedSession,
        status: updatedSession.status,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
