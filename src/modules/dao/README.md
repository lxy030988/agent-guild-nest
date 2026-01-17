# DAO Governance Module

Complete backend implementation for DAO governance functionality in NestJS.

## Features

- **Proposals Management**: Create, query, and sync proposals from blockchain
- **Voting System**: Record votes and track voting history
- **Staking**: Track user stakes and calculate voting power
- **Treasury**: Monitor treasury assets (ETH, ERC20, ERC721, ERC1155)
- **Governance Stats**: User statistics and activity tracking
- **Blockchain Integration**: Viem-based Web3 provider for smart contract interactions

## Installation

### 1. Install Dependencies

```bash
npm install viem
```

### 2. Environment Variables

Add the following to your `.env` file:

```env
# Blockchain Configuration
CHAIN_ID=1                    # 1 for Mainnet, 11155111 for Sepolia
RPC_URL=https://eth.llamarpc.com

# Contract Addresses
GOVERNOR_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STAKING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Optional: For write operations
PRIVATE_KEY=your_private_key_here
```

### 3. Database Migration

Run Prisma migrations to create the DAO tables:

```bash
npx prisma migrate dev
```

## Module Structure

```
src/modules/
├── dao/
│   ├── dto/
│   │   ├── create-proposal.dto.ts
│   │   ├── vote.dto.ts
│   │   ├── query-proposals.dto.ts
│   │   └── query-votes.dto.ts
│   ├── entities/
│   │   ├── proposal.entity.ts
│   │   ├── vote.entity.ts
│   │   ├── stake.entity.ts
│   │   ├── treasury.entity.ts
│   │   ├── governance-stats.entity.ts
│   │   └── governance-activity.entity.ts
│   ├── dao.controller.ts
│   ├── proposals.service.ts
│   ├── voting.service.ts
│   ├── staking.service.ts
│   ├── treasury.service.ts
│   ├── governance-stats.service.ts
│   ├── dao.module.ts
│   └── README.md
└── web3/
    ├── web3.module.ts
    ├── web3.provider.ts
    └── contracts.service.ts
```

## API Endpoints

### Proposals

- `GET /api/dao/proposals` - List all proposals with filters
- `GET /api/dao/proposals/:id` - Get proposal details
- `POST /api/dao/proposals` - Create a new proposal
- `POST /api/dao/proposals/sync/:id` - Sync proposal from blockchain
- `GET /api/dao/proposals/:id/votes` - Get proposal votes
- `GET /api/dao/proposals/:id/stats` - Get vote statistics

### Votes

- `GET /api/dao/votes/:walletAddress` - Get user vote history
- `POST /api/dao/votes` - Record a new vote
- `GET /api/dao/votes/:walletAddress/history` - Get detailed voting history

### Staking

- `GET /api/dao/staking/:walletAddress` - Get all stakes
- `GET /api/dao/staking/:walletAddress/active` - Get active stakes
- `GET /api/dao/staking/power/:walletAddress` - Get voting power
- `GET /api/dao/staking/:walletAddress/summary` - Get staking summary

### Treasury

- `GET /api/dao/treasury` - Get treasury overview
- `GET /api/dao/treasury/assets` - List all assets
- `GET /api/dao/treasury/assets/:assetType` - Get assets by type
- `GET /api/dao/treasury/native` - Get native ETH balance
- `GET /api/dao/treasury/erc20/:tokenAddress` - Get ERC20 balance

### Governance Stats

- `GET /api/dao/stats` - Get overall governance statistics
- `GET /api/dao/stats/:walletAddress` - Get user stats
- `GET /api/dao/stats/:walletAddress/participation` - Get participation rate

### Activity

- `GET /api/dao/activity/:walletAddress` - Get user activity feed
- `GET /api/dao/activity` - Get recent activities (global feed)

## Usage Examples

### Query Proposals

