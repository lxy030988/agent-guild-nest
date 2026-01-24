-- CreateEnum
CREATE TYPE "MatchingMode" AS ENUM ('SMART', 'MANUAL', 'APPLICATION', 'OPEN_MARKET');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "matchingMode" "MatchingMode" NOT NULL DEFAULT 'SMART';
