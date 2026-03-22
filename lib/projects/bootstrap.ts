import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { loadKnowledgeBase } from "@/lib/knowledge";
import {
  buildChapterArtifactKey,
  buildChapterFilename,
  buildDefaultEditorLayoutPrefs,
  createChapterIndexEntry,
  type ChapterIndexEntry,
  type EditorLayoutPrefs,
  normalizeChapterTitle,
} from "@/lib/projects/editor-state";

type DbClient = PrismaClient | Prisma.TransactionClient;

const OPTIONAL_TEMPLATE_KEYS = new Set(["pending_hooks", "particle_ledger", "outline_master"]);

export type ExtraProjectArtifactInput = {
  artifactKey: string;
  filename: string;
  kind: "project_setting" | "project_state" | "project_outline" | "ledger" | "hook_pool";
  content: string;
  summary?: string;
};

function renderTable(schemaName: string) {
  switch (schemaName) {
    case "findings_table":
      return "| 日期 | 发现 | 影响 | 处理状态 |\n| --- | --- | --- | --- |";
    case "progress_table":
      return "| 时间 | 章节/节点 | 推进内容 | 待跟进 |\n| --- | --- | --- | --- |";
    case "character_relationships_table":
      return "| 角色 A | 角色 B | 当前关系 | 备注 |\n| --- | --- | --- | --- |";
    case "current_state_table":
      return "| 项 | 当前值 | 备注 |\n| --- | --- | --- |\n| 当前章节 | 待填写 | |\n| 当前目标 | 待填写 | |";
    case "pending_hooks_table":
      return "| 伏笔 | 首次出现 | 预期回收 | 当前状态 |\n| --- | --- | --- | --- |";
    case "particle_ledger_table":
      return "| 项目 | 当前值 | 变化说明 |\n| --- | --- | --- |";
    default:
      return "";
  }
}

