-- CreateEnum
CREATE TYPE "RaciAccessLevel" AS ENUM ('VIEW', 'EDIT');

-- AlterTable
ALTER TABLE "RaciChart" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "createdById" TEXT;

-- CreateTable
CREATE TABLE "RaciChartShare" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "access" "RaciAccessLevel" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaciChartShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaciChartShare_chartId_userId_key" ON "RaciChartShare"("chartId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RaciChartShare_chartId_teamId_key" ON "RaciChartShare"("chartId", "teamId");

-- CreateIndex
CREATE INDEX "RaciChartShare_userId_idx" ON "RaciChartShare"("userId");

-- CreateIndex
CREATE INDEX "RaciChartShare_teamId_idx" ON "RaciChartShare"("teamId");

-- CreateIndex
CREATE INDEX "RaciChartShare_chartId_idx" ON "RaciChartShare"("chartId");

-- CreateIndex
CREATE INDEX "RaciChart_createdById_idx" ON "RaciChart"("createdById");

-- AddForeignKey
ALTER TABLE "RaciChart" ADD CONSTRAINT "RaciChart_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciChartShare" ADD CONSTRAINT "RaciChartShare_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "RaciChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciChartShare" ADD CONSTRAINT "RaciChartShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciChartShare" ADD CONSTRAINT "RaciChartShare_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

