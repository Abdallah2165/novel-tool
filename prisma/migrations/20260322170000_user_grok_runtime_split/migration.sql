ALTER TABLE "UserGrokConfig" RENAME COLUMN "apiUrl" TO "grokApiUrl";
ALTER TABLE "UserGrokConfig" RENAME COLUMN "encryptedApiKey" TO "encryptedGrokApiKey";
ALTER TABLE "UserGrokConfig" RENAME COLUMN "defaultModel" TO "grokModel";

ALTER TABLE "UserGrokConfig"
ADD COLUMN "tavilyApiUrl" TEXT,
ADD COLUMN "encryptedTavilyApiKey" TEXT,
ADD COLUMN "firecrawlApiUrl" TEXT,
ADD COLUMN "encryptedFirecrawlApiKey" TEXT;

CREATE TABLE "GrokSearchTrace" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB NOT NULL,
    "sourceItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrokSearchTrace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GrokSearchTrace_sessionId_key" ON "GrokSearchTrace"("sessionId");
CREATE INDEX "GrokSearchTrace_projectId_createdAt_idx" ON "GrokSearchTrace"("projectId", "createdAt" DESC);

ALTER TABLE "GrokSearchTrace" ADD CONSTRAINT "GrokSearchTrace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
