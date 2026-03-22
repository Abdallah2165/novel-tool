const REVISION_SUMMARY_LABELS: Record<string, string> = {
  "Project bootstrap template": "项目初始化模板",
  "Project bootstrap from onboarding": "根据初始化问答生成",
  "Project bootstrap extra artifact": "初始化补充文件",
  "Chapter scaffold": "章节初始骨架",
};

export function getRevisionSummaryLabel(summary: string | null | undefined) {
  const normalized = summary?.trim();

  if (!normalized) {
    return "未写摘要";
  }

  return REVISION_SUMMARY_LABELS[normalized] ?? normalized;
}
