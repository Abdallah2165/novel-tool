"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProviderTypeLabel } from "@/lib/integrations/display-labels";
import { getHealthStatusLabel } from "@/lib/integrations/health-status";
import { createDefaultApiPresets, normalizeApiPresets, type ApiPreset } from "@/lib/projects/api-presets";
import { getTaskDescription, getTaskDisplayLabel } from "@/lib/tasks/catalog";
import type { TaskType } from "@/lib/types/domain";
import { TASK_TYPES } from "@/lib/types/domain";

type EndpointItem = {
  id: string;
  label: string;
  providerType: string;
  baseURL: string;
  defaultModel: string;
  healthStatus: string;
};

type Preference = {
  defaultEndpointId?: string | null;
  defaultModel?: string | null;
  defaultTaskType?: string | null;
  apiPresets?: unknown;
};

type EditableApiPreset = {
  presetKey: string;
  label: string;
  endpointId: string;
  modelId: string;
  taskType: TaskType;
  temperature: string;
  maxTokens: string;
};

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return payload?.error?.message ?? "保存失败。";
}

function readNullableString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function toNullableString(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function toNullableNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toEditableApiPreset(preset: ApiPreset): EditableApiPreset {
  return {
    presetKey: preset.presetKey,
    label: preset.label,
    endpointId: preset.endpointId ?? "",
    modelId: preset.modelId ?? "",
    taskType: preset.taskType,
    temperature: preset.temperature != null ? String(preset.temperature) : "",
    maxTokens: preset.maxTokens != null ? String(preset.maxTokens) : "",
  };
}

function buildPresetKey() {
  return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildNewPreset(index: number): EditableApiPreset {
  return {
    presetKey: buildPresetKey(),
    label: `新预设 ${index + 1}`,
    endpointId: "",
    modelId: "",
    taskType: "generate_chapter",
    temperature: "0.7",
    maxTokens: "1200",
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, moved);
  return nextItems;
}

export function ProjectPreferenceForm({
  projectId,
  endpoints,
  preference,
}: {
  projectId: string;
  endpoints: EndpointItem[];
  preference: Preference | null | undefined;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedDefaultEndpointId, setSelectedDefaultEndpointId] = useState(preference?.defaultEndpointId ?? "");
  const [apiPresets, setApiPresets] = useState<EditableApiPreset[]>(() =>
    normalizeApiPresets(preference?.apiPresets).map(toEditableApiPreset),
  );

  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === selectedDefaultEndpointId) ?? null,
    [endpoints, selectedDefaultEndpointId],
  );

  function updatePreset(presetKey: string, patch: Partial<EditableApiPreset>) {
    setApiPresets((current) =>
      current.map((preset) => (preset.presetKey === presetKey ? { ...preset, ...patch } : preset)),
    );
  }

  function addPreset() {
    setApiPresets((current) => [...current, buildNewPreset(current.length)]);
  }

  function restoreExamplePresets() {
    setApiPresets(createDefaultApiPresets().map(toEditableApiPreset));
  }

  function removePreset(presetKey: string) {
    setApiPresets((current) => current.filter((preset) => preset.presetKey !== presetKey));
  }

  function movePreset(presetKey: string, direction: -1 | 1) {
    setApiPresets((current) => {
      const currentIndex = current.findIndex((preset) => preset.presetKey === presetKey);
      return moveItem(current, currentIndex, currentIndex + direction);
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        setMessage(null);

        const nextApiPresets = apiPresets.map((preset, index) => ({
          presetKey: preset.presetKey,
          label: preset.label.trim() || `预设 ${index + 1}`,
          endpointId: toNullableString(preset.endpointId),
          modelId: toNullableString(preset.modelId),
          taskType: preset.taskType,
          temperature: toNullableNumber(preset.temperature),
          maxTokens: toNullableNumber(preset.maxTokens),
        }));

        startTransition(async () => {
          const response = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              defaultEndpointId: readNullableString(formData, "defaultEndpointId"),
              defaultModel: readNullableString(formData, "defaultModel"),
              defaultTaskType: readNullableString(formData, "defaultTaskType"),
              apiPresets: nextApiPresets,
            }),
          });

          if (!response.ok) {
            setError(await readErrorMessage(response));
            return;
          }

          setMessage("项目默认参数和 API 预设已保存。");
          router.refresh();
        });
      }}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">默认任务</label>
          <Select name="defaultTaskType" defaultValue={preference?.defaultTaskType ?? "generate_chapter"}>
            {TASK_TYPES.map((taskType) => (
              <option key={taskType} value={taskType}>
                {getTaskDisplayLabel(taskType)}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs leading-6 text-[var(--muted-ink)]">
            工作台初始会默认选中这个任务。
            {preference?.defaultTaskType ? ` 当前说明：${getTaskDescription(preference.defaultTaskType)}` : ""}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">默认模型接口</label>
          <Select
            name="defaultEndpointId"
            defaultValue={preference?.defaultEndpointId ?? ""}
            onChange={(event) => setSelectedDefaultEndpointId(event.target.value)}
          >
            <option value="">未设置</option>
            {endpoints.map((endpoint) => (
              <option key={endpoint.id} value={endpoint.id}>
                {endpoint.label} · {getProviderTypeLabel(endpoint.providerType)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">默认模型</label>
          <Input
            name="defaultModel"
            defaultValue={preference?.defaultModel ?? selectedEndpoint?.defaultModel ?? ""}
            placeholder="例如 gpt-5"
          />
        </div>

        {selectedEndpoint ? (
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4 text-xs leading-6 text-[var(--muted-ink)]">
            <p>当前接口：{selectedEndpoint.label}</p>
            <p className="truncate">URL：{selectedEndpoint.baseURL}</p>
            <p>健康状态：{getHealthStatusLabel(selectedEndpoint.healthStatus)}</p>
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-xs leading-6 text-[var(--muted-ink)]">
            还没有默认模型接口。可以先去 <Link href="/settings" className="underline">设置页</Link> 创建。
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] pt-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">API 预设</p>
            <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
              预设现在支持新增、删除和排序，工作台会按这里保存的顺序展示。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={addPreset}>
              新增预设
            </Button>
            {apiPresets.length === 0 ? (
              <Button type="button" size="sm" variant="secondary" onClick={restoreExamplePresets}>
                恢复示例预设
              </Button>
            ) : null}
          </div>
        </div>

        {apiPresets.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--muted-ink)]">
            当前还没有 API 预设。你可以新增空白预设，或者恢复默认的写作 / 审稿 / 考据示例。
          </div>
        ) : (
          <div className="space-y-4">
            {apiPresets.map((preset, index) => (
              <div key={preset.presetKey} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--ink)]">{preset.label.trim() || `预设 ${index + 1}`}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
                      位置 #{index + 1} · 任务：{getTaskDisplayLabel(preset.taskType)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={index === 0}
                      onClick={() => movePreset(preset.presetKey, -1)}
                    >
                      上移
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={index === apiPresets.length - 1}
                      onClick={() => movePreset(preset.presetKey, 1)}
                    >
                      下移
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-[#9f3a2f] hover:bg-[rgba(159,58,47,0.08)] hover:text-[#9f3a2f]"
                      onClick={() => removePreset(preset.presetKey)}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">预设名称</label>
                    <Input
                      value={preset.label}
                      onChange={(event) => updatePreset(preset.presetKey, { label: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">任务类型</label>
                    <Select
                      value={preset.taskType}
                      onChange={(event) => updatePreset(preset.presetKey, { taskType: event.target.value as TaskType })}
                    >
                      {TASK_TYPES.map((taskType) => (
                        <option key={taskType} value={taskType}>
                          {getTaskDisplayLabel(taskType)}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-xs leading-6 text-[var(--muted-ink)]">{getTaskDescription(preset.taskType)}</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">模型接口</label>
                    <Select
                      value={preset.endpointId}
                      onChange={(event) => updatePreset(preset.presetKey, { endpointId: event.target.value })}
                    >
                      <option value="">未设置</option>
                      {endpoints.map((endpoint) => (
                        <option key={endpoint.id} value={endpoint.id}>
                          {endpoint.label} · {getProviderTypeLabel(endpoint.providerType)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">模型</label>
                    <Input
                      value={preset.modelId}
                      placeholder="例如 gpt-5"
                      onChange={(event) => updatePreset(preset.presetKey, { modelId: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">随机度</label>
                    <Input
                      value={preset.temperature}
                      placeholder="0 - 2"
                      onChange={(event) => updatePreset(preset.presetKey, { temperature: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">最大输出字数</label>
                    <Input
                      value={preset.maxTokens}
                      placeholder="例如 1200"
                      onChange={(event) => updatePreset(preset.presetKey, { maxTokens: event.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted-ink)]">
          默认参数决定初始模型面板；API 预设用于在工作台里一键切换不同模型组合。
        </p>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "保存中" : "保存默认参数与预设"}
        </Button>
      </div>

      {error ? <p className="text-sm text-[#9f3a2f]">{error}</p> : null}
      {message ? <p className="text-sm text-[#556d59]">{message}</p> : null}
    </form>
  );
}
