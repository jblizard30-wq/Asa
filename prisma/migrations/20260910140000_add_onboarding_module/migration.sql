-- CreateEnum
CREATE TYPE "OnboardingRole" AS ENUM ('PASTORAL_STAFF', 'ADMIN_OFFICE', 'FACILITIES', 'IT_MEDIA', 'WORSHIP_MUSIC', 'CHILDRENS_YOUTH', 'VOLUNTEER', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingItemCategory" AS ENUM ('PAPERWORK', 'SOFTWARE_LICENSE', 'HARDWARE', 'FACILITY_ACCESS');

-- CreateEnum
CREATE TYPE "OnboardingCostCadence" AS ENUM ('ONE_TIME', 'MONTHLY');

-- CreateEnum
CREATE TYPE "OnboardingProvisioningType" AS ENUM ('MANUAL_TASK', 'GOOGLE_WORKSPACE', 'MICROSOFT_365', 'SLACK', 'MDM_DEVICE');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY_FOR_DAY_ONE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OnboardingBlueprint" (
    "id" TEXT NOT NULL,
    "role" "OnboardingRole" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingBlueprintItem" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "category" "OnboardingItemCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "docTemplateUrl" TEXT,
    "estimatedCost" DECIMAL(10,2),
    "costCadence" "OnboardingCostCadence",
    "provisioningType" "OnboardingProvisioningType" NOT NULL DEFAULT 'MANUAL_TASK',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingBlueprintItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCase" (
    "id" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "personEmail" TEXT,
    "role" "OnboardingRole" NOT NULL,
    "startDate" TIMESTAMP(3),
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "templateSnapshotAt" TIMESTAMP(3),
    "estimatedCapex" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estimatedMonthlyOpex" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingCaseItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "category" "OnboardingItemCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "docTemplateUrl" TEXT,
    "cost" DECIMAL(10,2),
    "costCadence" "OnboardingCostCadence",
    "provisioningType" "OnboardingProvisioningType" NOT NULL DEFAULT 'MANUAL_TASK',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "inventoryItemId" TEXT,
    "procurementVendor" TEXT,
    "procurementPoNumber" TEXT,
    "procurementUrl" TEXT,
    "procurementStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "completedLocationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingCaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingBlueprint_role_key" ON "OnboardingBlueprint"("role");

-- CreateIndex
CREATE INDEX "OnboardingBlueprintItem_blueprintId_idx" ON "OnboardingBlueprintItem"("blueprintId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCase_createdUserId_key" ON "OnboardingCase"("createdUserId");

-- CreateIndex
CREATE INDEX "OnboardingCase_role_idx" ON "OnboardingCase"("role");

-- CreateIndex
CREATE INDEX "OnboardingCase_status_idx" ON "OnboardingCase"("status");

-- CreateIndex
CREATE INDEX "OnboardingCaseItem_caseId_idx" ON "OnboardingCaseItem"("caseId");

-- CreateIndex
CREATE INDEX "OnboardingCaseItem_inventoryItemId_idx" ON "OnboardingCaseItem"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "OnboardingBlueprintItem" ADD CONSTRAINT "OnboardingBlueprintItem_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "OnboardingBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCaseItem" ADD CONSTRAINT "OnboardingCaseItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OnboardingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCaseItem" ADD CONSTRAINT "OnboardingCaseItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCaseItem" ADD CONSTRAINT "OnboardingCaseItem_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

