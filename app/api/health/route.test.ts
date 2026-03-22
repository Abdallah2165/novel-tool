import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $queryRaw: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

describe("health route", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
  });

  it("returns ok when database is reachable", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      checks: {
        database: "ok",
      },
    });
  });

  it("returns degraded when database check fails", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("database unavailable"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "degraded",
      checks: {
        database: "error",
      },
      error: "database unavailable",
    });
  });
});
