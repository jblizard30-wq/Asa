-- CreateEnum
CREATE TYPE "RaciRole" AS ENUM ('RESPONSIBLE', 'ACCOUNTABLE', 'CONSULTED', 'INFORMED');

-- CreateTable
CREATE TABLE "RaciChart" (
    "id" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "ministryArea" TEXT,
    "reviewDate" TIMESTAMP(3),
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "RaciChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaciStep" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaciStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaciPerson" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL DEFAULT '',
    "personOrder" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaciPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaciAssignment" (
    "stepId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "designations" "RaciRole"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaciAssignment_pkey" PRIMARY KEY ("stepId","personId")
);

-- CreateIndex
CREATE INDEX "RaciChart_archivedAt_idx" ON "RaciChart"("archivedAt");

-- CreateIndex
CREATE INDEX "RaciStep_chartId_stepOrder_idx" ON "RaciStep"("chartId", "stepOrder");

-- CreateIndex
CREATE INDEX "RaciPerson_chartId_personOrder_idx" ON "RaciPerson"("chartId", "personOrder");

-- CreateIndex
CREATE INDEX "RaciPerson_userId_idx" ON "RaciPerson"("userId");

-- CreateIndex
CREATE INDEX "RaciAssignment_personId_idx" ON "RaciAssignment"("personId");

-- AddForeignKey
ALTER TABLE "RaciStep" ADD CONSTRAINT "RaciStep_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "RaciChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciPerson" ADD CONSTRAINT "RaciPerson_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "RaciChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciPerson" ADD CONSTRAINT "RaciPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "RaciStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "RaciPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
