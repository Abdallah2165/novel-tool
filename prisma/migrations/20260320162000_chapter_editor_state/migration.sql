-- AlterTable
ALTER TABLE "ProjectPreference"
ADD COLUMN "activeChapterArtifactId" TEXT,
ADD COLUMN "chapterIndex" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "editorLayoutPrefs" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Draft"
ADD COLUMN "artifactId" TEXT;

-- CreateIndex
CREATE INDEX "Draft_projectId_draftKind_artifactId_updatedAt_idx"
ON "Draft"("projectId", "draftKind", "artifactId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "Draft"
ADD CONSTRAINT "Draft_artifactId_fkey"
FOREIGN KEY ("artifactId") REFERENCES "WorkspaceArtifact"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
