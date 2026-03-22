CREATE TABLE "UserGrokConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'misconfigured',
    "lastHealthCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGrokConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserGrokConfig_userId_key" ON "UserGrokConfig"("userId");
CREATE INDEX "UserGrokConfig_userId_updatedAt_idx" ON "UserGrokConfig"("userId", "updatedAt" DESC);

ALTER TABLE "UserGrokConfig" ADD CONSTRAINT "UserGrokConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
