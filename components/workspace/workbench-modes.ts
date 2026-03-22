export const WORKBENCH_MODES = [
  "task",
  "writing",
  "review",
  "prompt-studio",
  "task-center",
  "export",
] as const;

export type WorkbenchMode = (typeof WORKBENCH_MODES)[number];

export const WORKBENCH_MODE_META: Array<{
  value: WorkbenchMode;
  label: string;
  description: string;
}> = [
  {
    value: "task",
    label: "任务执行",
    description: "装配提示模板、写作规则和项目上下文，并生成新的草稿。",
  },
  {
    value: "writing",
    label: "正文写作",
    description: "聚焦章节编辑、草稿保存和正文工作区。",
  },
  {
    value: "review",
    label: "审阅改稿",
    description: "围绕问题、证据、最小修法处理当前章节。",
  },
  {
    value: "prompt-studio",
    label: "提示词工坊",
    description: "查看任务模板、规则组合和项目专属补充规则。",
  },
  {
    value: "task-center",
    label: "任务中心",
    description: "查看最近运行、待处理草稿和推荐下一步。",
  },
  {
    value: "export",
    label: "导出与交付",
    description: "导出正式章节、设定快照和项目状态摘要。",
  },
];

export function isWorkbenchMode(value: string | undefined | null): value is WorkbenchMode {
  return typeof value === "string" && WORKBENCH_MODES.includes(value as WorkbenchMode);
}
