-- CreateEnum
CREATE TYPE "OnboardingSessionStatus" AS ENUM ('active', 'ready', 'finalized');

-- CreateTable
CREATE TABLE "ProjectOnboardingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OnboardingSessionStatus" NOT NULL DEFAULT 'active',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "finalizedProjectId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOnboardingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectOnboardingSession_userId_updatedAt_idx" ON "ProjectOnboardingSession"("userId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "ProjectOnboardingSession" ADD CONSTRAINT "ProjectOnboardingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
