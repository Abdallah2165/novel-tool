import taskTypes from "@/knowledge/schemas/task-types.json";

type TaskCatalogRow = {
  taskType: string;
  label: string;
  description: string;
  requiresArtifacts: string[];
  defaultPrompt: string;
  defaultSkills: string[];
  supportsMcp: boolean;
  supportsSearch: boolean;
  outputContract: string;
};

const TASK_CATALOG = taskTypes as TaskCatalogRow[];

const TASK_CATALOG_BY_TYPE = new Map(TASK_CATALOG.map((item) => [item.taskType, item]));

const RUN_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消",
};

const DRAFT_STATUS_LABELS: Record<string, string> = {
  pending: "处理中",
  ready: "待处理",
  accepted: "已回填",
  rejected: "已放弃",
  superseded: "已被新稿覆盖",
};

const DRAFT_KIND_LABELS: Record<string, string> = {
  generated_output: "生成结果",
  editor_autosave: "编辑器自动保存",
  review_revision: "审稿修订稿",
};

const PROMPT_TEMPLATE_LABELS: Record<string, string> = {
  "ingest_sources.md": "资料吸收模板",
  "workflow_check.md": "流程检查模板",
  "generate_setting.md": "设定生成模板",
  "generate_outline.md": "大纲生成模板",
  "generate_chapter.md": "章节生成模板",
  "review_content.md": "内容审稿模板",
  "minimal_fix.md": "最小修法模板",
  "sync_state.md": "状态回填模板",
  "research_fact_check.md": "考据核查模板",
};

const SKILL_LABELS: Record<string, string> = {
  planner: "流程规划",
  setting_architect: "设定构建",
  writer: "正文创作",
  reviewer: "内容审阅",
  researcher: "事实考据",
  ledger_keeper: "状态维护",
  project_skill_pack: "项目规则补充",
};

export function getTaskMeta(taskType: string) {
  return (
    TASK_CATALOG_BY_TYPE.get(taskType) ?? {
      taskType,
      label: taskType,
      description: "暂无任务说明。",
      requiresArtifacts: [],
      defaultPrompt: "",
      defaultSkills: [],
      supportsMcp: false,
      supportsSearch: false,
      outputContract: "",
    }
  );
}

export function getTaskLabel(taskType: string) {
  return getTaskMeta(taskType).label;
}

export function getTaskDescription(taskType: string) {
  return getTaskMeta(taskType).description;
}

export function getTaskDisplayLabel(taskType: string) {
  return getTaskMeta(taskType).label;
}

export function getRunStatusLabel(status: string) {
  return RUN_STATUS_LABELS[status] ?? status;
}

export function getDraftStatusLabel(status: string) {
  return DRAFT_STATUS_LABELS[status] ?? status;
}

export function getDraftKindLabel(kind: string) {
  return DRAFT_KIND_LABELS[kind] ?? kind;
}

export function getPromptTemplateLabel(filename: string) {
  return PROMPT_TEMPLATE_LABELS[filename] ?? filename;
}

export function getSkillDisplayLabel(skillName: string) {
  return SKILL_LABELS[skillName] ?? skillName;
}
