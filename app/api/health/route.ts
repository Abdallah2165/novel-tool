import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json(
      {
        status: "ok",
        checks: {
          database: "ok",
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return Response.json(
      {
        status: "degraded",
        checks: {
          database: "error",
        },
        error: error instanceof Error ? error.message : "Database health check failed.",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
      },
    );
  }
}
