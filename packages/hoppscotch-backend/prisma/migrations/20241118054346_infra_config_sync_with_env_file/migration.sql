-- AlterTable
ALTER TABLE "InfraConfig" DROP COLUMN "active",
ADD COLUMN     "lastSyncedEnvFileValue" TEXT;
