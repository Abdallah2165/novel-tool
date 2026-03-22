import { describe, expect, it } from "vitest";

import { findSourceMatch, parseReviewDraft } from "./parser";

describe("review parser", () => {
  it("parses multiple 问题/证据/最小修法 blocks", () => {
    const content = [
      "问题：主角推进过快。",
      "证据：当前稿件已经写到“先核对夜班仓单和靠港时刻”，但没有确认仓位让渡条件。",
      "最小修法：在谈价前补一句确认优先仓位凭据。",
      "",
      "问题：配角态度转折略突兀。",
      "证据：对方上一段还在压价，这一段已经主动退让，没有交代压力来源。",
      "最小修法：补一处对方收到上游催货消息的反应。",
    ].join("\n");

    const items = parseReviewDraft(content);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      issue: "主角推进过快。",
      minimalFix: "在谈价前补一句确认优先仓位凭据。",
    });
    expect(items[1]).toMatchObject({
      issue: "配角态度转折略突兀。",
      evidence: "对方上一段还在压价，这一段已经主动退让，没有交代压力来源。",
    });
  });

  it("finds source matches even when the source contains line breaks", () => {
    const sourceContent = [
      "周敬安站在潮钟下，先核对夜班仓单",
      "和靠港时刻，确认这批货确实会在三更前卸下。",
    ].join("\n");
    const evidence = "当前稿件已经写到“先核对夜班仓单和靠港时刻”，但没有确认仓位让渡条件。";

    const match = findSourceMatch(sourceContent, evidence);

    expect(match).not.toBeNull();
    expect(match?.snippet).toContain("先核对夜班仓单");
    expect(match?.snippet).toContain("靠港时刻");
  });

  it("attaches source matches during parse when source content is provided", () => {
    const sourceContent = "周敬安没有立刻谈价，而是先核对了让渡的优先仓位凭据。";
    const content = [
      "问题：利益确认动作还不够显性。",
      "证据：原文已经写到“先核对了让渡的优先仓位凭据”，但决策与收益挂钩还不够清楚。",
      "最小修法：补一句他确认好处落袋后才开口谈抽成。",
    ].join("\n");

    const [item] = parseReviewDraft(content, sourceContent);

    expect(item.sourceMatch).not.toBeNull();
    expect(item.sourceMatch?.snippet).toContain("先核对了让渡的优先仓位凭据");
  });
});
