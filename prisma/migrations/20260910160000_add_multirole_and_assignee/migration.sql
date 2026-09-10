-- AlterTable
ALTER TABLE "OnboardingCase" ADD COLUMN "roles" "OnboardingRole"[] NOT NULL DEFAULT ARRAY[]::"OnboardingRole"[];

-- AlterTable
ALTER TABLE "OnboardingCaseItem" ADD COLUMN "assignedToUserId" TEXT;

-- CreateIndex
CREATE INDEX "OnboardingCaseItem_assignedToUserId_idx" ON "OnboardingCaseItem"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "OnboardingCaseItem" ADD CONSTRAINT "OnboardingCaseItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
