import { describe, expect, it } from "vitest";

import { buildAppliedApiPresetState, normalizeApiPresets } from "@/lib/projects/api-presets";

describe("api presets", () => {
  it("normalizes missing presets back to the fixed writing/review/research set", () => {
    const presets = normalizeApiPresets([
      {
        presetKey: "writing",
        label: "自定义写作",
        endpointId: "endpoint-writing",
        modelId: "writer-model",
        taskType: "generate_chapter",
        temperature: 0.9,
        maxTokens: 1500,
      },
    ]);

    expect(presets).toEqual([
      {
        presetKey: "writing",
        label: "自定义写作",
        endpointId: "endpoint-writing",
        modelId: "writer-model",
        taskType: "generate_chapter",
        temperature: 0.9,
        maxTokens: 1500,
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
    ]);
  });

  it("builds workbench state from the selected preset and falls back to the first endpoint when needed", () => {
    const [writingPreset, reviewPreset] = normalizeApiPresets([
      {
        presetKey: "writing",
        label: "写作预设",
        endpointId: "endpoint-writing",
        modelId: "writer-model",
        taskType: "generate_chapter",
        temperature: 0.81,
        maxTokens: 1501,
      },
      {
        presetKey: "review",
        label: "审稿预设",
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
      activeApiPresetKey: "writing",
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
      activeApiPresetKey: "review",
      endpointId: "endpoint-fallback",
      modelId: "review-model",
      taskType: "review_content",
      temperature: "0.22",
      maxTokens: "901",
      userInstruction: "instruction:review_content",
    });
  });
});
