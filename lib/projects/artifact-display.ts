const ARTIFACT_LABELS: Record<string, string> = {
  story_background: "故事前提",
  world_bible: "世界规则",
  protagonist_card: "主角卡",
  factions_and_characters: "势力与角色",
  writing_rules: "写作规则",
  task_plan: "任务计划",
  findings: "资料摘记",
  progress: "推进记录",
  character_relationships: "关系图谱",
  current_state_card: "当前状态卡",
  pending_hooks: "待用钩子",
  particle_ledger: "伏笔账本",
  outline_master: "总纲",
  review_report: "审稿报告",
  onboarding_brief: "初始化摘要",
  project_prompt_pack: "项目提示补充",
  project_skill_pack: "项目规则补充",
};

function normalizeArtifactKey(artifactKey: string, filename?: string) {
  const fileStem = filename ? filename.replace(/\.md$/i, "") : null;

  if (ARTIFACT_LABELS[artifactKey]) {
    return artifactKey;
  }

  if (fileStem && ARTIFACT_LABELS[fileStem]) {
    return fileStem;
  }

  return artifactKey;
}

function getChapterLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = /^chapter_(\d+)$/i.exec(value.replace(/\.md$/i, ""));
  if (!match) {
    return null;
  }

  return `第${Number(match[1])}章`;
}

export function getArtifactDisplayLabel(artifactKey: string, filename?: string) {
  const chapterLabel = getChapterLabel(artifactKey) ?? getChapterLabel(filename);
  if (chapterLabel) {
    return chapterLabel;
  }

  const normalizedKey = normalizeArtifactKey(artifactKey, filename);
  return ARTIFACT_LABELS[normalizedKey] ?? filename ?? artifactKey;
}

export function getArtifactDisplayName(artifactKey: string, filename?: string) {
  const label = getArtifactDisplayLabel(artifactKey, filename);

  if (!filename || filename === label) {
    return label;
  }

  return `${label}（${filename}）`;
}
