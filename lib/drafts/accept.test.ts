import { describe, expect, it } from "vitest";

import { appendAcceptLog, applyCurrentStateSync, formatAcceptTimestamp } from "./accept";

describe("draft accept document helpers", () => {
  const acceptedAt = new Date("2026-03-20T13:45:00.000Z");
  const context = {
    acceptedAt,
    artifactFilename: "findings.md",
    taskType: "review_content",
    summary: "Smoke accept revision",
    draftId: "draft-1",
    runId: "run-1",
  };

  it("formats accept timestamps in a stable local-like format", () => {
    expect(formatAcceptTimestamp(new Date("2026-03-20T03:05:00.000Z"))).toMatch(/2026-03-20 \d{2}:\d{2}/);
  });

  it("overwrites the managed state-sync block while preserving user content", () => {
    const first = applyCurrentStateSync("# 99_当前状态卡\n\n## 当前状态\n\n自定义状态。", context);
    const second = applyCurrentStateSync(first, {
      ...context,
      summary: "第二次接受",
    });

    expect(first).toContain("## 自动同步记录");
    expect(first).toContain("最近回填文件：findings.md");
    expect(second).toContain("回填摘要：第二次接受");
    expect((second.match(/novel-tools:state-sync:start/g) ?? []).length).toBe(1);
    expect(second).toContain("自定义状态。");
  });

  it("appends accept log entries and keeps the newest entry first", () => {
    const first = appendAcceptLog("# progress\n\n## 进度记录\n", context);
    const second = appendAcceptLog(first, {
      ...context,
      acceptedAt: new Date("2026-03-20T14:10:00.000Z"),
      artifactFilename: "chapter-21.md",
      taskType: "generate_chapter",
      summary: "续写 accepted",
      draftId: "draft-2",
    });

    const logLines = second
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- ["));

    expect(first).toContain("## 接受日志");
    expect(logLines[0]).toContain("chapter-21.md <- generate_chapter: 续写 accepted");
    expect(logLines[1]).toContain("findings.md <- review_content: Smoke accept revision");
    expect((second.match(/novel-tools:accept-log:start/g) ?? []).length).toBe(1);
  });
});
