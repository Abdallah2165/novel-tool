import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");

export type KnowledgeTree = {
  canonical: Record<string, string>;
  prompts: Record<string, string>;
  skills: Record<string, string>;
  schemas: Record<string, unknown>;
};

let knowledgePromise: Promise<KnowledgeTree> | undefined;

async function readDirectoryFiles<T>(
  directory: string,
  reader: (filePath: string) => Promise<T>,
) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        return [entry.name, await reader(filePath)] as const;
      }),
  );

  return Object.fromEntries(files);
}

async function loadKnowledgeFromDisk(): Promise<KnowledgeTree> {
  const canonical = await readDirectoryFiles(path.join(KNOWLEDGE_ROOT, "canonical"), (filePath) =>
    fs.readFile(filePath, "utf-8"),
  );
  const prompts = await readDirectoryFiles(path.join(KNOWLEDGE_ROOT, "prompts"), (filePath) =>
    fs.readFile(filePath, "utf-8"),
  );
  const skills = await readDirectoryFiles(path.join(KNOWLEDGE_ROOT, "skills"), (filePath) =>
    fs.readFile(filePath, "utf-8"),
  );
  const schemas = await readDirectoryFiles(path.join(KNOWLEDGE_ROOT, "schemas"), async (filePath) =>
    JSON.parse(await fs.readFile(filePath, "utf-8")),
  );

  return { canonical, prompts, skills, schemas };
}

export async function loadKnowledgeBase() {
  knowledgePromise ??= loadKnowledgeFromDisk();
  return knowledgePromise;
}

export async function getKnowledgeDigest() {
  const knowledge = await loadKnowledgeBase();
  return Object.entries(knowledge.canonical)
    .map(([filename, content]) => `## ${filename}\n${content.trim()}`)
    .join("\n\n");
}
