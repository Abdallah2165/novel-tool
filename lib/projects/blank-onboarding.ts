import type { ExtraProjectArtifactInput } from "@/lib/projects/bootstrap";

export type BlankMaterialDigestInput = {
  projectName: string;
  genre: string;
  platform: string;
  authorNotes?: string;
  materialFileNames: string[];
};

export type BlankGapQuestionKey = "core_conflict" | "world_rules" | "factions" | "style_research";

export type BlankGapQuestionOption = {
  label: string;
  value: string;
};

export type BlankGapQuestion = {
  key: BlankGapQuestionKey;
  title: string;
  prompt: string;
  placeholder: string;
  recommendedOptions: BlankGapQuestionOption[];
  source: "digest" | "fallback";
};

export type BlankGapAnswer = {
  questionKey: BlankGapQuestionKey;
  answer: string;
};

export type BlankMaterialDigestSections = {
  premise: string;
  worldAndCharacters: string;
  findings: string;
  gapPrompts: Partial<Record<BlankGapQuestionKey, string>>;
};

export type BlankOnboardingBootstrapInput = {
  projectName: string;
  genre: string;
  platform: string;
  authorNotes?: string;
  materialFileNames: string[];
  digestOutput: string;
  followUpAnswers: BlankGapAnswer[];
};

const GAP_KEYS: BlankGapQuestionKey[] = ["core_conflict", "world_rules", "factions", "style_research"];

const GAP_TITLES: Record<BlankGapQuestionKey, string> = {
  core_conflict: "核心冲突还缺什么",
  world_rules: "世界规则还缺什么",
  factions: "势力关系还缺什么",
  style_research: "文风与考据边界还缺什么",
};

const GAP_PLACEHOLDERS: Record<BlankGapQuestionKey, string> = {
  core_conflict: "例如：主角要在港岛金融圈站稳脚跟，但黑白两道都盯着他的现金流和底牌。",
  world_rules: "例如：异能必须付出寿命代价，不能公开展示；越线会被官方与地下势力同时追杀。",
  factions: "例如：财阀、社团、警方内线和师门是四条核心关系线，彼此既合作也互相牵制。",
  style_research: "例如：章节短钩子强，禁写降智误会；金融法规和港岛地理要做轻量考据。",
};

const GAP_LABEL_MAP: Array<{ pattern: RegExp; key: BlankGapQuestionKey }> = [
  { pattern: /核心冲突|主角目标|冲突/, key: "core_conflict" },
  { pattern: /世界规则|禁忌|能力边界|规则/, key: "world_rules" },
  { pattern: /势力关系|角色关系|势力|角色/, key: "factions" },
  { pattern: /文风与考据|文风|写作约束|节奏|考据/, key: "style_research" },
];

function sanitizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function renderMaterialList(fileNames: string[]) {
  if (fileNames.length === 0) {
    return "本次没有上传作者材料文件。";
  }

  return fileNames.map((fileName, index) => `${index + 1}. ${fileName}`).join("\n");
}

function renderBulletList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- _待补充_";
}

function renderMarkdownDocument(title: string, sections: Array<{ heading: string; body: string }>) {
  const lines = [`# ${title}`];

  for (const section of sections) {
    lines.push("", `## ${section.heading}`, "", section.body.trim() || "_待补充_");
  }

  return `${lines.join("\n").trim()}\n`;
}

function normalizeGapLabel(label: string): BlankGapQuestionKey | null {
  const normalizedLabel = label.replace(/\s+/g, "");

  for (const item of GAP_LABEL_MAP) {
    if (item.pattern.test(normalizedLabel)) {
      return item.key;
    }
  }

  return null;
}

