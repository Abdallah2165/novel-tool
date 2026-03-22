-- DropForeignKey
ALTER TABLE "Draft" DROP CONSTRAINT "Draft_runId_fkey";

-- AlterTable
ALTER TABLE "Draft" ALTER COLUMN "runId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
