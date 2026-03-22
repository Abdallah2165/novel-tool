import { describe, expect, it } from "vitest";

import {
  buildBlankGapQuestions,
  buildBlankMaterialDigestInstruction,
  buildBlankOnboardingBootstrapPackage,
  parseBlankMaterialDigest,
} from "@/lib/projects/blank-onboarding";

const structuredDigest = [
  "# 初始化整理摘要",
  "",
  "## 已识别信息",
  "",
  "### 故事前提与题材定位",
  "",
  "- 当前材料已经明确这是港综商战方向，主轴围绕资本局与势力经营展开。",
  "- 平台适配偏番茄，需要前期尽快给到收益链与钩子。",
  "",
  "### 角色/势力/世界规则",
  "",
  "- 财阀、社团、警方内线和师门是四条核心关系线。",
  "- 赚钱可以狠，但不能乱越线；碰到监管和大势力底线会被联手清场。",
  "",
  "## 待补充问题",
  "",
  "- [核心冲突] 还需要作者明确主角眼下最想达成什么，以及第一阶段最大的阻力是谁。",
  "- [世界规则] 材料已明确，可直接沿用：越线会被监管与地下势力同时清场。",
  "- [势力关系] 还需要作者明确哪条关系线负责合作、哪条关系线负责背刺与反制。",
  "- [文风与考据] 还需要作者明确章节节奏、禁写项，以及金融法规是否要做轻量考据。",
  "",
  "## findings.md 建议回填",
  "",
  "- 资本局、势力经营、金融监管是当前项目的主轴词。",
  "- 人物与势力关系已经有基础骨架，适合先写入 findings 再扩成正式设定。",
].join("\n");

describe("blank onboarding helpers", () => {
  it("builds a material digest instruction with strict markdown sections", () => {
    const instruction = buildBlankMaterialDigestInstruction({
      projectName: "港综资本局",
      genre: "港综商战",
      platform: "番茄",
      authorNotes: "重点整理世界观和角色关系，不要扩写正文。",
      materialFileNames: ["世界观设定.md", "角色草案.txt"],
    });

    expect(instruction).toContain("空白创建 -> 作者材料预整理");
    expect(instruction).toContain("项目名：港综资本局");
    expect(instruction).toContain("### 故事前提与题材定位");
    expect(instruction).toContain("- [核心冲突]");
    expect(instruction).toContain("如果某一项材料已经写明，请直接写“材料已明确");
    expect(instruction).toContain("## findings.md 建议回填");
  });

  it("parses structured digest sections and gap prompts", () => {
    const parsed = parseBlankMaterialDigest(structuredDigest);

    expect(parsed.premise).toContain("港综商战方向");
    expect(parsed.worldAndCharacters).toContain("财阀、社团、警方内线和师门");
    expect(parsed.findings).toContain("资本局、势力经营、金融监管");
    expect(parsed.gapPrompts.core_conflict).toContain("主角眼下最想达成什么");
    expect(parsed.gapPrompts.world_rules).toContain("材料已明确");
  });

  it("builds follow-up questions only for unresolved gaps", () => {
    const questions = buildBlankGapQuestions({
      projectName: "港综资本局",
      genre: "港综商战",
      platform: "番茄",
      digestOutput: structuredDigest,
    });

    expect(questions).toHaveLength(3);
    expect(questions.map((question) => question.key)).toEqual([
      "core_conflict",
      "factions",
      "style_research",
    ]);
    expect(questions[0]?.prompt).toContain("主角眼下最想达成什么");
    expect(questions[0]?.recommendedOptions).toHaveLength(3);
  });

  it("builds artifact overrides and overlay files from digest plus follow-up answers", () => {
    const result = buildBlankOnboardingBootstrapPackage({
      projectName: "港综资本局",
      genre: "港综商战",
      platform: "番茄",
      authorNotes: "不要写成纯黑帮文，要保留金融收益链。",
      materialFileNames: ["世界观设定.md", "角色草案.txt"],
      digestOutput: structuredDigest,
      followUpAnswers: [
        {
          questionKey: "core_conflict",
          answer: "主角要借资本局在港岛金融圈站稳脚跟，但黑白两道都盯着他的资金链和底牌。",
        },
        {
          questionKey: "factions",
          answer: "财团负责明面合作，社团负责灰线压力，警方内线决定主角能否安全抽身。",
        },
        {
          questionKey: "style_research",
          answer: "章节短钩子强，禁写降智误会；金融法规和港岛地理做轻量考据。",
        },
      ],
    });

    expect(result.artifactContentOverrides.story_background).toContain("核心冲突");
    expect(result.artifactContentOverrides.story_background).toContain("资金链和底牌");
    expect(result.artifactContentOverrides.findings).toContain("AI 整理摘要");
    expect(result.extraArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ artifactKey: "onboarding_brief" }),
        expect.objectContaining({ artifactKey: "project_prompt_pack" }),
        expect.objectContaining({ artifactKey: "project_skill_pack" }),
      ]),
    );
  });
});
