-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'VOTING', 'RESOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('APPROVE', 'REJECT', 'ABSTAIN');

-- CreateTable
CREATE TABLE "Dispute" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "votingStartsAt" TIMESTAMP(3),
    "votingEndsAt" TIMESTAMP(3),
    "approveVotes" INTEGER NOT NULL DEFAULT 0,
    "rejectVotes" INTEGER NOT NULL DEFAULT 0,
    "abstainVotes" INTEGER NOT NULL DEFAULT 0,
    "totalVoteWeight" TEXT NOT NULL DEFAULT '0',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "chainDisputeId" TEXT,
    "chainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "disputeId" INTEGER NOT NULL,
    "voterId" INTEGER NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "tokenWeight" TEXT NOT NULL DEFAULT '0',
    "reason" TEXT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_chainDisputeId_key" ON "Dispute"("chainDisputeId");

-- CreateIndex
CREATE INDEX "Dispute_jobId_idx" ON "Dispute"("jobId");

-- CreateIndex
CREATE INDEX "Dispute_creatorId_idx" ON "Dispute"("creatorId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_createdAt_idx" ON "Dispute"("createdAt");

-- CreateIndex
CREATE INDEX "Vote_disputeId_idx" ON "Vote"("disputeId");

-- CreateIndex
CREATE INDEX "Vote_voterId_idx" ON "Vote"("voterId");

-- CreateIndex
CREATE INDEX "Vote_createdAt_idx" ON "Vote"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_disputeId_voterId_key" ON "Vote"("disputeId", "voterId");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
