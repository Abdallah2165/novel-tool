-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('openai', 'gemini', 'anthropic');

-- CreateEnum
CREATE TYPE "AuthMode" AS ENUM ('none', 'bearer', 'api_key', 'custom_header');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('healthy', 'degraded', 'invalid_auth', 'unreachable', 'misconfigured');

-- CreateEnum
CREATE TYPE "McpTransportType" AS ENUM ('streamable_http', 'sse');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "ReferenceSourceType" AS ENUM ('txt', 'markdown', 'html_static_topic', 'html_attachment_text', 'html_attachment_binary');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('canonical', 'project_setting', 'project_state', 'project_outline', 'project_chapter', 'review_report', 'ledger', 'hook_pool');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('pending', 'ready', 'accepted', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "DraftKind" AS ENUM ('generated_output', 'editor_autosave', 'review_revision');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Novel Tools User',
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEndpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "label" TEXT NOT NULL,
    "baseURL" TEXT NOT NULL,
    "authMode" "AuthMode" NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "encryptedHeaders" JSONB NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'misconfigured',
    "lastHealthCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpServer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transportType" "McpTransportType" NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "authMode" "AuthMode" NOT NULL,
    "encryptedAuth" TEXT,
    "encryptedHeaders" JSONB NOT NULL,
    "toolCount" INTEGER NOT NULL DEFAULT 0,
    "resourceCount" INTEGER NOT NULL DEFAULT 0,
    "promptCount" INTEGER NOT NULL DEFAULT 0,
    "capabilitiesSnapshot" JSONB,
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'misconfigured',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPreference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "defaultEndpointId" TEXT,
    "defaultModel" TEXT,
    "defaultTaskType" TEXT,
    "ledgerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showSelfCheck" BOOLEAN NOT NULL DEFAULT true,
    "showSettlement" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProjectPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sourceType" "ReferenceSourceType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT,
    "sourceUrl" TEXT,
    "extractionMethod" TEXT,
    "extractedText" TEXT,
    "normalizedText" TEXT,
    "tags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "currentRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceArtifactRevision" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceDraftId" TEXT,
    "sourceRunId" TEXT,
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceArtifactRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "selectedArtifactIds" JSONB NOT NULL,
    "selectedReferenceIds" JSONB NOT NULL,
    "selectedMcpServerIds" JSONB NOT NULL,
    "resolvedPrompt" TEXT NOT NULL,
    "resolvedSkills" JSONB NOT NULL,
    "resolvedContextArtifacts" JSONB NOT NULL,
    "toolCallsSummary" JSONB,
    "usage" JSONB,
    "status" "RunStatus" NOT NULL DEFAULT 'queued',
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "outputContent" TEXT NOT NULL,
    "suggestedPatches" JSONB NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'ready',
    "draftKind" "DraftKind" NOT NULL DEFAULT 'generated_output',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "ProviderEndpoint_userId_providerType_idx" ON "ProviderEndpoint"("userId", "providerType");

-- CreateIndex
CREATE INDEX "McpServer_userId_transportType_idx" ON "McpServer"("userId", "transportType");

-- CreateIndex
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPreference_projectId_key" ON "ProjectPreference"("projectId");

-- CreateIndex
CREATE INDEX "ReferenceDocument_projectId_createdAt_idx" ON "ReferenceDocument"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceArtifact_currentRevisionId_key" ON "WorkspaceArtifact"("currentRevisionId");

-- CreateIndex
CREATE INDEX "WorkspaceArtifact_projectId_kind_idx" ON "WorkspaceArtifact"("projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceArtifact_projectId_artifactKey_key" ON "WorkspaceArtifact"("projectId", "artifactKey");

-- CreateIndex
CREATE INDEX "WorkspaceArtifactRevision_artifactId_createdAt_idx" ON "WorkspaceArtifactRevision"("artifactId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GenerationRun_projectId_createdAt_idx" ON "GenerationRun"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Draft_projectId_updatedAt_idx" ON "Draft"("projectId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEndpoint" ADD CONSTRAINT "ProviderEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPreference" ADD CONSTRAINT "ProjectPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPreference" ADD CONSTRAINT "ProjectPreference_defaultEndpointId_fkey" FOREIGN KEY ("defaultEndpointId") REFERENCES "ProviderEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceDocument" ADD CONSTRAINT "ReferenceDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceArtifact" ADD CONSTRAINT "WorkspaceArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceArtifact" ADD CONSTRAINT "WorkspaceArtifact_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "WorkspaceArtifactRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceArtifactRevision" ADD CONSTRAINT "WorkspaceArtifactRevision_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "WorkspaceArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceArtifactRevision" ADD CONSTRAINT "WorkspaceArtifactRevision_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceArtifactRevision" ADD CONSTRAINT "WorkspaceArtifactRevision_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceArtifactRevision" ADD CONSTRAINT "WorkspaceArtifactRevision_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ProviderEndpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
