-- CreateEnum
CREATE TYPE "ChildProtectionAccessLevel" AS ENUM ('VIEW', 'EDIT');

-- CreateTable
CREATE TABLE "ChildProtectionRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "ministries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "docusignSigned" BOOLEAN NOT NULL DEFAULT false,
    "docusignSignedAt" TIMESTAMP(3),
    "docusignUrl" TEXT,
    "ministrySafeCompletedAt" TIMESTAMP(3),
    "ministrySafeExpiresAt" TIMESTAMP(3),
    "ministrySafeUrl" TEXT,
    "backgroundCheckCompletedAt" TIMESTAMP(3),
    "backgroundCheckExpiresAt" TIMESTAMP(3),
    "backgroundCheckUrl" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ChildProtectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildProtectionShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "access" "ChildProtectionAccessLevel" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildProtectionShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildProtectionRecord_archivedAt_idx" ON "ChildProtectionRecord"("archivedAt");

-- CreateIndex
CREATE INDEX "ChildProtectionRecord_ministrySafeExpiresAt_idx" ON "ChildProtectionRecord"("ministrySafeExpiresAt");

-- CreateIndex
CREATE INDEX "ChildProtectionRecord_backgroundCheckExpiresAt_idx" ON "ChildProtectionRecord"("backgroundCheckExpiresAt");

-- CreateIndex
CREATE INDEX "ChildProtectionRecord_userId_idx" ON "ChildProtectionRecord"("userId");

-- CreateIndex
CREATE INDEX "ChildProtectionRecord_createdById_idx" ON "ChildProtectionRecord"("createdById");

-- CreateIndex
CREATE INDEX "ChildProtectionShare_userId_idx" ON "ChildProtectionShare"("userId");

-- CreateIndex
CREATE INDEX "ChildProtectionShare_teamId_idx" ON "ChildProtectionShare"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildProtectionShare_userId_key" ON "ChildProtectionShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildProtectionShare_teamId_key" ON "ChildProtectionShare"("teamId");

-- AddForeignKey
ALTER TABLE "ChildProtectionRecord" ADD CONSTRAINT "ChildProtectionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProtectionRecord" ADD CONSTRAINT "ChildProtectionRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProtectionShare" ADD CONSTRAINT "ChildProtectionShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProtectionShare" ADD CONSTRAINT "ChildProtectionShare_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
