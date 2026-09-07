-- AlterTable
ALTER TABLE "BoardPacket" ADD COLUMN     "items" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "StrategicFramework" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "packetId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicFramework_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StrategicFramework_toolId_idx" ON "StrategicFramework"("toolId");

-- CreateIndex
CREATE INDEX "StrategicFramework_packetId_idx" ON "StrategicFramework"("packetId");

-- CreateIndex
CREATE INDEX "StrategicFramework_createdById_idx" ON "StrategicFramework"("createdById");

-- AddForeignKey
ALTER TABLE "StrategicFramework" ADD CONSTRAINT "StrategicFramework_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "BoardPacket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicFramework" ADD CONSTRAINT "StrategicFramework_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
