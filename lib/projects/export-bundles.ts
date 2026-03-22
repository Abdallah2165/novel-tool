import type { ChapterIndexEntry } from "@/lib/projects/editor-state";
import { extractSourceDetailItems } from "@/lib/runs/diagnostics";

export const EXPORT_BUNDLE_KEYS = ["chapters", "setting-outline", "state-summary"] as const;
export const PROJECT_EXPORT_RECORD_LIMIT = 20;

export type ExportBundleKey = (typeof EXPORT_BUNDLE_KEYS)[number];

export type ExportArtifactSnapshot = {
  id: string;
  artifactKey: string;
  filename: string;
  kind: string;
  currentRevision: {
    content: string;
  } | null;
};

export type ExportRecord = {
  id: string;
  bundleKey: ExportBundleKey;
  title: string;
  fileName: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  fileCount: number;
  files: string[];
  sourceArtifactKeys: string[];
  exportedAt: string;
  objectStoreMode: "s3" | "local";
};

export type ExportBundle = {
  key: ExportBundleKey;
  title: string;
  description: string;
  fileName: string;
  fileCount: number;
  files: string[];
  sourceArtifactKeys: string[];
  content: string;
};

export type ExportExternalSearchTrace = {
  sessionId: string;
  toolName: string;
  createdAt: string;
  requestPayload: unknown;
  responsePayload: unknown;
  sourceItems: unknown;
};

export function buildProjectExportDownloadPath(projectId: string, exportId: string) {
  return `/projects/${projectId}/exports/${exportId}`;
}

type BuildProjectExportBundlesInput = {
  projectName: string;
  chapterIndex: ChapterIndexEntry[];
  artifacts: ExportArtifactSnapshot[];
  exportedAt?: string;
  externalSearchTraces?: ExportExternalSearchTrace[];
};

