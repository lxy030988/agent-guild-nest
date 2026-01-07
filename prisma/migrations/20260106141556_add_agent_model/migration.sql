-- CreateEnum
CREATE TYPE "AgentCategory" AS ENUM ('PRODUCTIVITY_TOOLS', 'CREATIVE_ASSISTANTS', 'DEVELOPER_TOOLS', 'OTHERS');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'MINTED', 'PAUSED', 'ARCHIVED');

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

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
