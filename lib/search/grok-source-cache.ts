import "server-only";

import { prisma } from "@/lib/db";
import { toPrismaJson } from "@/lib/prisma-json";

export async function createGrokSearchTrace(input: {
  projectId: string;
  sessionId: string;
  toolName: string;
  requestPayload: unknown;
  responsePayload: unknown;
  sourceItems: unknown;
}) {
  await prisma.grokSearchTrace.upsert({
    where: {
      sessionId: input.sessionId,
    },
    update: {
      toolName: input.toolName,
      requestPayload: toPrismaJson(input.requestPayload),
      responsePayload: toPrismaJson(input.responsePayload),
      sourceItems: toPrismaJson(input.sourceItems),
    },
    create: {
      projectId: input.projectId,
      sessionId: input.sessionId,
      toolName: input.toolName,
      requestPayload: toPrismaJson(input.requestPayload),
      responsePayload: toPrismaJson(input.responsePayload),
      sourceItems: toPrismaJson(input.sourceItems),
    },
  });
}

export async function getGrokSearchTrace(projectId: string, sessionId: string) {
  return prisma.grokSearchTrace.findFirst({
    where: {
      projectId,
      sessionId,
    },
    select: {
      sessionId: true,
      toolName: true,
      requestPayload: true,
      responsePayload: true,
      sourceItems: true,
      createdAt: true,
    },
  });
}
