-- AlterTable
ALTER TABLE "Meetup" ADD COLUMN "isAllChurch" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing meetups to be church-wide so they remain visible
UPDATE "Meetup" SET "isAllChurch" = true;

-- CreateTable
CREATE TABLE "MeetupShare" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetupShare_meetupId_userId_key" ON "MeetupShare"("meetupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupShare_meetupId_teamId_key" ON "MeetupShare"("meetupId", "teamId");

-- CreateIndex
CREATE INDEX "MeetupShare_userId_idx" ON "MeetupShare"("userId");

-- CreateIndex
CREATE INDEX "MeetupShare_teamId_idx" ON "MeetupShare"("teamId");

-- CreateIndex
CREATE INDEX "MeetupShare_meetupId_idx" ON "MeetupShare"("meetupId");

-- CreateIndex
CREATE INDEX "Meetup_isAllChurch_idx" ON "Meetup"("isAllChurch");

-- AddForeignKey
ALTER TABLE "MeetupShare" ADD CONSTRAINT "MeetupShare_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupShare" ADD CONSTRAINT "MeetupShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupShare" ADD CONSTRAINT "MeetupShare_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
