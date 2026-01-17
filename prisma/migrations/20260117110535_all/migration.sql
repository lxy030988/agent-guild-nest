-- CreateEnum
CREATE TYPE "AgentCategory" AS ENUM ('PRODUCTIVITY_TOOLS', 'CREATIVE_ASSISTANTS', 'DEVELOPER_TOOLS', 'OTHERS');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'MINTED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('CODE_REVIEW', 'CONTENT_CREATION', 'DATA_ANALYSIS', 'TRANSLATION', 'TESTING', 'RESEARCH', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'MATCHED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'RESOLVED_COMPLETED', 'RESOLVED_CANCELLED');

-- CreateEnum
CREATE TYPE "MatchingMode" AS ENUM ('SMART', 'MANUAL', 'APPLICATION', 'OPEN_MARKET');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('JOB_PAYMENT', 'PLATFORM_FEE', 'REFUND', 'STAKING_REWARD', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('INCOME', 'EXPENSE', 'PLATFORM_FEE');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'VOTING', 'RESOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('APPROVE', 'REJECT', 'ABSTAIN');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "nonce" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDesc" TEXT,
    "avatar" TEXT,
    "category" "AgentCategory" NOT NULL DEFAULT 'OTHERS',
    "tags" TEXT[],
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "capabilities" TEXT[],
    "configuration" JSONB,
    "endpointUrl" TEXT NOT NULL,
    "endpointAuthType" TEXT NOT NULL DEFAULT 'public',
    "healthCheckUrl" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "secretKey" TEXT,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "minPrice" DECIMAL(18,6),
    "maxPrice" DECIMAL(18,6),
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "tokenId" TEXT,
    "contractAddress" TEXT,
    "metadataURI" TEXT,
    "totalEarnings" DECIMAL(18,6) DEFAULT 0,
    "pendingEarnings" DECIMAL(18,6) DEFAULT 0,
    "revenueShareBps" INTEGER,
    "stakedAmount" DECIMAL(18,6) DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "JobCategory" NOT NULL,
    "tags" TEXT[],
    "requiredCapabilities" TEXT[],
    "inputData" JSONB NOT NULL,
    "expectedOutput" TEXT,
    "budget" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "escrowAmount" DECIMAL(10,2) NOT NULL,
    "deadline" TIMESTAMP(3),
    "estimatedDuration" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "matchingMode" "MatchingMode" NOT NULL DEFAULT 'SMART',
    "chainJobId" TEXT,
    "chainTxHash" TEXT,
    "chainDeadline" TEXT,
    "chainStatus" INTEGER,
    "chainBudget" TEXT,
    "ownerId" INTEGER NOT NULL,
    "assignedAgentId" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "resultData" JSONB,
    "feedback" TEXT,
    "rating" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAgentMatch" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAgentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,
    "message" TEXT,
    "proposedPrice" DECIMAL(10,2),
    "estimatedTime" INTEGER,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETH',
    "fromUserId" INTEGER,
    "toUserId" INTEGER,
    "jobId" INTEGER,
    "txHash" TEXT,
    "blockNumber" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "billNumber" TEXT NOT NULL,
    "type" "BillType" NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETH',
    "userId" INTEGER NOT NULL,
    "jobId" INTEGER,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_secretKey_key" ON "Agent"("secretKey");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_tokenId_key" ON "Agent"("tokenId");

-- CreateIndex
CREATE INDEX "Agent_category_idx" ON "Agent"("category");

-- CreateIndex
CREATE INDEX "Agent_ownerId_idx" ON "Agent"("ownerId");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_availability_idx" ON "Agent"("availability");

-- CreateIndex
CREATE INDEX "Agent_tokenId_idx" ON "Agent"("tokenId");

-- CreateIndex
CREATE INDEX "Agent_contractAddress_idx" ON "Agent"("contractAddress");

-- CreateIndex
CREATE INDEX "Agent_rating_idx" ON "Agent"("rating");

-- CreateIndex
CREATE INDEX "Agent_isVerified_idx" ON "Agent"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "Job_chainJobId_key" ON "Job"("chainJobId");

-- CreateIndex
CREATE INDEX "Job_ownerId_idx" ON "Job"("ownerId");

-- CreateIndex
CREATE INDEX "Job_assignedAgentId_idx" ON "Job"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_category_idx" ON "Job"("category");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "JobAgentMatch_jobId_idx" ON "JobAgentMatch"("jobId");

-- CreateIndex
CREATE INDEX "JobAgentMatch_agentId_idx" ON "JobAgentMatch"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "JobAgentMatch_jobId_agentId_key" ON "JobAgentMatch"("jobId", "agentId");

-- CreateIndex
CREATE INDEX "JobApplication_jobId_idx" ON "JobApplication"("jobId");

-- CreateIndex
CREATE INDEX "JobApplication_agentId_idx" ON "JobApplication"("agentId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_agentId_key" ON "JobApplication"("jobId", "agentId");

-- CreateIndex
CREATE INDEX "Transaction_fromUserId_idx" ON "Transaction"("fromUserId");

-- CreateIndex
CREATE INDEX "Transaction_toUserId_idx" ON "Transaction"("toUserId");

-- CreateIndex
CREATE INDEX "Transaction_jobId_idx" ON "Transaction"("jobId");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_userId_idx" ON "Bill"("userId");

-- CreateIndex
CREATE INDEX "Bill_jobId_idx" ON "Bill"("jobId");

-- CreateIndex
CREATE INDEX "Bill_type_idx" ON "Bill"("type");

-- CreateIndex
CREATE INDEX "Bill_createdAt_idx" ON "Bill"("createdAt");

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
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAgentMatch" ADD CONSTRAINT "JobAgentMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAgentMatch" ADD CONSTRAINT "JobAgentMatch_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
