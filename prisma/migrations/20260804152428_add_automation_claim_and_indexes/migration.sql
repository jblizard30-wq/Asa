-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "lastDueDateFiredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IntakeSubmission" ADD COLUMN     "ipAddress" TEXT;

-- CreateIndex
CREATE INDEX "Task_deletedAt_dueDate_idx" ON "Task"("deletedAt", "dueDate");

-- CreateIndex
CREATE INDEX "IntakeSubmission_formId_ipAddress_createdAt_idx" ON "IntakeSubmission"("formId", "ipAddress", "createdAt");

