import type { TaskType } from "@/lib/types/domain";

export const API_PRESET_KEYS = ["writing", "review", "research"] as const;

export type ApiPresetKey = (typeof API_PRESET_KEYS)[number];

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

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isApiPresetKey(value: unknown): value is ApiPresetKey {
  return typeof value === "string" && API_PRESET_KEYS.includes(value as ApiPresetKey);
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

export function normalizeApiPresets(value: unknown): ApiPreset[] {
  const rows = Array.isArray(value) ? value : [];
  const overrides = new Map<ApiPresetKey, Partial<ApiPreset>>();

  for (const row of rows) {
    if (!isRecord(row) || !isApiPresetKey(row.presetKey)) {
      continue;
    }

    const nextOverride: Partial<ApiPreset> = {};

    if (typeof row.label === "string" && row.label.trim()) {
      nextOverride.label = row.label.trim();
    }

    nextOverride.endpointId = toOptionalString(row.endpointId);
    nextOverride.modelId = toOptionalString(row.modelId);
    nextOverride.temperature = toOptionalNumber(row.temperature);
    nextOverride.maxTokens = toOptionalNumber(row.maxTokens);

    if (isTaskType(row.taskType)) {
      nextOverride.taskType = row.taskType;
    }

    overrides.set(row.presetKey, nextOverride);
  }

  return DEFAULT_API_PRESETS.map((preset) => ({
    ...preset,
    ...overrides.get(preset.presetKey),
  }));
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
