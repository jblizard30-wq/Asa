-- CreateEnum
CREATE TYPE "MeetupCategory" AS ENUM ('GENERAL', 'WORSHIP', 'FELLOWSHIP', 'STUDY', 'MISSION', 'COMMITTEE', 'RETREAT', 'TRAINING');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('YES', 'NO', 'IF_NEEDED');

-- CreateEnum
CREATE TYPE "ShareCapability" AS ENUM ('VIEW', 'VOTE', 'SIGNUP', 'COMMENT');

-- CreateTable
CREATE TABLE "Meetup" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "MeetupCategory" NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isPotluck" BOOLEAN NOT NULL DEFAULT false,
    "hasRolesRoster" BOOLEAN NOT NULL DEFAULT false,
    "virtualUrl" TEXT,
    "agenda" TEXT,
    "minQuorum" INTEGER,
    "finalizedTimeSlotId" TEXT,
    "finalizedVenueId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Meetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetupTimeSlot" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetupTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeVote" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "timeSlotId" TEXT,
    "proposedTime" TIMESTAMP(3) NOT NULL,
    "choice" "VoteChoice" NOT NULL DEFAULT 'YES',
    "voterUserId" TEXT,
    "voterName" TEXT,
    "shareLinkId" TEXT,

    CONSTRAINT "TimeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueOption" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "mapUrl" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupSlot" (
    "id" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupClaim" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT,
    "shareLinkId" TEXT,
    "claimerName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetupShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "meetupId" TEXT NOT NULL,
    "capabilities" "ShareCapability"[],
    "label" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MeetupShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meetup_startsAt_idx" ON "Meetup"("startsAt");

-- CreateIndex
CREATE INDEX "Meetup_category_idx" ON "Meetup"("category");

-- CreateIndex
CREATE INDEX "Meetup_archivedAt_idx" ON "Meetup"("archivedAt");

-- CreateIndex
CREATE INDEX "MeetupTimeSlot_meetupId_idx" ON "MeetupTimeSlot"("meetupId");

-- CreateIndex
CREATE INDEX "TimeVote_meetupId_idx" ON "TimeVote"("meetupId");

-- CreateIndex
CREATE INDEX "TimeVote_timeSlotId_idx" ON "TimeVote"("timeSlotId");

-- CreateIndex
CREATE INDEX "VenueOption_meetupId_idx" ON "VenueOption"("meetupId");

-- CreateIndex
CREATE INDEX "SignupSlot_meetupId_idx" ON "SignupSlot"("meetupId");

-- CreateIndex
CREATE INDEX "SignupClaim_slotId_idx" ON "SignupClaim"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupShareLink_token_key" ON "MeetupShareLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "MeetupShareLink_tokenHash_key" ON "MeetupShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "MeetupShareLink_meetupId_revokedAt_idx" ON "MeetupShareLink"("meetupId", "revokedAt");

-- CreateIndex
CREATE INDEX "MeetupShareLink_expiresAt_idx" ON "MeetupShareLink"("expiresAt");

-- AddForeignKey
ALTER TABLE "Meetup" ADD CONSTRAINT "Meetup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupTimeSlot" ADD CONSTRAINT "MeetupTimeSlot_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeVote" ADD CONSTRAINT "TimeVote_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeVote" ADD CONSTRAINT "TimeVote_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "MeetupTimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeVote" ADD CONSTRAINT "TimeVote_voterUserId_fkey" FOREIGN KEY ("voterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeVote" ADD CONSTRAINT "TimeVote_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "MeetupShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueOption" ADD CONSTRAINT "VenueOption_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupSlot" ADD CONSTRAINT "SignupSlot_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupClaim" ADD CONSTRAINT "SignupClaim_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "SignupSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupClaim" ADD CONSTRAINT "SignupClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupClaim" ADD CONSTRAINT "SignupClaim_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "MeetupShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupShareLink" ADD CONSTRAINT "MeetupShareLink_meetupId_fkey" FOREIGN KEY ("meetupId") REFERENCES "Meetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetupShareLink" ADD CONSTRAINT "MeetupShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

