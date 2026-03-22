ALTER TABLE "GenerationRun"
ADD COLUMN "archiveStorageKey" TEXT,
ADD COLUMN "archiveObjectStoreMode" TEXT,
ADD COLUMN "archiveByteSize" INTEGER,
ADD COLUMN "archiveContentType" TEXT;
