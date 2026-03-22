import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const putObjectMock = vi.fn();

vi.mock("@/lib/storage/object-store", () => ({
  putObject: putObjectMock,
}));

describe("reference ingest helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    putObjectMock.mockReset();
    putObjectMock.mockResolvedValue({ key: "mock-key", mode: "local" });
  });

  it("stores and extracts plain text references", async () => {
    const { ingestUploadedReference } = await import("./ingest");

    const result = await ingestUploadedReference({
      projectId: "project-1",
      file: new File(["第一段\r\n\r\n第二段"], "notes.txt", { type: "text/plain" }),
      tags: ["设定", "规则"],
      sourceUrl: "https://example.com/source",
    });

    expect(result).toMatchObject({
      filename: "notes.txt",
      mimeType: "text/plain",
      sourceType: "txt",
      extractionMethod: "text:utf8",
      extractedText: "第一段\n\n第二段",
      normalizedText: "第一段\n\n第二段",
      tags: ["设定", "规则"],
      sourceUrl: "https://example.com/source",
    });
    expect(result.storageKey).toContain("projects/project-1/references/");
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining("projects/project-1/references/"),
        contentType: "text/plain",
      }),
    );
  });

  it("strips html shell content into readable text", async () => {
    const { ingestUploadedReference } = await import("./ingest");

    const result = await ingestUploadedReference({
      projectId: "project-1",
      file: new File(
        [
          "<html><head><style>.hidden{display:none}</style></head><body><h1>标题</h1><p>第一段&nbsp;内容</p><script>console.log('x')</script><div>第二段</div></body></html>",
        ],
        "topic.html",
        { type: "text/html" },
      ),
      tags: [],
    });

    expect(result.sourceType).toBe("html_static_topic");
    expect(result.extractionMethod).toBe("html:readable_text");
    expect(result.normalizedText).toContain("标题");
    expect(result.normalizedText).toContain("第一段 内容");
    expect(result.normalizedText).toContain("第二段");
    expect(result.normalizedText).not.toContain("console.log");
    expect(result.normalizedText).not.toContain("hidden");
  });

  it("rejects unsupported file extensions", async () => {
    const { ingestUploadedReference } = await import("./ingest");

    await expect(
      ingestUploadedReference({
        projectId: "project-1",
        file: new File(["binary"], "archive.pdf", { type: "application/pdf" }),
        tags: [],
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});
