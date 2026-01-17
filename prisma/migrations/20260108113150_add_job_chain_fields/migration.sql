/*
  Warnings:

  - A unique constraint covering the columns `[chainJobId]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "chainBudget" TEXT,
ADD COLUMN     "chainDeadline" BIGINT,
ADD COLUMN     "chainJobId" BIGINT,
ADD COLUMN     "chainStatus" INTEGER,
ADD COLUMN     "chainTxHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_chainJobId_key" ON "Job"("chainJobId");