function renderTemplate(filename: string, sections: string[], tableSchemas: string[]) {
  const lines = [`# ${filename.replace(/\.md$/, "").replaceAll("_", " ")}`];

  for (const section of sections) {
    lines.push("", `## ${section}`, "", "_待填写_");
  }

  for (const tableSchema of tableSchemas) {
    const table = renderTable(tableSchema);
    if (table) {
      lines.push("", table);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function inferArtifactKind(filename: string) {
  if (filename === "99_当前状态卡.md" || filename === "progress.md" || filename === "character_relationships.md") {
    return "project_state" as const;
  }
  if (filename === "pending_hooks.md") {
    return "hook_pool" as const;
  }
  if (filename === "particle_ledger.md") {
    return "ledger" as const;
  }
  if (filename === "outline_master.md") {
    return "project_outline" as const;
  }
  return "project_setting" as const;
}

export async function buildProjectMetadataFiles() {
  return {
    chapterIndex: [] as ChapterIndexEntry[],
    editorLayoutPrefs: buildDefaultEditorLayoutPrefs() as EditorLayoutPrefs,
    activeChapterArtifactId: null as string | null,
  };
}

async function createArtifactWithInitialRevision(
  db: DbClient,
  input: {
    projectId: string;
    artifactKey: string;
    filename: string;
    kind: "project_setting" | "project_state" | "project_outline" | "ledger" | "hook_pool";
    content: string;
    summary: string;
  },
) {
  const artifact = await db.workspaceArtifact.create({
    data: {
      projectId: input.projectId,
      artifactKey: input.artifactKey,
      filename: input.filename,
      kind: input.kind,
    },
  });

  const revision = await db.workspaceArtifactRevision.create({
    data: {
      artifactId: artifact.id,
      content: input.content,
      summary: input.summary,
    },
  });

  await db.workspaceArtifact.update({
    where: { id: artifact.id },
    data: { currentRevisionId: revision.id },
  });

  return artifact;
}

export async function upsertArtifactRevision(
  db: DbClient,
  input: {
    projectId: string;
    artifactKey: string;
    filename: string;
    kind: "project_setting" | "project_state" | "project_outline" | "ledger" | "hook_pool";
    content: string;
    summary: string;
    sourceDraftId?: string | null;
    sourceRunId?: string | null;
    acceptedByUserId?: string | null;
  },
) {
  const existingArtifact = await db.workspaceArtifact.findFirst({
    where: {
      projectId: input.projectId,
      artifactKey: input.artifactKey,
    },
    select: {
      id: true,
      kind: true,
    },
  });

  if (!existingArtifact) {
    const artifact = await db.workspaceArtifact.create({
      data: {
        projectId: input.projectId,
        artifactKey: input.artifactKey,
        filename: input.filename,
        kind: input.kind,
      },
    });

    const revision = await db.workspaceArtifactRevision.create({
      data: {
        artifactId: artifact.id,
        content: input.content,
        summary: input.summary,
        sourceDraftId: input.sourceDraftId ?? null,
        sourceRunId: input.sourceRunId ?? null,
        acceptedByUserId: input.acceptedByUserId ?? null,
      },
    });

    await db.workspaceArtifact.update({
      where: { id: artifact.id },
      data: { currentRevisionId: revision.id },
    });

    return {
      artifactId: artifact.id,
      revisionId: revision.id,
      createdArtifact: true,
    };
  }

  const revision = await db.workspaceArtifactRevision.create({
    data: {
      artifactId: existingArtifact.id,
      content: input.content,
      summary: input.summary,
      sourceDraftId: input.sourceDraftId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      acceptedByUserId: input.acceptedByUserId ?? null,
    },
  });

  await db.workspaceArtifact.update({
    where: { id: existingArtifact.id },
    data: { currentRevisionId: revision.id },
  });

  return {
    artifactId: existingArtifact.id,
    revisionId: revision.id,
    createdArtifact: false,
  };
}

export async function createProjectChapterArtifact(
  db: DbClient,
  projectId: string,
  chapterNumber: number,
  title?: string,
) {
  const artifact = await db.workspaceArtifact.create({
    data: {
      projectId,
      artifactKey: buildChapterArtifactKey(chapterNumber),
      filename: buildChapterFilename(chapterNumber),
      kind: "project_chapter",
    },
  });

  const revision = await db.workspaceArtifactRevision.create({
    data: {
      artifactId: artifact.id,
      content: "",
      summary: "Chapter scaffold",
    },
  });

  await db.workspaceArtifact.update({
    where: { id: artifact.id },
    data: { currentRevisionId: revision.id },
  });

  return {
    artifact,
    chapter: createChapterIndexEntry({
      artifactId: artifact.id,
      chapterNumber,
      title: normalizeChapterTitle(chapterNumber, title),
    }),
  };
}

export async function initializeProjectArtifacts(
  db: DbClient,
  projectId: string,
  options?: {
    ledgerEnabled?: boolean;
    createOutlineMaster?: boolean;
    artifactContentOverrides?: Record<string, string>;
    extraArtifacts?: ExtraProjectArtifactInput[];
  },
) {
  const knowledge = await loadKnowledgeBase();
  const templates = knowledge.schemas["file-templates.json"] as Array<{
    templateKey: string;
    filename: string;
    sections: string[];
    tableSchemas: string[];
  }>;

  const metadataFiles = await buildProjectMetadataFiles();

  for (const template of templates) {
    if (OPTIONAL_TEMPLATE_KEYS.has(template.templateKey) && !options?.ledgerEnabled) {
      continue;
    }

    if (template.templateKey === "outline_master" && !options?.createOutlineMaster) {
      continue;
    }

    await createArtifactWithInitialRevision(db, {
      projectId,
      artifactKey: template.templateKey,
      filename: template.filename,
      kind: inferArtifactKind(template.filename),
      content:
        options?.artifactContentOverrides?.[template.templateKey] ??
        renderTemplate(template.filename, template.sections, template.tableSchemas),
      summary: options?.artifactContentOverrides?.[template.templateKey]
        ? "Project bootstrap from onboarding"
        : "Project bootstrap template",
    });
  }

  for (const extraArtifact of options?.extraArtifacts ?? []) {
    await createArtifactWithInitialRevision(db, {
      projectId,
      artifactKey: extraArtifact.artifactKey,
      filename: extraArtifact.filename,
      kind: extraArtifact.kind,
      content: extraArtifact.content,
      summary: extraArtifact.summary ?? "Project bootstrap extra artifact",
    });
  }

  const { artifact: initialChapterArtifact, chapter } = await createProjectChapterArtifact(db, projectId, 1);

  return {
    ...metadataFiles,
    chapterIndex: [chapter],
    activeChapterArtifactId: initialChapterArtifact.id,
  };
}
