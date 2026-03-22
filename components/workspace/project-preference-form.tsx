"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getProviderTypeLabel } from "@/lib/integrations/display-labels";
import { getHealthStatusLabel } from "@/lib/integrations/health-status";
import { API_PRESET_KEYS, normalizeApiPresets } from "@/lib/projects/api-presets";
import { getTaskDescription, getTaskDisplayLabel } from "@/lib/tasks/catalog";
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

const PRESET_DESCRIPTIONS: Record<(typeof API_PRESET_KEYS)[number], string> = {
  writing: "写作时优先用这套模型接口、模型和采样参数。",
  review: "审稿和最小修法优先用这套配置。",
  research: "考据和事实补充优先用这套配置。",
};

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return payload?.error?.message ?? "保存失败。";
}

function readNullableString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readNullableNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === selectedDefaultEndpointId) ?? null,
    [endpoints, selectedDefaultEndpointId],
  );
  const apiPresets = normalizeApiPresets(preference?.apiPresets);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        setMessage(null);

        const nextApiPresets = apiPresets.map((preset) => ({
          presetKey: preset.presetKey,
          label: String(formData.get(`preset_${preset.presetKey}_label`) ?? "").trim() || preset.label,
          endpointId: readNullableString(formData, `preset_${preset.presetKey}_endpointId`),
          modelId: readNullableString(formData, `preset_${preset.presetKey}_modelId`),
          taskType: String(formData.get(`preset_${preset.presetKey}_taskType`) ?? preset.taskType),
          temperature: readNullableNumber(formData, `preset_${preset.presetKey}_temperature`),
          maxTokens: readNullableNumber(formData, `preset_${preset.presetKey}_maxTokens`),
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
        <div className="mb-3">
          <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">API 预设</p>
          <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">
            固定保留写作、审稿、考据三类项目级预设，工作台可一键切换。
          </p>
        </div>

        <div className="space-y-4">
          {apiPresets.map((preset) => (
            <div key={preset.presetKey} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
              <div className="mb-3">
                <p className="text-sm text-[var(--ink)]">{preset.label}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">{PRESET_DESCRIPTIONS[preset.presetKey]}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">预设名称</label>
                  <Input name={`preset_${preset.presetKey}_label`} defaultValue={preset.label} />
                </div>
                <div>
                  <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">任务类型</label>
                  <Select name={`preset_${preset.presetKey}_taskType`} defaultValue={preset.taskType}>
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
                  <Select name={`preset_${preset.presetKey}_endpointId`} defaultValue={preset.endpointId ?? ""}>
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
                    name={`preset_${preset.presetKey}_modelId`}
                    defaultValue={preset.modelId ?? ""}
                    placeholder="例如 gpt-5"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">随机度</label>
                  <Input
                    name={`preset_${preset.presetKey}_temperature`}
                    defaultValue={preset.temperature ?? ""}
                    placeholder="0 - 2"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">最大输出字数</label>
                  <Input
                    name={`preset_${preset.presetKey}_maxTokens`}
                    defaultValue={preset.maxTokens ?? ""}
                    placeholder="例如 1200"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted-ink)]">
          默认参数决定初始模型面板；API 预设用于在写作、审稿、考据之间快速切换不同模型组合。
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
