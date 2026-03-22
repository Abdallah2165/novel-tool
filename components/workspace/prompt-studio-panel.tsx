import promptRouting from "@/knowledge/schemas/prompt-routing.json";
import skillComposition from "@/knowledge/schemas/skill-composition.json";
import taskTypes from "@/knowledge/schemas/task-types.json";

import { Badge } from "@/components/ui/badge";
import { SectionPanel } from "@/components/section-panel";
import { getArtifactDisplayLabel } from "@/lib/projects/artifact-display";
import { loadKnowledgeBase } from "@/lib/knowledge";
import { normalizeApiPresets } from "@/lib/projects/api-presets";
import { getWorkbenchSnapshot } from "@/lib/scaffold-data";
import {
  getPromptTemplateLabel,
  getSkillDisplayLabel,
  getTaskDescription,
  getTaskDisplayLabel,
  getTaskLabel,
  getTaskMeta,
} from "@/lib/tasks/catalog";
import { TASK_TYPES } from "@/lib/types/domain";

import { ProjectOverlayEditor } from "./project-overlay-editor";
import { ProjectPreferenceForm } from "./project-preference-form";

type WorkbenchProject = Awaited<ReturnType<typeof getWorkbenchSnapshot>>;
type ResolvedWorkbenchProject = NonNullable<WorkbenchProject>;

type PromptRoutingRow = {
  taskType: string;
  promptFile: string;
  outputContract: string;
};

type SkillCompositionRow = {
  taskType: string;
  skills: string[];
  notes?: string;
};

type TaskTypeRow = {
  taskType: string;
  requiresArtifacts: string[];
  outputContract: string;
};

