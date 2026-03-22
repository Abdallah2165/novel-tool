import { describe, expect, it } from "vitest";

import {
  buildChapterGuidanceBrief,
  buildChapterGuidancePrompt,
  buildChapterGuidanceRunInstruction,
} from "@/lib/projects/chapter-guidance";

describe("chapter guidance helpers", () => {
  it("builds chapter guidance options from current chapter context", () => {
    const prompt = buildChapterGuidancePrompt({
      projectName: "港综资本局",
      genre: "港综商战",
      platform: "番茄",
      chapterTitle: "第12章 反手做局",
      chapterContent: "主角刚和盟友谈完合作，下一步要面对对手的围剿。",
      currentState: "当前最大的危机是资金链会被人掐断。",
      taskPlan: "本卷需要逐步放出伏笔，推动主角上位。",
      pendingHooks: "港岛旧账、警方内线身份、财团秘密协议。",
      findings: "角色关系和阵营站队已经开始松动。",
    });

    expect(prompt.question).toContain("第12章 反手做局");
    expect(prompt.options).toHaveLength(4);
    expect(prompt.options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["先立本章目标", "先升级正面冲突", "先释放关键信息", "先推动人物关系"]),
    );
  });

  it("builds a scene brief only when the author provides a guidance answer", () => {
    expect(
      buildChapterGuidanceBrief({
        chapterTitle: "第12章 反手做局",
        guidanceAnswer: "",
      }),
    ).toBe("");

    expect(
      buildChapterGuidanceBrief({
        chapterTitle: "第12章 反手做局",
        guidanceAnswer: "这一章优先让对手把压力压上来，逼主角先保资金链。",
      }),
    ).toContain("本章推进摘要");
  });

  it("prepends the current scene brief to the generate_chapter instruction", () => {
    const instruction = buildChapterGuidanceRunInstruction({
      baseInstruction: "续写下一章，保持平台收益逻辑和主角利益链一致。",
      chapterTitle: "第12章 反手做局",
      guidanceAnswer: "这一章优先让对手把压力压上来，逼主角先保资金链。",
    });

    expect(instruction).toContain("续写下一章");
    expect(instruction).toContain("作者本次选择");
    expect(instruction).toContain("资金链");
  });
});
