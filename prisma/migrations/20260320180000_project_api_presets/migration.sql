-- AlterTable
ALTER TABLE "ProjectPreference"
ADD COLUMN "apiPresets" JSONB NOT NULL DEFAULT '[]';