function extractMarkdownSection(markdown: string, level: 2 | 3, heading: string) {
  const lines = markdown.split("\n");
  const targetHeading = `${"#".repeat(level)} ${heading}`;
  const stopPattern = new RegExp(`^#{1,${level}}\\s+`);
  const content: string[] = [];
  let isCollecting = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!isCollecting) {
      if (trimmedLine === targetHeading) {
        isCollecting = true;
      }
      continue;
    }

    if (stopPattern.test(trimmedLine)) {
      break;
    }

    content.push(line);
  }

  return sanitizeMultilineText(content.join("\n"));
}

function parseGapPrompts(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .reduce<Partial<Record<BlankGapQuestionKey, string>>>((accumulator, line) => {
      const match = line.match(/^(?:[-*]|\d+\.)\s*(?:\[(.+?)\]|【(.+?)】)\s*(.+)$/);
      const label = match?.[1] ?? match?.[2];
      const body = match?.[3] ? sanitizeMultilineText(match[3]) : "";
      const key = label ? normalizeGapLabel(label) : null;

      if (!key || !body) {
        return accumulator;
      }

      return {
        ...accumulator,
        [key]: body,
      };
    }, {});
}

function isGapResolved(prompt: string) {
  return /(材料已明确|已写明|可直接沿用|无需补充|已覆盖|暂不需要补充)/.test(prompt);
}

function inferTrack(genre: string) {
  const text = genre.toLowerCase();

  if (/(港综|商战|财阀|金融)/.test(text)) {
    return "gangster_business";
  }

  if (/(历史|权谋|朝堂)/.test(text)) {
    return "historical_power";
  }

  if (/(仙侠|玄幻|修仙)/.test(text)) {
    return "fantasy";
  }

  return "general";
}

function dedupeOptions(options: BlankGapQuestionOption[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    const value = sanitizeMultilineText(option.value);
    if (!option.label.trim() || !value || seen.has(value)) {
      return false;
    }

    option.value = value;
    seen.add(value);
    return true;
  });
}

