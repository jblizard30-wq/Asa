-- CreateEnum
CREATE TYPE "ChildProtectionCertType" AS ENUM ('MINISTRY_SAFE', 'BACKGROUND_CHECK');

-- AlterTable
ALTER TABLE "ChildProtectionRecord" ADD COLUMN     "lastAutoReviewTaskAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChildProtectionRenewalAudit" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "certType" "ChildProtectionCertType" NOT NULL,
    "previousCompletedAt" TIMESTAMP(3),
    "previousExpiresAt" TIMESTAMP(3),
    "previousUrl" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildProtectionRenewalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildProtectionRenewalAudit_recordId_idx" ON "ChildProtectionRenewalAudit"("recordId");

-- CreateIndex
CREATE INDEX "ChildProtectionRenewalAudit_changedById_idx" ON "ChildProtectionRenewalAudit"("changedById");

-- AddForeignKey
ALTER TABLE "ChildProtectionRenewalAudit" ADD CONSTRAINT "ChildProtectionRenewalAudit_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ChildProtectionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProtectionRenewalAudit" ADD CONSTRAINT "ChildProtectionRenewalAudit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
