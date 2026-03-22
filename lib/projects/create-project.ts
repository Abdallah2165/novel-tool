import type { Prisma, PrismaClient } from "@prisma/client";

import { initializeProjectArtifacts, type ExtraProjectArtifactInput } from "@/lib/projects/bootstrap";
import { toPrismaJson } from "@/lib/prisma-json";

type DbClient = PrismaClient | Prisma.TransactionClient;

type CreateProjectInput = {
  userId: string;
  name: string;
  genre: string;
  platform: string;
  status?: "active" | "archived";
};

type CreateProjectOptions = {
  ledgerEnabled?: boolean;
  createOutlineMaster?: boolean;
  defaultTaskType?: string;
  artifactContentOverrides?: Record<string, string>;
  extraArtifacts?: ExtraProjectArtifactInput[];
};

export async function createProjectWithBootstrap(
  db: DbClient,
  input: CreateProjectInput,
  options: CreateProjectOptions = {},
) {
  const project = await db.project.create({
    data: {
      userId: input.userId,
      name: input.name,
      genre: input.genre,
      platform: input.platform,
      status: input.status ?? "active",
    },
  });

  const metadataFiles = await initializeProjectArtifacts(db, project.id, {
    ledgerEnabled: options.ledgerEnabled ?? false,
    createOutlineMaster: options.createOutlineMaster ?? false,
    artifactContentOverrides: options.artifactContentOverrides,
    extraArtifacts: options.extraArtifacts,
  });

  const preference = await db.projectPreference.create({
    data: {
      projectId: project.id,
      defaultTaskType: options.defaultTaskType ?? "workflow_check",
      ledgerEnabled: options.ledgerEnabled ?? false,
      showSelfCheck: true,
      showSettlement: true,
      chapterIndex: toPrismaJson(metadataFiles.chapterIndex),
      editorLayoutPrefs: toPrismaJson(metadataFiles.editorLayoutPrefs),
      activeChapterArtifactId: metadataFiles.activeChapterArtifactId,
    },
  });

  return {
    project,
    preference,
    metadataFiles,
  };
}