function buildRecommendedOptions(
  key: BlankGapQuestionKey,
  input: {
    projectName: string;
    genre: string;
    platform: string;
  },
) {
  const track = inferTrack(input.genre);

  if (key === "core_conflict") {
    if (track === "gangster_business") {
      return dedupeOptions([
        {
          label: "上位夺权",
          value: "主角要借资本局在港岛金融圈完成上位，但黑白两道和旧财团都盯着他的资金链、盟友和底牌。",
        },
        {
          label: "守住基本盘",
          value: "主角眼下最现实的目标是守住自己的产业和班底，否则一旦被对手做空或切断货源，就会被连环围猎。",
        },
        {
          label: "借局翻盘",
          value: "主角要利用一次高风险大局完成翻盘，可他必须在合作与背刺之间选边，稍有失手就会沦为替罪羊。",
        },
      ]);
    }

    if (track === "historical_power") {
      return dedupeOptions([
        {
          label: "改命求生",
          value: "主角想借乱局改命并保住家族，但朝堂、世家和边军都把他当作可替换的棋子。",
        },
        {
          label: "守家夺势",
          value: "主角既要守住根基，又要争到真正能改局的话语权，最大阻力来自更早布局的旧势力。",
        },
        {
          label: "明暗双线",
          value: "主角明面上完成任务，暗线却必须破解真正的权力交易，否则所有功劳都会变成催命符。",
        },
      ]);
    }

    return dedupeOptions([
      {
        label: "翻盘上升",
        value: "主角想完成一次翻盘上升，但资源、时间和敌意会同时压上来，任何一步失误都会让前期积累归零。",
      },
      {
        label: "守住底牌",
        value: "主角必须先守住最关键的底牌和人脉，再借一次高风险选择撬开局面，否则会被更成熟的对手直接按死。",
      },
      {
        label: "先赢一小局",
        value: "主角眼下要先赢下一场能证明自己的小局，可这一步本身就是敌人布好的筛选局。",
      },
    ]);
  }

  if (key === "world_rules") {
    if (track === "gangster_business") {
      return dedupeOptions([
        {
          label: "越线有代价",
          value: "赚钱可以狠，但不能乱越线；一旦碰到监管、警方或大势力底线，就会被联手清场。",
        },
        {
          label: "情报比拳头更贵",
          value: "真正决定胜负的是情报、资金链和交易筹码，而不是单纯的正面硬碰硬。",
        },
        {
          label: "身份与动作分离",
          value: "主角能做的事和能公开承认的身份不是一回事，很多关键动作只能借壳或借人完成。",
        },
      ]);
    }

    if (track === "fantasy") {
      return dedupeOptions([
        {
          label: "力量必须付费",
          value: "所有强力能力都必须付出明确代价，可能是寿命、资源、道心或因果，不存在无成本爆种。",
        },
        {
          label: "体系有边界",
          value: "能力体系必须有清晰边界和上限，越级可以，但要依赖环境、准备和明确代价。",
        },
        {
          label: "禁忌不可乱碰",
          value: "这个世界存在一条碰了就会被群起而攻之的禁忌线，它既是剧情高压线，也是主角必须学会绕开的规则。",
        },
      ]);
    }

    return dedupeOptions([
      {
        label: "能力与代价绑定",
        value: "这个世界最重要的规则是：任何优势都必须付代价，主角不能无限试错，失败要有可感知的损失。",
      },
      {
        label: "边界先写清",
        value: "先把可做、不可做、公开能做和私下能做的边界写清楚，这样后面每次升级或翻盘才有真实张力。",
      },
      {
        label: "禁忌明确",
        value: "必须存在几条绝对不能碰的禁忌线，一旦触碰就会引发系统性追杀、清算或关系崩塌。",
      },
    ]);
  }

  if (key === "factions") {
    if (track === "gangster_business") {
      return dedupeOptions([
        {
          label: "财团 / 社团 / 警方",
          value: "先锁三层势力：明面的财团和公司、灰色地带的社团与掮客、以及握有规则解释权的警方或监管线。",
        },
        {
          label: "师门与盟友",
          value: "主角身边至少保留一条师门或老带新的关系线，它既是资源来源，也是后续背刺和托底的双刃剑。",
        },
        {
          label: "利益链清晰",
          value: "每个关键角色都先标清利益链：谁给钱、谁给路、谁给保护、谁随时可能反咬。",
        },
      ]);
    }

    return dedupeOptions([
      {
        label: "主角线 + 对手线",
        value: "先建立主角阵营、核心对手阵营和中间摇摆层三组关系，后续每次冲突就能快速落到人和利益上。",
      },
      {
        label: "关系必须可交易",
        value: "重要角色之间的关系最好都带可交易的东西，比如资源、秘密、保护、情感债或未来承诺。",
      },
      {
        label: "预留背叛线",
        value: "至少准备一条高价值关系线，用来承担后续合作、误判、背叛或牺牲带来的戏剧张力。",
      },
    ]);
  }

  if (input.platform.includes("番茄") || input.platform.includes("七猫")) {
    return dedupeOptions([
      {
        label: "快节奏强钩子",
        value: "文风要直给、节奏快、章节结尾带钩子，前三章就给出主角收益和持续追读理由，禁写长段铺垫。",
      },
      {
        label: "爽点前置",
        value: "每章都要有信息推进、局势变化或情绪兑现，爽点可以大小交替，但不能长时间空转。",
      },
      {
        label: "轻量考据",
        value: "只对真实平台规则、地理和制度细节做轻量考据，外部事实先沉淀到 findings，不直接覆盖剧情设定。",
      },
    ]);
  }

  return dedupeOptions([
    {
      label: "清楚稳准",
      value: "文风以清楚、稳准、信息密度高为主，章节推进必须服务主线，不写无效废话。",
    },
    {
      label: "张弛分明",
      value: "节奏要有快慢，但每一章都必须交代新的选择、代价或线索，不让剧情停在原地。",
    },
    {
      label: "考据只补现实外壳",
      value: "如果要接外部事实或 MCP，只让它补真实世界事实和平台规则，不让它覆盖项目正式设定。",
    },
  ]);
}