function sanitizeProjectName(value: string) {
  return value.trim().replace(/[^\w\u4e00-\u9fa5-]+/g, "_") || "novel_tools_project";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildArtifactBundle(
  title: string,
  artifactRows: Array<{ artifactKey: string; filename: string; content: string }>,
  exportedAt: string,
  appendix?: string,
) {
  return [
    `# ${title}`,
    "",
    "## Export Metadata",
    "",
    `- Exported At: ${exportedAt}`,
    `- Included Files: ${artifactRows.length}`,
    `- Artifact Keys: ${artifactRows.map((artifact) => artifact.artifactKey).join(" / ") || "none"}`,
    "",
    ...artifactRows.flatMap((artifact) => [`## ${artifact.filename}`, "", artifact.content.trim(), ""]),
    ...(appendix ? ["", appendix, ""] : []),
  ]
    .join("\n")
    .trim();
}

function buildExternalSearchAppendix(
  bundleKey: ExportBundleKey,
  externalSearchTraces: ExportExternalSearchTrace[] | undefined,
) {
  if (bundleKey !== "state-summary" || !externalSearchTraces || externalSearchTraces.length === 0) {
    return "";
  }

  return [
    "## External Research Snapshot",
    "",
    "以下内容来自项目最近一次联网考据的来源缓存，用于在导出时一并留档，不会覆盖正式剧情事实。",
    "",
    ...externalSearchTraces.flatMap((trace, index) => {
      const requestPayload = isRecord(trace.requestPayload) ? trace.requestPayload : null;
      const responsePayload = isRecord(trace.responsePayload) ? trace.responsePayload : null;
      const query =
        pickText(requestPayload?.query) ??
        pickText(requestPayload?.question) ??
        pickText(requestPayload?.keyword) ??
        pickText(responsePayload?.query);
      const summary = pickText(responsePayload?.content) ?? pickText(responsePayload?.answer);
      const sourceItems = extractSourceDetailItems(trace.sourceItems).slice(0, 5);

      return [
        `### 检索留档 ${index + 1}`,
        "",
        `- 检索时间：${trace.createdAt}`,
        `- 会话 ID：${trace.sessionId}`,
        `- 调用工具：${trace.toolName}`,
        ...(query ? [`- 检索问题：${query}`] : []),
        ...(summary ? [`- 摘要：${summary}`] : []),
        "",
        "#### 来源快照",
        "",
        ...(sourceItems.length > 0
          ? sourceItems.flatMap((item, sourceIndex) => {
              const fragments = [item.title, item.url, item.snippet].filter(Boolean);
              return [`${sourceIndex + 1}. ${fragments.join(" | ")}`];
            })
          : ["未记录可导出的来源条目。"]),
        "",
      ];
    }),
    "> 更完整的来源明细仍可在运行诊断或来源 JSON 下载中查看。",
  ]
    .join("\n")
    .trim();
}

function buildBundleAppendix(bundleKey: ExportBundleKey, externalSearchTraces: ExportExternalSearchTrace[] | undefined) {
  return buildExternalSearchAppendix(bundleKey, externalSearchTraces);
}

export function buildProjectExportBundles(input: BuildProjectExportBundlesInput): ExportBundle[] {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const safeProjectName = sanitizeProjectName(input.projectName);
  const artifactMap = new Map(input.artifacts.map((artifact) => [artifact.id, artifact]));
  const chapterArtifacts = input.chapterIndex
    .map((entry) => artifactMap.get(entry.artifactId))
    .filter((artifact): artifact is ExportArtifactSnapshot => Boolean(artifact?.currentRevision?.content?.trim()))
    .map((artifact) => ({
      artifactKey: artifact.artifactKey,
      filename: artifact.filename,
      content: artifact.currentRevision?.content ?? "",
    }));
  const settingArtifacts = input.artifacts
    .filter(
      (artifact) =>
        (artifact.kind === "project_setting" || artifact.kind === "project_outline") &&
        artifact.currentRevision?.content?.trim(),
    )
    .map((artifact) => ({
      artifactKey: artifact.artifactKey,
      filename: artifact.filename,
      content: artifact.currentRevision?.content ?? "",
    }));
  const stateArtifacts = input.artifacts
    .filter(
      (artifact) =>
        (artifact.kind === "project_state" ||
          artifact.kind === "review_report" ||
          artifact.artifactKey === "onboarding_brief") &&
        artifact.currentRevision?.content?.trim(),
    )
    .map((artifact) => ({
      artifactKey: artifact.artifactKey,
      filename: artifact.filename,
      content: artifact.currentRevision?.content ?? "",
    }));

  return [
    {
      key: "chapters",
      title: "正式章节导出",
      description: "打包当前已有 accepted revision 的章节正文。",
      fileName: `${safeProjectName}_chapters.md`,
      fileCount: chapterArtifacts.length,
      files: chapterArtifacts.map((artifact) => artifact.filename),
      sourceArtifactKeys: chapterArtifacts.map((artifact) => artifact.artifactKey),
      content: buildArtifactBundle(
        `${input.projectName} 正式章节`,
        chapterArtifacts,
        exportedAt,
        buildBundleAppendix("chapters", input.externalSearchTraces),
      ),
    },
    {
      key: "setting-outline",
      title: "设定与卷纲快照",
      description: "导出世界观、角色、写作规则和卷纲类文件。",
      fileName: `${safeProjectName}_setting_outline_snapshot.md`,
      fileCount: settingArtifacts.length,
      files: settingArtifacts.map((artifact) => artifact.filename),
      sourceArtifactKeys: settingArtifacts.map((artifact) => artifact.artifactKey),
      content: buildArtifactBundle(
        `${input.projectName} 设定与卷纲快照`,
        settingArtifacts,
        exportedAt,
        buildBundleAppendix("setting-outline", input.externalSearchTraces),
      ),
    },
    {
      key: "state-summary",
      title: "项目状态摘要",
      description: "导出当前状态卡、进度、findings 和 onboarding 摘要。",
      fileName: `${safeProjectName}_state_summary.md`,
      fileCount: stateArtifacts.length,
      files: stateArtifacts.map((artifact) => artifact.filename),
      sourceArtifactKeys: stateArtifacts.map((artifact) => artifact.artifactKey),
      content: buildArtifactBundle(
        `${input.projectName} 项目状态摘要`,
        stateArtifacts,
        exportedAt,
        buildBundleAppendix("state-summary", input.externalSearchTraces),
      ),
    },
  ];
}

export function normalizeProjectExportRecords(value: unknown): ExportRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ExportRecord => {
      return (
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.bundleKey === "string" &&
        EXPORT_BUNDLE_KEYS.includes(item.bundleKey as ExportBundleKey) &&
        typeof item.title === "string" &&
        typeof item.fileName === "string" &&
        typeof item.storageKey === "string" &&
        typeof item.contentType === "string" &&
        typeof item.byteSize === "number" &&
        typeof item.fileCount === "number" &&
        Array.isArray(item.files) &&
        Array.isArray(item.sourceArtifactKeys) &&
        typeof item.exportedAt === "string" &&
        (item.objectStoreMode === "s3" || item.objectStoreMode === "local")
      );
    })
    .map((item) => ({
      ...item,
      files: item.files.filter((entry): entry is string => typeof entry === "string"),
      sourceArtifactKeys: item.sourceArtifactKeys.filter((entry): entry is string => typeof entry === "string"),
    }))
    .sort((left, right) => Date.parse(right.exportedAt) - Date.parse(left.exportedAt));
}
