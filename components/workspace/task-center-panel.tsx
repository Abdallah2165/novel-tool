import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { SectionPanel } from "@/components/section-panel";
import { getWorkbenchSnapshot } from "@/lib/scaffold-data";
import { getProviderTypeLabel } from "@/lib/integrations/display-labels";
import { getDraftKindLabel, getDraftStatusLabel, getRunStatusLabel, getTaskDescription, getTaskDisplayLabel, getTaskLabel } from "@/lib/tasks/catalog";
import { cn } from "@/lib/utils";

import { RunDiagnosticsSummary } from "./run-diagnostics-summary";

type WorkbenchProject = Awaited<ReturnType<typeof getWorkbenchSnapshot>>;
type ResolvedWorkbenchProject = NonNullable<WorkbenchProject>;

const MAINLINE_TASKS = [
  "generate_setting",
  "generate_outline",
  "research_fact_check",
  "generate_chapter",
  "review_content",
  "minimal_fix",
  "sync_state",
] as const;

function formatTime(value: Date | string | undefined | null) {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function previewText(value: string | null | undefined, limit = 120) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "暂无内容。";
  }

  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function formatByteSize(value: number | null | undefined) {
  if (!value || value <= 0) {
    return "未记录大小";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getStageState(project: ResolvedWorkbenchProject, taskType: string) {
  const acceptedDraft = project.drafts.find((draft) => draft.taskType === taskType && draft.status === "accepted");
  if (acceptedDraft) {
    return {
      label: "已回填",
      detail: `最近接受于 ${formatTime(acceptedDraft.updatedAt)}`,
      tone: "success",
    } as const;
  }

  const readyDraft = project.drafts.find((draft) => draft.taskType === taskType && draft.status === "ready");
  if (readyDraft) {
    return {
      label: "待处理草稿",
      detail: `最近产出于 ${formatTime(readyDraft.updatedAt)}`,
      tone: "pending",
    } as const;
  }

  const latestRun = project.runs.find((run) => run.taskType === taskType);
  if (latestRun?.status === "failed") {
    return {
      label: "运行失败",
      detail: previewText(latestRun.errorSummary, 72),
      tone: "danger",
    } as const;
  }

  if (latestRun?.status === "queued" || latestRun?.status === "running") {
      return {
        label: "运行中",
        detail: `${getRunStatusLabel(latestRun.status)} · ${formatTime(latestRun.createdAt)}`,
        tone: "pending",
      } as const;
  }

  return {
    label: "未开始",
    detail: "该阶段还没有有效运行记录或草稿。",
    tone: "idle",
  } as const;
}

function buildRecommendedNextSteps(project: ResolvedWorkbenchProject) {
  const steps: Array<{ title: string; detail: string }> = [];
  const hasAccepted = (taskType: string) =>
    project.drafts.some((draft) => draft.taskType === taskType && draft.status === "accepted");
  const readyDrafts = project.drafts.filter((draft) => draft.status === "ready");
  const acceptedChapters = project.artifacts.filter(
    (artifact) => artifact.kind === "project_chapter" && artifact.currentRevision?.content?.trim(),
  );

  if (project.references.length === 0) {
    steps.push({
      title: "先补资料区输入",
      detail: "先上传 txt / md / html 资料，再执行资料吸收。",
    });
  }

  if (!hasAccepted("generate_setting")) {
    steps.push({
      title: "先补设定阶段",
      detail: "主链里设定是卷纲和正文的前置条件，建议先产出并回填 world_bible 等设定文件。",
    });
  } else if (!hasAccepted("generate_outline")) {
    steps.push({
      title: "继续卷纲阶段",
      detail: "设定已落库后，下一步优先补齐 task_plan / outline_master。",
    });
  } else if (acceptedChapters.length === 0) {
    steps.push({
      title: "进入正文首章",
      detail: "已有设定和卷纲，可以切到任务执行或正文写作模式生成并整理第一章。",
    });
  }

  if (!hasAccepted("research_fact_check") && project.mcpServers.length > 0) {
    steps.push({
      title: "补一次考据支线",
      detail: "当前项目已经接好 MCP，涉及现实信息时建议先跑 research_fact_check。",
    });
  }

  if (readyDrafts.length > 0) {
    steps.push({
      title: "处理待接受草稿",
      detail: `结果面板里还有 ${readyDrafts.length} 条待处理草稿，先回填再继续下一步更稳。`,
    });
  } else if (acceptedChapters.length > 0) {
    steps.push({
      title: "收尾状态同步",
      detail: "章节和审稿链路已经开始产出，建议补一次 sync_state 更新进度与状态卡。",
    });
  }

  return steps.slice(0, 4);
}

function getToneClass(tone: "success" | "pending" | "danger" | "idle") {
  switch (tone) {
    case "success":
      return "border-[#b7d1bd] bg-[rgba(85,109,89,0.08)] text-[#556d59]";
    case "pending":
      return "border-[#d9c79c] bg-[rgba(191,152,69,0.10)] text-[#7f5f1d]";
    case "danger":
      return "border-[#d8b3aa] bg-[rgba(159,58,47,0.08)] text-[#9f3a2f]";
    default:
      return "border-[var(--line)] bg-[var(--paper)] text-[var(--muted-ink)]";
  }
}

export function TaskCenterPanel({ project }: { project: ResolvedWorkbenchProject }) {
  const readyDrafts = project.drafts.filter((draft) => draft.status === "ready");
  const nextSteps = buildRecommendedNextSteps(project);

  return (
    <div className="space-y-5">
      <SectionPanel title="任务中心" description="集中查看主链状态、最近运行和当前需要处理的草稿。">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">最近运行</p>
            <p className="mt-2 text-2xl text-[var(--ink)]">{project.runs.length}</p>
            <p className="mt-1 text-sm text-[var(--muted-ink)]">按最新 12 次任务窗口展示</p>
          </div>
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">待处理草稿</p>
            <p className="mt-2 text-2xl text-[var(--ink)]">{readyDrafts.length}</p>
            <p className="mt-1 text-sm text-[var(--muted-ink)]">需要在结果面板里接受或放弃</p>
          </div>
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">正式章节</p>
            <p className="mt-2 text-2xl text-[var(--ink)]">
              {project.artifacts.filter((artifact) => artifact.kind === "project_chapter" && artifact.currentRevision).length}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-ink)]">当前已形成正式版本的章节数</p>
          </div>
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
            <p className="text-xs tracking-[0.14em] text-[var(--muted-ink)] uppercase">主链完成度</p>
            <p className="mt-2 text-2xl text-[var(--ink)]">
              {MAINLINE_TASKS.filter((taskType) => getStageState(project, taskType).tone === "success").length}/{MAINLINE_TASKS.length}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-ink)]">按最近已回填 / 待处理 / 失败状态估算</p>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="主链阶段状态" description="沿用 `sum2yang/novel-workflow` 主链顺序，快速判断卡点在哪里。">
        <div className="grid gap-3 lg:grid-cols-2">
          {MAINLINE_TASKS.map((taskType, index) => {
            const stageState = getStageState(project, taskType);

            return (
              <div key={taskType} className={cn("rounded-[20px] border p-4", getToneClass(stageState.tone))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-[0.16em] uppercase">阶段 {index + 1}</p>
                    <p className="mt-2 text-sm text-[var(--ink)]">{getTaskLabel(taskType)}</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted-ink)]">{getTaskDescription(taskType)}</p>
                  </div>
                  <Badge className="border border-current bg-transparent text-current">{stageState.label}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6">{stageState.detail}</p>
              </div>
            );
          })}
        </div>
      </SectionPanel>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionPanel title="最近运行" description="包括模型、状态和最近生成出的草稿处理状态。">
          <div className="space-y-3">
            {project.runs.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted-ink)]">
                还没有运行记录。先去“任务执行”或“审阅改稿”模式发起一次生成。
              </div>
            ) : (
              project.runs.map((run) => (
                <div key={run.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--ink)]">{getTaskDisplayLabel(run.taskType)}</p>
                      <p className="mt-1 text-xs text-[var(--muted-ink)]">
                        {run.endpoint.label} · {getProviderTypeLabel(run.endpoint.providerType)} · {run.modelId}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "border border-current bg-transparent",
                        getToneClass(
                          run.status === "succeeded"
                            ? "success"
                            : run.status === "failed"
                              ? "danger"
                              : run.status === "queued" || run.status === "running"
                                ? "pending"
                                : "idle",
                        ),
                      )}
                    >
                      {getRunStatusLabel(run.status)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-[var(--muted-ink)]">{formatTime(run.createdAt)}</p>
                  {run.hasArchive ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className="bg-[rgba(85,109,89,0.12)] text-[#556d59]">完整结果已归档</Badge>
                      <Badge className="bg-[rgba(64,83,102,0.08)] text-[#405366]">
                        {(run.archiveObjectStoreMode === "s3" ? "对象存储" : "本地归档")} · {formatByteSize(run.archiveByteSize)}
                      </Badge>
                      {run.archiveDownloadUrl ? (
                        <ButtonLink href={run.archiveDownloadUrl} variant="secondary" size="sm">
                          下载归档
                        </ButtonLink>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                    {run.errorSummary
                      ? previewText(run.errorSummary, 120)
                      : run.drafts.length > 0
                        ? `关联草稿：${run.drafts.map((draft) => `${draft.id.slice(0, 8)} / ${getDraftStatusLabel(draft.status)}`).join("、")}`
                        : "该运行暂未关联草稿。"}
                  </p>
                  <div className="mt-3">
                    <RunDiagnosticsSummary
                      projectId={project.id}
                      toolCallsSummary={run.toolCallsSummary}
                      errorSummary={run.errorSummary}
                      compact
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionPanel>

        <SectionPanel title="待处理草稿" description="优先处理待回填结果，避免主链上下文继续漂移。">
          <div className="space-y-3">
            {readyDrafts.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted-ink)]">
                当前没有待处理草稿。可以继续推进下一步任务。
              </div>
            ) : (
              readyDrafts.map((draft) => (
                <div key={draft.id} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--ink)]">{getTaskDisplayLabel(draft.taskType)}</p>
                      <p className="mt-1 text-xs text-[var(--muted-ink)]">
                        {getDraftKindLabel(draft.draftKind)} · {formatTime(draft.updatedAt)}
                      </p>
                    </div>
                    <Badge className="border border-[#d9c79c] bg-[rgba(191,152,69,0.10)] text-[#7f5f1d]">
                      {getDraftStatusLabel(draft.status)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{previewText(draft.outputContent, 140)}</p>
                </div>
              ))
            )}
          </div>
        </SectionPanel>
      </div>

      <SectionPanel title="推荐下一步" description="按当前项目状态给出下一批最值得执行的动作。">
        <div className="grid gap-3 md:grid-cols-2">
          {nextSteps.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted-ink)]">
              当前没有明显阻塞项。建议在写作、审稿和状态同步之间继续滚动推进。
            </div>
          ) : (
            nextSteps.map((step) => (
              <div key={step.title} className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] p-4">
                <p className="text-sm text-[var(--ink)]">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{step.detail}</p>
              </div>
            ))
          )}
        </div>
      </SectionPanel>
    </div>
  );
}
