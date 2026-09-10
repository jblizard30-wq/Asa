-- CreateEnum
CREATE TYPE "OnboardingProcurementStatus" AS ENUM ('NOT_REQUIRED', 'NEEDED', 'ORDERED', 'RECEIVED');

-- AlterTable
ALTER TABLE "OnboardingCaseItem" ALTER COLUMN "procurementStatus" DROP DEFAULT;
ALTER TABLE "OnboardingCaseItem" ALTER COLUMN "procurementStatus" TYPE "OnboardingProcurementStatus" USING ("procurementStatus"::"OnboardingProcurementStatus");
ALTER TABLE "OnboardingCaseItem" ALTER COLUMN "procurementStatus" SET DEFAULT 'NOT_REQUIRED';