export async function PromptStudioPanel({ project }: { project: ResolvedWorkbenchProject }) {
  const knowledge = await loadKnowledgeBase();
  const apiPresets = normalizeApiPresets(project.preference?.apiPresets);
  const endpointMap = new Map(project.providerEndpoints.map((endpoint) => [endpoint.id, endpoint]));
  const promptOverlay = project.artifacts.find((artifact) => artifact.artifactKey === "project_prompt_pack") ?? null;
  const skillOverlay = project.artifacts.find((artifact) => artifact.artifactKey === "project_skill_pack") ?? null;
  const onboardingBrief = project.artifacts.find((artifact) => artifact.artifactKey === "onboarding_brief") ?? null;
  const taskCatalog = TASK_TYPES.map((taskType) => {
    const promptMeta = (promptRouting as PromptRoutingRow[]).find((item) => item.taskType === taskType);
    const skillMeta = (skillComposition as SkillCompositionRow[]).find((item) => item.taskType === taskType);
    const taskMeta = (taskTypes as TaskTypeRow[]).find((item) => item.taskType === taskType);

    return {
      taskType,
      label: getTaskLabel(taskType),
      description: getTaskDescription(taskType),
      supportsMcp: getTaskMeta(taskType).supportsMcp,
      supportsSearch: getTaskMeta(taskType).supportsSearch,
      promptFile: promptMeta?.promptFile ?? "workflow_check.md",
      promptLabel: getPromptTemplateLabel(promptMeta?.promptFile ?? "workflow_check.md"),
      outputContract: promptMeta?.outputContract ?? taskMeta?.outputContract ?? "结构化输出",
      promptContent: knowledge.prompts[promptMeta?.promptFile ?? "workflow_check.md"] ?? "",
      requiredArtifacts: taskMeta?.requiresArtifacts ?? [],
      notes: skillMeta?.notes ?? "",
      skills: (skillMeta?.skills ?? []).map((skillName) => ({
        name: skillName,
        displayLabel: getSkillDisplayLabel(skillName),
        content: knowledge.skills[`${skillName}.md`] ?? "",
      })),
    };
  });

  return (
    <div className="space-y-5">
      <SectionPanel
        title="提示词工坊"
        description="这里集中展示任务提示模板、写作规则装配，以及项目专属补充规则和参数预设。"
        action={<Badge>{taskCatalog.length} 个任务模板</Badge>}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">默认任务</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              {project.preference?.defaultTaskType ? getTaskDisplayLabel(project.preference.defaultTaskType) : "未设置"}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">默认模型接口</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              {project.preference?.defaultEndpointId
                ? endpointMap.get(project.preference.defaultEndpointId)?.label ?? "未匹配到当前接口"
                : "未设置"}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">项目专属规则</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              {[
                promptOverlay ? getArtifactDisplayLabel(promptOverlay.artifactKey, promptOverlay.filename) : null,
                skillOverlay ? getArtifactDisplayLabel(skillOverlay.artifactKey, skillOverlay.filename) : null,
              ]
                .filter(Boolean)
                .join(" / ") || "未生成"}
            </p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="项目专属补充规则" description="直接维护 AI 初始化生成的提示补充和规则补充，并保留历史版本。">
        <ProjectOverlayEditor
          key={[
            promptOverlay?.currentRevision?.id ?? "no-prompt-revision",
            skillOverlay?.currentRevision?.id ?? "no-skill-revision",
            onboardingBrief?.currentRevision?.id ?? "no-brief-revision",
          ].join(":")}
          projectId={project.id}
          promptOverlay={
            promptOverlay
              ? {
                  id: promptOverlay.id,
                  artifactKey: promptOverlay.artifactKey,
                  filename: promptOverlay.filename,
                  currentRevision: promptOverlay.currentRevision,
                }
              : null
          }
          skillOverlay={
            skillOverlay
              ? {
                  id: skillOverlay.id,
                  artifactKey: skillOverlay.artifactKey,
                  filename: skillOverlay.filename,
                  currentRevision: skillOverlay.currentRevision,
                }
              : null
          }
          onboardingBrief={
            onboardingBrief
              ? {
                  id: onboardingBrief.id,
                  artifactKey: onboardingBrief.artifactKey,
                  filename: onboardingBrief.filename,
                  currentRevision: onboardingBrief.currentRevision,
                }
              : null
          }
        />
      </SectionPanel>

      <SectionPanel title="默认参数与 API 预设" description="项目级模型默认值和写作 / 审稿 / 考据三类预设统一在这里保存。">
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {apiPresets.map((preset) => {
            const endpoint = preset.endpointId ? endpointMap.get(preset.endpointId) : null;

            return (
              <div key={preset.presetKey} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
                <p className="text-sm text-[var(--ink)]">{preset.label}</p>
                <p className="mt-2 text-xs leading-6 text-[var(--muted-ink)]">
                  任务：{getTaskDisplayLabel(preset.taskType)}
                  <br />
                  模型接口：{endpoint?.label ?? "未设置"}
                  <br />
                  模型：{preset.modelId ?? "未设置"}
                  <br />
                  随机度：{preset.temperature ?? "未设置"} / 最大输出字数：{preset.maxTokens ?? "未设置"}
                </p>
              </div>
            );
          })}
        </div>

        <ProjectPreferenceForm projectId={project.id} preference={project.preference} endpoints={project.providerEndpoints} />
      </SectionPanel>

      <SectionPanel title="任务模板目录" description="按任务查看提示模板、规则组合、所需项目文件和输出要求。">
        <div className="space-y-3">
          {taskCatalog.map((task) => (
            <details key={task.taskType} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
              <summary className="cursor-pointer text-sm text-[var(--ink)]">{task.label}</summary>
              <div className="mt-3 space-y-4">
                <div className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,250,243,0.72)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-[rgba(85,109,89,0.12)] text-[#556d59]">{task.label}</Badge>
                    {task.supportsMcp ? <Badge className="bg-[rgba(64,83,102,0.08)] text-[#405366]">支持 MCP</Badge> : null}
                    {task.supportsSearch ? <Badge className="bg-[rgba(191,152,69,0.10)] text-[#7f5f1d]">支持外部事实</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{task.description}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border border-[var(--line)] p-3">
                    <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">提示模板</p>
                    <p className="mt-2 text-sm text-[var(--ink)]">{task.promptLabel}</p>
                    <p className="mt-1 text-xs text-[var(--muted-ink)]">{task.promptFile}</p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--line)] p-3">
                    <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">默认项目文件</p>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">
                      {task.requiredArtifacts.length > 0
                        ? task.requiredArtifacts.map((artifactKey) => getArtifactDisplayLabel(artifactKey)).join(" / ")
                        : "无"}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--line)] p-3">
                    <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">输出要求</p>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">{task.outputContract}</p>
                  </div>
                </div>

                {task.notes ? (
                  <p className="text-sm leading-6 text-[var(--muted-ink)]">规则说明：{task.notes}</p>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[18px] border border-[var(--line)] p-3">
                    <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">提示模板内容</p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--ink-soft)]">
                      {task.promptContent}
                    </pre>
                  </div>
                  <div className="space-y-3">
                    {task.skills.map((skill) => (
                      <div key={`${task.taskType}-${skill.name}`} className="rounded-[18px] border border-[var(--line)] p-3">
                        <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">{skill.displayLabel}</p>
                        <p className="mt-1 text-xs text-[var(--muted-ink)]">{skill.name}.md</p>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[var(--ink-soft)]">
                          {skill.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