function buildFallbackPrompt(
  key: BlankGapQuestionKey,
  input: {
    projectName: string;
    genre: string;
    platform: string;
  },
) {
  switch (key) {
    case "core_conflict":
      return `当前材料已经帮你整理出《${input.projectName}》的题材方向，但还缺“主角眼下最想达成什么、最大阻力是什么”。请补一句能支撑后续 story_background / protagonist_card 的核心冲突。`;
    case "world_rules":
      return `请补一句这个项目最关键的世界规则、能力边界、禁忌或失败代价，避免后续 world_bible 继续停留在空白模板。`;
    case "factions":
      return `请补一句关键势力、重要角色和关系锚点，至少说明谁与主角合作、谁与主角对立，以及这层关系靠什么利益维系。`;
    case "style_research":
      return `请补一句 ${input.platform || "当前平台"} 向的文风约束、节奏要求，以及哪些现实细节需要考据，供 writing_rules / project_prompt_pack 使用。`;
    default:
      return "请补充这一项缺口信息。";
  }
}

function buildFollowUpAnswerMap(answers: BlankGapAnswer[]) {
  return answers.reduce<Partial<Record<BlankGapQuestionKey, string>>>((accumulator, entry) => {
    const answer = sanitizeMultilineText(entry.answer);
    return answer
      ? {
          ...accumulator,
          [entry.questionKey]: answer,
        }
      : accumulator;
  }, {});
}

function joinNonEmpty(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => sanitizeMultilineText(part ?? ""))
    .filter(Boolean)
    .join("\n\n");
}

