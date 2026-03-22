export type ChapterStatus = "draft" | "reviewing" | "accepted";

export type ChapterIndexEntry = {
  chapterId: string;
  chapterNumber: string;
  title: string;
  artifactId: string;
  latestDraftId: string | null;
  wordCount: number;
  status: ChapterStatus;
  updatedAt: string;
};

export type EditorLayoutPrefs = {
  fontSize: "small" | "medium" | "large";
  lineHeight: "comfortable" | "relaxed";
  contentWidth: "narrow" | "medium" | "wide";
  focusMode: boolean;
  showLineNumbers: boolean;
  showIndentGuides: boolean;
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
  visualPreset: string;
  editorTheme: string;
};

const DEFAULT_EDITOR_LAYOUT_PREFS: EditorLayoutPrefs = {
  fontSize: "medium",
  lineHeight: "relaxed",
  contentWidth: "medium",
  focusMode: false,
  showLineNumbers: false,
  showIndentGuides: true,
  autosaveEnabled: true,
  autosaveIntervalMs: 5000,
  visualPreset: "qidian_tomato_minimal",
  editorTheme: "warm_light",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function buildDefaultEditorLayoutPrefs(): EditorLayoutPrefs {
  return { ...DEFAULT_EDITOR_LAYOUT_PREFS };
}

export function normalizeEditorLayoutPrefs(value: unknown): EditorLayoutPrefs {
  if (!isRecord(value)) {
    return buildDefaultEditorLayoutPrefs();
  }

  return {
    fontSize:
      value.fontSize === "small" || value.fontSize === "medium" || value.fontSize === "large"
        ? value.fontSize
        : DEFAULT_EDITOR_LAYOUT_PREFS.fontSize,
    lineHeight:
      value.lineHeight === "comfortable" || value.lineHeight === "relaxed"
        ? value.lineHeight
        : DEFAULT_EDITOR_LAYOUT_PREFS.lineHeight,
    contentWidth:
      value.contentWidth === "narrow" || value.contentWidth === "medium" || value.contentWidth === "wide"
        ? value.contentWidth
        : DEFAULT_EDITOR_LAYOUT_PREFS.contentWidth,
    focusMode: typeof value.focusMode === "boolean" ? value.focusMode : DEFAULT_EDITOR_LAYOUT_PREFS.focusMode,
    showLineNumbers:
      typeof value.showLineNumbers === "boolean" ? value.showLineNumbers : DEFAULT_EDITOR_LAYOUT_PREFS.showLineNumbers,
    showIndentGuides:
      typeof value.showIndentGuides === "boolean"
        ? value.showIndentGuides
        : DEFAULT_EDITOR_LAYOUT_PREFS.showIndentGuides,
    autosaveEnabled:
      typeof value.autosaveEnabled === "boolean" ? value.autosaveEnabled : DEFAULT_EDITOR_LAYOUT_PREFS.autosaveEnabled,
    autosaveIntervalMs:
      typeof value.autosaveIntervalMs === "number" && Number.isFinite(value.autosaveIntervalMs)
        ? value.autosaveIntervalMs
        : DEFAULT_EDITOR_LAYOUT_PREFS.autosaveIntervalMs,
    visualPreset:
      typeof value.visualPreset === "string" && value.visualPreset.trim()
        ? value.visualPreset
        : DEFAULT_EDITOR_LAYOUT_PREFS.visualPreset,
    editorTheme:
      typeof value.editorTheme === "string" && value.editorTheme.trim()
        ? value.editorTheme
        : DEFAULT_EDITOR_LAYOUT_PREFS.editorTheme,
  };
}

export function countNovelWords(content: string | null | undefined) {
  return (content ?? "").replace(/\s+/g, "").length;
}

export function buildChapterNumberLabel(index: number) {
  return `第${index}章`;
}

export function buildDefaultChapterTitle(index: number) {
  return `${buildChapterNumberLabel(index)} 新章`;
}

export function buildChapterArtifactKey(index: number) {
  return `chapter_${String(index).padStart(3, "0")}`;
}

export function buildChapterFilename(index: number) {
  return `${buildChapterArtifactKey(index)}.md`;
}

export function getNextChapterNumber(entries: ChapterIndexEntry[]) {
  return entries.length + 1;
}

export function normalizeChapterTitle(index: number, title: string | null | undefined) {
  const trimmed = title?.trim();
  return trimmed ? trimmed : buildDefaultChapterTitle(index);
}

export function createChapterIndexEntry({
  artifactId,
  chapterNumber,
  title,
  latestDraftId = null,
  wordCount = 0,
  status = "draft",
  updatedAt = new Date().toISOString(),
}: {
  artifactId: string;
  chapterNumber: number;
  title?: string;
  latestDraftId?: string | null;
  wordCount?: number;
  status?: ChapterStatus;
  updatedAt?: string;
}): ChapterIndexEntry {
  return {
    chapterId: buildChapterArtifactKey(chapterNumber),
    chapterNumber: buildChapterNumberLabel(chapterNumber),
    title: normalizeChapterTitle(chapterNumber, title),
    artifactId,
    latestDraftId,
    wordCount,
    status,
    updatedAt,
  };
}

export function normalizeChapterIndex(value: unknown): ChapterIndexEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ChapterIndexEntry => {
      return (
        isRecord(item) &&
        typeof item.chapterId === "string" &&
        typeof item.chapterNumber === "string" &&
        typeof item.title === "string" &&
        typeof item.artifactId === "string" &&
        (typeof item.latestDraftId === "string" || item.latestDraftId === null) &&
        typeof item.wordCount === "number" &&
        (item.status === "draft" || item.status === "reviewing" || item.status === "accepted") &&
        typeof item.updatedAt === "string"
      );
    })
    .map((item) => ({ ...item }));
}

export function appendChapterIndexEntry(entries: ChapterIndexEntry[], nextEntry: ChapterIndexEntry) {
  return [...entries.filter((entry) => entry.artifactId !== nextEntry.artifactId), nextEntry];
}

export function updateChapterIndexEntry(
  entries: ChapterIndexEntry[],
  artifactId: string,
  patch: Partial<Omit<ChapterIndexEntry, "artifactId" | "chapterId" | "chapterNumber">>,
) {
  return entries.map((entry) => (entry.artifactId === artifactId ? { ...entry, ...patch } : entry));
}

export function resolveActiveChapterArtifactId(
  activeChapterArtifactId: string | null | undefined,
  chapterIndex: ChapterIndexEntry[],
  availableArtifactIds: string[],
) {
  if (activeChapterArtifactId && availableArtifactIds.includes(activeChapterArtifactId)) {
    return activeChapterArtifactId;
  }

  const firstIndexedArtifactId = chapterIndex.find((entry) => availableArtifactIds.includes(entry.artifactId))?.artifactId;
  return firstIndexedArtifactId ?? availableArtifactIds[0] ?? null;
}
