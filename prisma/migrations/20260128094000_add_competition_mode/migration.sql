-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'RESOLVED_COMPLETED';
ALTER TYPE "JobStatus" ADD VALUE 'RESOLVED_CANCELLED';

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "JobExecution" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultData" JSONB,
    "errorMessage" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "autoScore" DOUBLE PRECISION,
    "manualScore" DOUBLE PRECISION,
    "scoringReason" TEXT,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "chainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobExecution_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "competitionsTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "competitionsWon" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "winRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "executionId" INTEGER;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "competitionMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "competitorCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "winnerExecutionId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "JobExecution_jobId_agentId_key" ON "JobExecution"("jobId", "agentId");

-- CreateIndex
CREATE INDEX "JobExecution_jobId_idx" ON "JobExecution"("jobId");

-- CreateIndex
CREATE INDEX "JobExecution_agentId_idx" ON "JobExecution"("agentId");

-- CreateIndex
CREATE INDEX "JobExecution_status_idx" ON "JobExecution"("status");

-- CreateIndex
CREATE INDEX "JobExecution_isWinner_idx" ON "JobExecution"("isWinner");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_winnerExecutionId_fkey" FOREIGN KEY ("winnerExecutionId") REFERENCES "JobExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExecution" ADD CONSTRAINT "JobExecution_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExecution" ADD CONSTRAINT "JobExecution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "JobExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