export function buildBlankMaterialDigestInstruction(input: BlankMaterialDigestInput) {
  return [
    "你正在执行“空白创建 -> 作者材料预整理”任务。",
    `项目名：${input.projectName}`,
    `题材：${input.genre}`,
    `发布平台：${input.platform}`,
    "作者已上传材料：",
    renderMaterialList(input.materialFileNames),
    input.authorNotes?.trim() ? `作者补充说明：${input.authorNotes.trim()}` : null,
    "请基于已上传材料生成一份中文初始化摘要，供作者确认后再进入正式工作台。",
    "不要编造材料中不存在的剧情事实；若信息不足，明确写出“待作者补充”。",
    "请严格按以下 Markdown 结构输出：",
    "# 初始化整理摘要",
    "## 已识别信息",
    "### 故事前提与题材定位",
    "- 用 2-4 条要点总结当前材料已经明确的故事前提、题材定位、平台适配或已有主线。",
    "### 角色/势力/世界规则",
    "- 用 2-4 条要点总结材料已经明确的角色、势力、关系、世界规则或写作边界。",
    "## 待补充问题",
    "- [核心冲突] 写一句当前材料还缺什么，供后续补问。",
    "- [世界规则] 写一句当前材料还缺什么，供后续补问。",
    "- [势力关系] 写一句当前材料还缺什么，供后续补问。",
    "- [文风与考据] 写一句当前材料还缺什么，供后续补问。",
    "如果某一项材料已经写明，请直接写“材料已明确，可直接沿用：...”而不是再提重复问题。",
    "## findings.md 建议回填",
    "- 用 3-6 条要点写出适合先沉淀到 findings.md 的结构化信息。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseBlankMaterialDigest(digestOutput: string): BlankMaterialDigestSections {
  const normalizedOutput = sanitizeMultilineText(digestOutput);
  const premise = extractMarkdownSection(normalizedOutput, 3, "故事前提与题材定位");
  const worldAndCharacters = extractMarkdownSection(normalizedOutput, 3, "角色/势力/世界规则");
  const findings = extractMarkdownSection(normalizedOutput, 2, "findings.md 建议回填");
  const gapSection = extractMarkdownSection(normalizedOutput, 2, "待补充问题");

  return {
    premise,
    worldAndCharacters,
    findings,
    gapPrompts: parseGapPrompts(gapSection),
  };
}

export function buildBlankGapQuestions(input: {
  projectName: string;
  genre: string;
  platform: string;
  digestOutput: string;
}) {
  const parsedDigest = parseBlankMaterialDigest(input.digestOutput);

  return GAP_KEYS.flatMap((key) => {
    const digestPrompt = parsedDigest.gapPrompts[key];
    if (digestPrompt && isGapResolved(digestPrompt)) {
      return [];
    }

    return [
      {
        key,
        title: GAP_TITLES[key],
        prompt: digestPrompt || buildFallbackPrompt(key, input),
        placeholder: GAP_PLACEHOLDERS[key],
        recommendedOptions: buildRecommendedOptions(key, input),
        source: digestPrompt ? "digest" : "fallback",
      } satisfies BlankGapQuestion,
    ];
  });
}

export function buildBlankOnboardingBootstrapPackage(
  input: BlankOnboardingBootstrapInput,
): {
  artifactContentOverrides: Record<string, string>;
  extraArtifacts: ExtraProjectArtifactInput[];
} {
  const parsedDigest = parseBlankMaterialDigest(input.digestOutput);
  const answers = buildFollowUpAnswerMap(input.followUpAnswers);
  const premise = joinNonEmpty([
    `项目名：${input.projectName}`,
    `题材：${input.genre}`,
    `平台：${input.platform}`,
    parsedDigest.premise || null,
  ]);
  const coreConflict = answers.core_conflict || "待作者补充。";
  const worldRules = answers.world_rules || "待作者补充。";
  const factions = answers.factions || "待作者补充。";
  const styleResearch = answers.style_research || "待作者补充。";
  const materialList = renderBulletList(input.materialFileNames);
  const findingsBody = joinNonEmpty([
    parsedDigest.findings || "_待补充_",
    "### 作者补充回答",
    renderBulletList(
      GAP_KEYS.map((key) => `${GAP_TITLES[key]}：${answers[key] || "待作者补充"}`),
    ),
  ]);
  const nextStepLines = [
    "先检查 findings.md 和 onboarding_brief.md，确认材料整理结果与补问回答是否一致。",
    "优先执行 generate_setting / generate_outline，把故事前提和主线沉淀成正式设定。",
    "后续如需联网考据，只把真实世界事实写入 findings / Prompt overlay，不直接覆盖剧情事实。",
  ];

  return {
    artifactContentOverrides: {
      story_background: renderMarkdownDocument("story background", [
        { heading: "题材定位", body: premise },
        { heading: "故事前提", body: parsedDigest.premise || `项目《${input.projectName}》的基础材料已经导入，后续以当前题材继续收口。` },
        { heading: "核心冲突", body: coreConflict },
        { heading: "作者补充说明", body: input.authorNotes?.trim() || "_无_" },
      ]),
      world_bible: renderMarkdownDocument("world bible", [
        { heading: "已识别规则", body: parsedDigest.worldAndCharacters || "_待补充_" },
        { heading: "关键规则与禁忌", body: worldRules },
        { heading: "当前世界边界", body: joinNonEmpty([parsedDigest.worldAndCharacters || null, worldRules]) || "_待补充_" },
      ]),
      protagonist_card: renderMarkdownDocument("protagonist card", [
        { heading: "当前目标", body: coreConflict },
        { heading: "初始处境", body: parsedDigest.premise || "_待补充_" },
        { heading: "限制与代价", body: worldRules },
      ]),
      factions_and_characters: renderMarkdownDocument("factions and characters", [
        { heading: "已识别角色与势力", body: parsedDigest.worldAndCharacters || "_待补充_" },
        { heading: "关键关系锚点", body: factions },
        { heading: "关系推进注意事项", body: "优先保持人物关系与利益链清晰，不让新增设定覆盖既有材料已经写明的事实。" },
      ]),
      writing_rules: renderMarkdownDocument("writing rules", [
        { heading: "平台适配", body: `当前平台：${input.platform}\n题材：${input.genre}` },
        { heading: "文风与节奏", body: styleResearch },
        {
          heading: "考据与外部事实边界",
          body: "真实世界事实、平台规则和专业细节可以查证，但默认先沉淀到 findings / Prompt overlay，不直接改写正式剧情事实。",
        },
      ]),
      task_plan: renderMarkdownDocument("task plan", [
        { heading: "当前阶段", body: "已完成空白创建材料整理与缺口补问，下一步进入标准 artifact 工作流。" },
        { heading: "关键缺口结论", body: renderBulletList(GAP_KEYS.map((key) => `${GAP_TITLES[key]}：${answers[key] || "待作者补充"}`)) },
        { heading: "推荐下一步", body: renderBulletList(nextStepLines) },
      ]),
      findings: renderMarkdownDocument("findings", [
        { heading: "材料来源", body: materialList },
        { heading: "AI 整理摘要", body: sanitizeMultilineText(input.digestOutput) || "_待补充_" },
        { heading: "优先回填要点", body: findingsBody },
      ]),
    },
    extraArtifacts: [
      {
        artifactKey: "onboarding_brief",
        filename: "onboarding_brief.md",
        kind: "project_setting",
        summary: "Blank onboarding brief",
        content: renderMarkdownDocument("onboarding brief", [
          { heading: "项目名", body: input.projectName },
          { heading: "题材 / 平台", body: `题材：${input.genre}\n平台：${input.platform}` },
          { heading: "导入材料", body: materialList },
          { heading: "整理摘要", body: sanitizeMultilineText(input.digestOutput) || "_待补充_" },
          { heading: "补问结果", body: renderBulletList(GAP_KEYS.map((key) => `${GAP_TITLES[key]}：${answers[key] || "待作者补充"}`)) },
        ]),
      },
      {
        artifactKey: "project_prompt_pack",
        filename: "project_prompt_pack.md",
        kind: "project_setting",
        summary: "Blank onboarding prompt overlay pack",
        content: renderMarkdownDocument("project prompt pack", [
          {
            heading: "使用边界",
            body:
              "这是项目级 Prompt overlay，只补充表达风格、叙事重点、场景偏好和审稿关注点。\n不得覆盖全局安全约束、输出合同或既有正式剧情事实。",
          },
          { heading: "写作偏好", body: styleResearch },
          { heading: "叙事重点", body: coreConflict },
          { heading: "场景偏好与禁忌", body: worldRules },
          { heading: "资料优先级提醒", body: "优先遵守已上传材料与 findings 已确认内容；材料未写明时明确标注“待作者补充”。" },
        ]),
      },
      {
        artifactKey: "project_skill_pack",
        filename: "project_skill_pack.md",
        kind: "project_setting",
        summary: "Blank onboarding skill overlay pack",
        content: renderMarkdownDocument("project skill pack", [
          {
            heading: "使用边界",
            body:
              "这是项目级 Skill overlay，用来强调本项目在 planner / writer / reviewer / researcher 之间的偏重，不替换系统级 Skills 组合。",
          },
          { heading: "Writer 偏重", body: styleResearch || "优先保持节奏、收益链和章节钩子稳定输出。" },
          { heading: "Reviewer 偏重", body: `重点核查：${coreConflict}\n\n并检查人物关系、世界规则与材料来源是否一致。` },
          {
            heading: "Researcher 偏重",
            body: "仅在真实世界细节高风险时启用考据；搜索结果先写入 findings，不把外部结果直接提升为剧情事实。",
          },
          { heading: "Bootstrap 后动作", body: renderBulletList(nextStepLines) },
        ]),
      },
    ],
  };
}
