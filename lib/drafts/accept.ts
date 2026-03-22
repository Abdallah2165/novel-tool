type AcceptSyncContext = {
  acceptedAt: Date;
  artifactFilename: string;
  taskType: string;
  summary: string;
  draftId: string;
  runId: string;
};

const MAX_ACCEPT_LOG_ENTRIES = 20;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatAcceptTimestamp(value: Date) {
  return [
    value.getFullYear(),
    formatDatePart(value.getMonth() + 1),
    formatDatePart(value.getDate()),
  ].join("-")
    .concat(" ")
    .concat([formatDatePart(value.getHours()), formatDatePart(value.getMinutes())].join(":"));
}

function ensureDocumentShell(filename: string, content: string | null | undefined) {
  const normalized = content?.trim();
  if (normalized) {
    return normalized;
  }

  return `# ${filename.replace(/\.md$/, "").replaceAll("_", " ")}\n`;
}

function buildManagedBlock(name: string, body: string) {
  return [`<!-- novel-tools:${name}:start -->`, body.trim(), `<!-- novel-tools:${name}:end -->`].join("\n");
}

function replaceManagedBlock(content: string, name: string, body: string) {
  const block = buildManagedBlock(name, body);
  const pattern = new RegExp(
    `\\n*<!-- novel-tools:${escapeRegExp(name)}:start -->[\\s\\S]*?<!-- novel-tools:${escapeRegExp(name)}:end -->`,
    "m",
  );

  if (pattern.test(content)) {
    return content.replace(pattern, `\n\n${block}`).trim().concat("\n");
  }

  return `${content.trim()}\n\n${block}\n`;
}

function extractManagedBlockEntries(content: string, name: string) {
  const pattern = new RegExp(
    `<!-- novel-tools:${escapeRegExp(name)}:start -->([\\s\\S]*?)<!-- novel-tools:${escapeRegExp(name)}:end -->`,
    "m",
  );
  const match = content.match(pattern);

  if (!match) {
    return [];
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ["));
}

function sanitizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").replace(/[|]/g, "/").trim();
}

export function applyCurrentStateSync(content: string | null | undefined, context: AcceptSyncContext) {
  const base = ensureDocumentShell("99_当前状态卡.md", content);
  const acceptedAt = formatAcceptTimestamp(context.acceptedAt);
  const body = [
    "## 自动同步记录",
    "",
    `- 最近接受时间：${acceptedAt}`,
    `- 最近回填文件：${sanitizeInlineText(context.artifactFilename)}`,
    `- 来源任务：${sanitizeInlineText(context.taskType)}`,
    `- 回填摘要：${sanitizeInlineText(context.summary)}`,
    `- Draft / Run：${sanitizeInlineText(context.draftId)} / ${sanitizeInlineText(context.runId)}`,
  ].join("\n");

  return replaceManagedBlock(base, "state-sync", body);
}

export function appendAcceptLog(content: string | null | undefined, context: AcceptSyncContext) {
  const base = ensureDocumentShell("progress.md", content);
  const acceptedAt = formatAcceptTimestamp(context.acceptedAt);
  const newEntry = `- [${acceptedAt}] ${sanitizeInlineText(context.artifactFilename)} <- ${sanitizeInlineText(context.taskType)}: ${sanitizeInlineText(context.summary)} (Draft ${sanitizeInlineText(context.draftId)})`;
  const existingEntries = extractManagedBlockEntries(base, "accept-log");
  const entries = [newEntry, ...existingEntries.filter((entry) => entry !== newEntry)].slice(0, MAX_ACCEPT_LOG_ENTRIES);
  const body = ["## 接受日志", "", ...entries].join("\n");

  return replaceManagedBlock(base, "accept-log", body);
}
