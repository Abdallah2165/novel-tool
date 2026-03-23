import { describe, expect, it } from "vitest";

import { buildAppliedApiPresetState, normalizeApiPresets } from "@/lib/projects/api-presets";

describe("api presets", () => {
  it("falls back to example presets when no persisted list exists yet", () => {
    const presets = normalizeApiPresets(undefined);

    expect(presets.map((preset) => preset.presetKey)).toEqual(["writing", "review", "research"]);
  });

  it("preserves arbitrary preset keys and saved order", () => {
    const presets = normalizeApiPresets([
      {
        presetKey: "chapter-fast",
        label: "章节快写",
        endpointId: "endpoint-writing",
        modelId: "writer-model",
        taskType: "generate_chapter",
        temperature: 0.9,
        maxTokens: 1500,
      },
      {
        presetKey: "fact-harbor",
        label: "港口考据",
        endpointId: "endpoint-research",
        modelId: "researcher-model",
        taskType: "research_fact_check",
        temperature: 0,
        maxTokens: 800,
      },
    ]);

    expect(presets).toEqual([
      {
        presetKey: "chapter-fast",
        label: "章节快写",
        endpointId: "endpoint-writing",
        modelId: "writer-model",
        taskType: "generate_chapter",
        temperature: 0.9,
        maxTokens: 1500,
      },
      {
        presetKey: "fact-harbor",
        label: "港口考据",
        endpointId: "endpoint-research",
        modelId: "researcher-model",
        taskType: "research_fact_check",
        temperature: 0,
        maxTokens: 800,
      },
    ]);
  });

  it("keeps an explicitly empty preset list empty", () => {
    expect(normalizeApiPresets([], { fallbackToDefaults: false })).toEqual([]);
  });

  it("builds workbench state from the selected preset and falls back to the first endpoint when needed", () => {
    const [writingPreset, reviewPreset] = normalizeApiPresets([
      {
        presetKey: "chapter-fast",
        label: "章节快写",
        endpointId: "endpoint-writing",
        modelId: "writer-model",
        taskType: "generate_chapter",
        temperature: 0.81,
        maxTokens: 1501,
      },
      {
        presetKey: "deep-review",
        label: "深度审稿",
        endpointId: null,
        modelId: "review-model",
        taskType: "review_content",
        temperature: 0.22,
        maxTokens: 901,
      },
    ]);

    expect(
      buildAppliedApiPresetState(writingPreset, {
        fallbackEndpointId: "endpoint-fallback",
        buildInstruction: (taskType) => `instruction:${taskType}`,
      }),
    ).toEqual({
      activeApiPresetKey: "chapter-fast",
      endpointId: "endpoint-writing",
      modelId: "writer-model",
      taskType: "generate_chapter",
      temperature: "0.81",
      maxTokens: "1501",
      userInstruction: "instruction:generate_chapter",
    });

    expect(
      buildAppliedApiPresetState(reviewPreset, {
        fallbackEndpointId: "endpoint-fallback",
        buildInstruction: (taskType) => `instruction:${taskType}`,
      }),
    ).toEqual({
      activeApiPresetKey: "deep-review",
      endpointId: "endpoint-fallback",
      modelId: "review-model",
      taskType: "review_content",
      temperature: "0.22",
      maxTokens: "901",
      userInstruction: "instruction:review_content",
    });
  });
});
