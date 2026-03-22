import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  generationRun: {
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

describe("generation archive download route", () => {
  beforeEach(() => {
    vi.resetModules();
    prismaMock.generationRun.findFirst.mockReset();
    resolveRequestUserMock.mockReset();
    readObjectMock.mockReset();

    resolveRequestUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("streams an archived generation run back as an attachment", async () => {
    prismaMock.generationRun.findFirst.mockResolvedValue({
      id: "run-1",
      taskType: "generate_setting",
      createdAt: new Date("2026-03-22T12:30:00.000Z"),
      archiveStorageKey: "projects/project-1/generation-runs/run-1/result.json",
      archiveContentType: "application/json; charset=utf-8",
      project: {
        name: "测试项目",
      },
    });
    readObjectMock.mockResolvedValue(Buffer.from('{"draft":{"outputContent":"正文"}}', "utf8"));

    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/projects/project-1/runs/run-1/archive"), {
      params: Promise.resolve({
        projectId: "project-1",
        runId: "run-1",
      }),
    });

    expect(response.status).toBe(200);
    expect(readObjectMock).toHaveBeenCalledWith("projects/project-1/generation-runs/run-1/result.json");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(await response.text()).toBe('{"draft":{"outputContent":"正文"}}');
  });

  it("returns 404 when the run has no archived payload", async () => {
    prismaMock.generationRun.findFirst.mockResolvedValue({
      id: "run-1",
      archiveStorageKey: null,
      taskType: "generate_setting",
      createdAt: new Date("2026-03-22T12:30:00.000Z"),
      archiveContentType: null,
      project: {
        name: "测试项目",
      },
    });

    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/projects/project-1/runs/run-1/archive"), {
      params: Promise.resolve({
        projectId: "project-1",
        runId: "run-1",
      }),
    });

    expect(response.status).toBe(404);
    expect(readObjectMock).not.toHaveBeenCalled();
  });
});
