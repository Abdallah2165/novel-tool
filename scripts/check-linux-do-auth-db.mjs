import process from "node:process";

import { PrismaClient } from "@prisma/client";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const options = {
    providerId: "linux-do",
    email: "",
    userId: "",
    accountId: "",
    limit: 5,
    allowEmpty: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--allow-empty") {
      options.allowEmpty = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      continue;
    }

    if (key === "provider-id") {
      options.providerId = value.trim() || options.providerId;
    } else if (key === "email") {
      options.email = value.trim().toLowerCase();
    } else if (key === "user-id") {
      options.userId = value.trim();
    } else if (key === "account-id") {
      options.accountId = value.trim();
    } else if (key === "limit") {
      options.limit = parsePositiveInt(value, options.limit);
    }

    index += 1;
  }

  return options;
}

function buildWhere(options) {
  const where = {
    providerId: options.providerId,
  };

  if (options.userId) {
    where.userId = options.userId;
  }

  if (options.accountId) {
    where.accountId = options.accountId;
  }

  if (options.email) {
    where.user = {
      email: options.email,
    };
  }

  return where;
}

function summarizeRecord(record) {
  const latestSession = record.user.sessions[0] ?? null;
  const linkedProviders = [...new Set(record.user.accounts.map((account) => account.providerId))];
  const hasSession = record.user._count.sessions > 0;

  return {
    status: hasSession ? "complete" : "missing_session",
    account: {
      id: record.id,
      providerId: record.providerId,
      providerAccountId: record.accountId,
      userId: record.userId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
    user: {
      id: record.user.id,
      name: record.user.name,
      email: record.user.email,
      emailVerified: record.user.emailVerified,
      image: record.user.image,
      createdAt: record.user.createdAt.toISOString(),
      updatedAt: record.user.updatedAt.toISOString(),
    },
    counts: {
      accounts: record.user._count.accounts,
      sessions: record.user._count.sessions,
      projects: record.user._count.projects,
    },
    linkedProviders,
    credentialLinked: linkedProviders.includes("credential"),
    latestSession: latestSession
      ? {
          id: latestSession.id,
          createdAt: latestSession.createdAt.toISOString(),
          expiresAt: latestSession.expiresAt.toISOString(),
        }
      : null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({
    log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  try {
    const records = await prisma.account.findMany({
      where: buildWhere(options),
      take: options.limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        providerId: true,
        accountId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            createdAt: true,
            updatedAt: true,
            accounts: {
              select: {
                providerId: true,
              },
            },
            sessions: {
              select: {
                id: true,
                createdAt: true,
                expiresAt: true,
              },
              orderBy: { updatedAt: "desc" },
              take: 1,
            },
            _count: {
              select: {
                accounts: true,
                sessions: true,
                projects: true,
              },
            },
          },
        },
      },
    });

    const rows = records.map(summarizeRecord);
    const completeRows = rows.filter((row) => row.status === "complete");
    const report = {
      checkedAt: new Date().toISOString(),
      filters: {
        providerId: options.providerId,
        email: options.email || null,
        userId: options.userId || null,
        accountId: options.accountId || null,
        limit: options.limit,
      },
      matchedAccountCount: rows.length,
      completeChainCount: completeRows.length,
      hasCompleteAuthChain: completeRows.length > 0,
      rows,
    };

    console.log(JSON.stringify(report, null, 2));

    if (!report.hasCompleteAuthChain && !options.allowEmpty) {
      const reason =
        rows.length === 0
          ? `No ${options.providerId} account rows matched the current filters.`
          : `Matched ${rows.length} ${options.providerId} account rows, but none had a related session row.`;
      console.error(`[auth-db-check] ${reason}`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
