-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MeetupCategory" ADD VALUE 'STAFF_MEETING';
ALTER TYPE "MeetupCategory" ADD VALUE 'ONE_ON_ONE';
ALTER TYPE "MeetupCategory" ADD VALUE 'BOARD_COMMITTEE';
ALTER TYPE "MeetupCategory" ADD VALUE 'STRATEGY_PLANNING';
ALTER TYPE "MeetupCategory" ADD VALUE 'WORKING_SESSION';
ALTER TYPE "MeetupCategory" ADD VALUE 'MINISTRY_HANGOUT';
ALTER TYPE "MeetupCategory" ADD VALUE 'VOLUNTEER_TRAINING';
ALTER TYPE "MeetupCategory" ADD VALUE 'WORSHIP_REHEARSAL';
ALTER TYPE "MeetupCategory" ADD VALUE 'RETREAT_OFFSITE';
ALTER TYPE "MeetupCategory" ADD VALUE 'POTLUCK_SOCIAL';

-- AlterEnum
ALTER TYPE "VoteChoice" ADD VALUE 'IF_NEED_BE';

