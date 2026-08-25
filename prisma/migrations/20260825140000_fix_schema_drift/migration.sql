-- Fixes production schema drift introduced in d6f1b1c ("complete platform
-- upgrade with benchmark parity and church superpowers"), which edited
-- schema.prisma but never generated a migration. This is the additive half
-- of that drift only: it brings the database in line with the columns,
-- tables, and enums schema.prisma already expects. It intentionally
-- excludes two DROP COLUMN operations from the original diff
-- (AutomationRule.lastDueDateFiredAt, IntakeSubmission.ipAddress) because
-- those would destroy existing production data — that decision is deferred
-- to a follow-up migration.

-- CreateEnum
CREATE TYPE "LiturgicalSeason" AS ENUM ('ADVENT', 'CHRISTMAS', 'LENT', 'EASTER', 'PENTECOST', 'ORDINARY_TIME');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- DropIndex
DROP INDEX "IntakeSubmission_formId_ipAddress_createdAt_idx";

-- DropIndex
DROP INDEX "Task_deletedAt_dueDate_idx";

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "projectId" TEXT,
ALTER COLUMN "sourceTaskId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TaskGuestLink" ADD COLUMN     "requiresRsvp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rsvpAt" TIMESTAMP(3),
ADD COLUMN     "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "TaskRecurrence" ADD COLUMN     "rotationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rotationSlots" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TaskProject" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "rrule" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "nextRunAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTemplateItem" (
    "id" TEXT NOT NULL,
    "serviceTemplateId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "defaultPriority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueOffsetDays" INTEGER,
    "season" "LiturgicalSeason",

    CONSTRAINT "ServiceTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTemplateRun" (
    "id" TEXT NOT NULL,
    "serviceTemplateId" TEXT NOT NULL,
    "occurrenceDate" TIMESTAMP(3) NOT NULL,
    "season" "LiturgicalSeason",
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTemplateRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VolunteerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "available" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskProject_taskId_idx" ON "TaskProject"("taskId");

-- CreateIndex
CREATE INDEX "TaskProject_projectId_idx" ON "TaskProject"("projectId");

-- CreateIndex
CREATE INDEX "TaskProject_sectionId_idx" ON "TaskProject"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskProject_taskId_projectId_key" ON "TaskProject"("taskId", "projectId");

-- CreateIndex
CREATE INDEX "ServiceTemplate_projectId_idx" ON "ServiceTemplate"("projectId");

-- CreateIndex
CREATE INDEX "ServiceTemplate_nextRunAt_idx" ON "ServiceTemplate"("nextRunAt");

-- CreateIndex
CREATE INDEX "ServiceTemplateItem_serviceTemplateId_idx" ON "ServiceTemplateItem"("serviceTemplateId");

-- CreateIndex
CREATE INDEX "ServiceTemplateItem_parentId_idx" ON "ServiceTemplateItem"("parentId");

-- CreateIndex
CREATE INDEX "ServiceTemplateRun_serviceTemplateId_idx" ON "ServiceTemplateRun"("serviceTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTemplateRun_serviceTemplateId_occurrenceDate_key" ON "ServiceTemplateRun"("serviceTemplateId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "VolunteerAvailability_userId_idx" ON "VolunteerAvailability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerAvailability_userId_dayOfWeek_key" ON "VolunteerAvailability"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityException_userId_idx" ON "AvailabilityException"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_userId_date_key" ON "AvailabilityException"("userId", "date");

-- CreateIndex
CREATE INDEX "AutomationRule_projectId_idx" ON "AutomationRule"("projectId");

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplate" ADD CONSTRAINT "ServiceTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplate" ADD CONSTRAINT "ServiceTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateItem" ADD CONSTRAINT "ServiceTemplateItem_serviceTemplateId_fkey" FOREIGN KEY ("serviceTemplateId") REFERENCES "ServiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateItem" ADD CONSTRAINT "ServiceTemplateItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ServiceTemplateItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateRun" ADD CONSTRAINT "ServiceTemplateRun_serviceTemplateId_fkey" FOREIGN KEY ("serviceTemplateId") REFERENCES "ServiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTemplateRun" ADD CONSTRAINT "ServiceTemplateRun_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAvailability" ADD CONSTRAINT "VolunteerAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
