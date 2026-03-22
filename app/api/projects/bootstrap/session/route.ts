import { prisma } from "@/lib/db";
import { jsonCreated, jsonError, parseJson } from "@/lib/api/http";
import { onboardingSessionCreateSchema } from "@/lib/api/schemas";
import { resolveRequestUser } from "@/lib/auth/identity";
import {
  buildOnboardingSeedAnswers,
  buildOnboardingSummary,
  serializeOnboardingSession,
} from "@/lib/projects/onboarding";
import { toPrismaJson } from "@/lib/prisma-json";

export async function POST(request: Request) {
  try {
    const user = await resolveRequestUser(request);
    const payload = await parseJson(request, onboardingSessionCreateSchema);
    const initialAnswers = buildOnboardingSeedAnswers(payload);

    const session = await prisma.projectOnboardingSession.create({
      data: {
        userId: user.id,
        status: "active",
        currentQuestionIndex: 0,
        answers: toPrismaJson(initialAnswers),
        summary: toPrismaJson(buildOnboardingSummary(initialAnswers)),
      },
    });

    return jsonCreated({
      session: serializeOnboardingSession({
        ...session,
        status: session.status,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