```typescript
// GET /api/dao/proposals?status=ACTIVE&page=1&limit=10&sortBy=createdAt&sortOrder=desc
{
  "data": [
    {
      "id": "uuid",
      "title": "Proposal Title",
      "status": "ACTIVE",
      "votesFor": "1000000000000000000000",
      "votesAgainst": "500000000000000000000",
      // ...
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Get Voting Power

```typescript
// GET /api/dao/staking/power/0x1234...
{
  "totalStaked": "5000000000000000000000",
  "votingPower": "7500000000000000000000",
  "activeStakes": 3,
  "onChainVotingPower": "7500000000000000000000"
}
```

### Get User Stats

```typescript
// GET /api/dao/stats/0x1234...
{
  "walletAddress": "0x1234...",
  "proposalsCreated": 5,
  "proposalsExecuted": 3,
  "totalVotes": 25,
  "votesFor": 20,
  "votesAgainst": 4,
  "votesAbstain": 1,
  "currentStaked": "3000000000000000000000",
  "totalVotingPower": "4500000000000000000000"
}
```

## Authentication

Most endpoints are public (`@Public()` decorator) for easy access. The following endpoints require authentication:

- `POST /api/dao/proposals`
- `POST /api/dao/proposals/sync/:id`
- `POST /api/dao/votes`

Use the existing JWT authentication system in the project.

## Service Methods

### ProposalsService

- `create(dto)` - Create proposal record
- `findAll(query)` - Query proposals with filters
- `findOne(id)` - Get proposal by ID
- `syncFromBlockchain(id)` - Sync proposal from blockchain
- `getProposalVotes(id)` - Get proposal votes
- `markAsExecuted(id, txHash)` - Mark proposal as executed
- `markAsCanceled(id)` - Mark proposal as canceled

### VotingService

- `create(dto)` - Record a vote
- `findByWallet(address, query)` - Get wallet votes
- `findOne(proposalId, voter)` - Get specific vote
- `hasVoted(proposalId, voter)` - Check if voted
- `getProposalVoteStats(id)` - Get vote statistics

### StakingService

- `findByWallet(address)` - Get all stakes
- `getActiveStakes(address)` - Get active stakes
- `getVotingPower(address)` - Calculate voting power
- `createStake(data)` - Record new stake
- `withdrawStake(id, txHash)` - Mark stake as withdrawn
- `getStakingSummary(address)` - Get summary

### TreasuryService

- `getAllAssets()` - Get all assets
- `getOverview()` - Get treasury overview
- `getAssetsByType(type)` - Filter by type
- `upsertAsset(data)` - Update/create asset
- `incrementBalance(...)` - Add to balance
- `decrementBalance(...)` - Subtract from balance

### GovernanceStatsService

- `getStats(address)` - Get user stats
- `getOverallStats()` - Get global stats
- `getUserActivity(address)` - Get activity feed
- `getRecentActivity()` - Get global feed
- `getParticipationRate(address)` - Calculate participation
- `getVotingHistory(address)` - Get detailed history

## Web3 Integration

The Web3Module provides blockchain interaction capabilities:

### Web3Provider

- `getPublicClient()` - Get Viem public client for reading
- `getWalletClient()` - Get Viem wallet client for writing
- `getChain()` - Get current chain configuration

### ContractsService

- `getProposal(proposalId)` - Read proposal from Governor
- `getProposalState(proposalId)` - Get proposal state
- `getVotingPower(address, block)` - Get voting power at block
- `getCurrentVotingPower(address)` - Get current voting power
- `getStakeInfo(address)` - Get stake from contract
- `getTransactionReceipt(txHash)` - Get tx receipt
- `getBlock(blockNumber)` - Get block info
- `getCurrentBlockNumber()` - Get current block

## Error Handling

All services use standard NestJS exceptions:

- `NotFoundException` - Resource not found
- `BadRequestException` - Invalid request or blockchain sync failure
- `ConflictException` - Duplicate resource (e.g., already voted)

## Swagger Documentation

All endpoints are documented with Swagger/OpenAPI annotations. Access the API documentation at:

```
http://localhost:3000/api
```

## Testing

Run tests with:

```bash
npm test
```

## Notes

- All blockchain addresses are stored in lowercase
- BigInt values are converted to strings in API responses
- Pagination defaults: page=1, limit=10
- All timestamps are in ISO 8601 format
- Activity tracking is automatic for all governance actions
