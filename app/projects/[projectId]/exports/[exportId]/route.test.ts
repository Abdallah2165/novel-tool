import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  project: {
    findFirst: vi.fn(),
  },
};

const resolveRequestUserMock = vi.fn();
const readObjectMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth/identity", () => ({
  resolveRequestUser: resolveRequestUserMock,
}));

vi.mock("@/lib/storage/object-store", () => ({
  readObject: readObjectMock,
}));

describe("project export download route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.project.findFirst.mockReset();
    resolveRequestUserMock.mockReset();
    readObjectMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("streams the archived markdown export back as an attachment", async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: "project-1",
      preference: {
        exportRecords: [
          {
            id: "export-1",
            bundleKey: "chapters",
            title: "正式章节导出",
            fileName: "测试项目_chapters.md",
            storageKey: "projects/project-1/exports/export-1/测试项目_chapters.md",
            contentType: "text/markdown; charset=utf-8",
            byteSize: 14,
            fileCount: 1,
            files: ["chapter_001.md"],
            sourceArtifactKeys: ["chapter_001"],
            exportedAt: "2026-03-21T08:00:00.000Z",
            objectStoreMode: "local",
          },
        ],
      },
    });
    readObjectMock.mockResolvedValue(Buffer.from("# 第一章\n\n正文", "utf8"));

    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/projects/project-1/exports/export-1"), {
      params: Promise.resolve({
        projectId: "project-1",
        exportId: "export-1",
      }),
    });

    expect(response.status).toBe(200);
    expect(readObjectMock).toHaveBeenCalledWith("projects/project-1/exports/export-1/测试项目_chapters.md");
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(await response.text()).toBe("# 第一章\n\n正文");
  });

  it("returns 404 when the export record is missing", async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: "project-1",
      preference: {
        exportRecords: [],
      },
    });

    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/projects/project-1/exports/export-1"), {
      params: Promise.resolve({
        projectId: "project-1",
        exportId: "export-1",
      }),
    });

    expect(response.status).toBe(404);
    expect(readObjectMock).not.toHaveBeenCalled();
  });
});
