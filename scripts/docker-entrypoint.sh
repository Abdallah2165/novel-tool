#!/bin/sh
set -eu

echo "[entrypoint] Waiting for PostgreSQL..."
node ./scripts/wait-for-db.mjs

echo "[entrypoint] Syncing Prisma schema..."
if [ "${PRISMA_DB_SYNC_MODE:-deploy}" = "deploy" ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi

echo "[entrypoint] Starting Next.js on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}"
