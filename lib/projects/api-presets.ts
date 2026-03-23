import type { TaskType } from "@/lib/types/domain";

export const API_PRESET_LIMIT = 12;

export type ApiPresetKey = string;

export type ApiPreset = {
  presetKey: ApiPresetKey;
  label: string;
  endpointId: string | null;
  modelId: string | null;
  taskType: TaskType;
  temperature: number | null;
  maxTokens: number | null;
};

export type AppliedApiPresetState = {
  activeApiPresetKey: ApiPresetKey;
  endpointId: string;
  modelId: string;
  taskType: TaskType;
  temperature: string;
  maxTokens: string;
  userInstruction: string;
};

const DEFAULT_API_PRESETS: ApiPreset[] = [
  {
    presetKey: "writing",
    label: "写作预设",
    endpointId: null,
    modelId: null,
    taskType: "generate_chapter",
    temperature: 0.7,
    maxTokens: 1200,
  },
  {
    presetKey: "review",
    label: "审稿预设",
    endpointId: null,
    modelId: null,
    taskType: "review_content",
    temperature: 0.3,
    maxTokens: 1200,
  },
  {
    presetKey: "research",
    label: "考据预设",
    endpointId: null,
    modelId: null,
    taskType: "research_fact_check",
    temperature: 0,
    maxTokens: 1200,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPresetKey(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isTaskType(value: unknown): value is TaskType {
  return (
    value === "ingest_sources" ||
    value === "workflow_check" ||
    value === "generate_setting" ||
    value === "generate_outline" ||
    value === "generate_chapter" ||
    value === "review_content" ||
    value === "minimal_fix" ||
    value === "sync_state" ||
    value === "research_fact_check"
  );
}

export function createDefaultApiPresets() {
  return DEFAULT_API_PRESETS.map((preset) => ({ ...preset }));
}

export function normalizeApiPresets(
  value: unknown,
  options: {
    fallbackToDefaults?: boolean;
  } = {},
): ApiPreset[] {
  if (!Array.isArray(value)) {
    return options.fallbackToDefaults === false ? [] : createDefaultApiPresets();
  }

  const presets: ApiPreset[] = [];
  const seenKeys = new Set<string>();

  for (const row of value) {
    if (!isRecord(row)) {
      continue;
    }

    const presetKey = toPresetKey(row.presetKey);
    if (!presetKey || seenKeys.has(presetKey)) {
      continue;
    }

    presets.push({
      presetKey,
      label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : `预设 ${presets.length + 1}`,
      endpointId: toOptionalString(row.endpointId),
      modelId: toOptionalString(row.modelId),
      taskType: isTaskType(row.taskType) ? row.taskType : "generate_chapter",
      temperature: toOptionalNumber(row.temperature),
      maxTokens: toOptionalNumber(row.maxTokens),
    });
    seenKeys.add(presetKey);

    if (presets.length >= API_PRESET_LIMIT) {
      break;
    }
  }

  return presets;
}

export function buildAppliedApiPresetState(
  preset: ApiPreset,
  options: {
    fallbackEndpointId?: string | null;
    buildInstruction: (taskType: TaskType) => string;
    defaultTemperature?: string;
    defaultMaxTokens?: string;
  },
): AppliedApiPresetState {
  return {
    activeApiPresetKey: preset.presetKey,
    endpointId: preset.endpointId ?? options.fallbackEndpointId ?? "",
    modelId: preset.modelId ?? "",
    taskType: preset.taskType,
    temperature: preset.temperature != null ? String(preset.temperature) : (options.defaultTemperature ?? "0.7"),
    maxTokens: preset.maxTokens != null ? String(preset.maxTokens) : (options.defaultMaxTokens ?? "1200"),
    userInstruction: options.buildInstruction(preset.taskType),
  };
}
