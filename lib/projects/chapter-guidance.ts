export type ChapterGuidanceOption = {
  label: string;
  value: string;
};

export type ChapterGuidancePrompt = {
  question: string;
  hint: string;
  options: ChapterGuidanceOption[];
};

export type ChapterGuidanceInput = {
  projectName: string;
  genre: string;
  platform: string;
  chapterTitle: string;
  chapterContent?: string | null;
  currentState?: string | null;
  taskPlan?: string | null;
  pendingHooks?: string | null;
  findings?: string | null;
};

function sanitizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function dedupeOptions(options: ChapterGuidanceOption[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    const value = sanitizeText(option.value);
    if (!option.label.trim() || !value || seen.has(value)) {
      return false;
    }

    option.value = value;
    seen.add(value);
    return true;
  });
}

function inferTrack(genre: string) {
  const normalized = genre.toLowerCase();

  if (/(港综|商战|金融|财阀)/.test(normalized)) {
    return "gangster_business";
  }

  if (/(历史|权谋|朝堂)/.test(normalized)) {
    return "historical_power";
  }

  if (/(仙侠|玄幻|修仙)/.test(normalized)) {
    return "fantasy";
  }

  return "general";
}

function buildOptionCatalog(input: ChapterGuidanceInput) {
  const track = inferTrack(input.genre);

  return {
    objective: {
      label: "先立本章目标",
      value: `这一章先把《${input.chapterTitle}》的阶段目标立住，让读者明确主角这一章想赢什么、要解决什么，再展开后续阻力。`,
    },
    conflict: track === "gangster_business"
      ? {
          label: "先升级正面冲突",
          value: "这一章优先让对手、监管或灰线势力把压力压上来，逼主角在资金链、盟友和底牌之间做选择。",
        }
      : {
          label: "先升级正面冲突",
          value: "这一章优先让外部阻力和失败代价压上来，逼主角尽快做出高价值选择，而不是平推过场。",
        },
    reveal: {
      label: "先释放关键信息",
      value: "这一章先揭开一条关键线索、伏笔回收或局势反转，让读者知道为什么局面开始变复杂。",
    },
    relationship: {
      label: "先推动人物关系",
      value: "这一章重点放在角色站队、合作破裂或关系反转，让人和利益链先动起来，再承接后续剧情升级。",
    },
  };
}

export function buildChapterGuidancePrompt(input: ChapterGuidanceInput): ChapterGuidancePrompt {
  const contextText = [
    sanitizeText(input.chapterContent),
    sanitizeText(input.currentState),
    sanitizeText(input.taskPlan),
    sanitizeText(input.pendingHooks),
    sanitizeText(input.findings),
  ].join("\n");
  const catalog = buildOptionCatalog(input);
  const options: ChapterGuidanceOption[] = [catalog.objective];

  if (/(敌|危机|围剿|阻力|追杀|死线|代价|压上来)/.test(contextText)) {
    options.push(catalog.conflict);
  }

  if (/(伏笔|线索|真相|秘密|情报|回收)/.test(contextText)) {
    options.push(catalog.reveal);
  }

  if (/(关系|盟友|合作|背叛|站队|阵营)/.test(contextText)) {
    options.push(catalog.relationship);
  }

  if (options.length < 3) {
    options.push(catalog.conflict);
  }
  if (options.length < 4) {
    options.push(catalog.reveal);
  }
  if (options.length < 4) {
    options.push(catalog.relationship);
  }

  return {
    question:
      sanitizeText(input.chapterContent).length < 120
        ? `《${input.chapterTitle}》开场最该先把哪件事立住？`
        : `《${input.chapterTitle}》下一段更适合把哪条推进线推到台前？`,
    hint: "回答只作用于本次 generate_chapter run；如果跳过，系统会按当前状态卡、卷纲和伏笔继续生成。",
    options: dedupeOptions(options).slice(0, 4),
  };
}

export function buildChapterGuidanceBrief(input: {
  chapterTitle: string;
  guidanceAnswer: string;
}) {
  const answer = sanitizeText(input.guidanceAnswer);
  if (!answer) {
    return "";
  }

  return [
    "【本章推进摘要】",
    `章节：${input.chapterTitle}`,
    `作者本次选择：${answer}`,
    "生成要求：先围绕这条推进线组织本章目标、冲突升级、信息揭示和章节钩子。",
    "这段摘要只作用于当前 run / 当前 draft，不得直接覆盖长期设定文件。",
  ].join("\n");
}

export function buildChapterGuidanceRunInstruction(input: {
  baseInstruction: string;
  chapterTitle: string;
  guidanceAnswer: string;
}) {
  const baseInstruction = input.baseInstruction.trim();
  const guidanceBrief = buildChapterGuidanceBrief({
    chapterTitle: input.chapterTitle,
    guidanceAnswer: input.guidanceAnswer,
  });

  return guidanceBrief ? `${baseInstruction}\n\n${guidanceBrief}`.trim() : baseInstruction;
}
