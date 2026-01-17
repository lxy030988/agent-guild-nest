# DAO Module Setup Guide

This guide will help you set up and run the DAO governance backend module.

## Prerequisites

- Node.js v18+ installed
- PostgreSQL database running
- Ethereum RPC endpoint (Alchemy, Infura, or public RPC)

## Step 1: Install Dependencies

Install the required Viem library for blockchain interactions:

```bash
npm install viem
```

## Step 2: Environment Configuration

Add these environment variables to your `.env` file:

```env
# Database (already configured)
DATABASE_URL="postgresql://user:password@host:5432/database"

# Blockchain Configuration
CHAIN_ID=1                    # 1 for Ethereum Mainnet, 11155111 for Sepolia Testnet
RPC_URL=https://eth.llamarpc.com

# Smart Contract Addresses
GOVERNOR_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STAKING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Optional: For write operations (leave empty if only reading)
PRIVATE_KEY=
```

### Configuration Examples

**For Ethereum Mainnet:**
```env
CHAIN_ID=1
RPC_URL=https://eth.llamarpc.com
```

**For Sepolia Testnet:**
```env
CHAIN_ID=11155111
RPC_URL=https://rpc.sepolia.org
```

**With Alchemy:**
```env
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

## Step 3: Database Migration

The Prisma schema already includes all DAO models. Run the migration:

```bash
npx prisma migrate dev --name add_dao_tables
```

This will create the following tables:
- `Proposal` - DAO proposals
- `Vote` - Voting records
- `ProposalTransaction` - Proposal execution transactions
- `Stake` - Staking records
- `Treasury` - Treasury assets
- `GovernanceStats` - User governance statistics
- `GovernanceActivity` - Activity feed

## Step 4: Generate Prisma Client

```bash
npx prisma generate
```

## Step 5: Start the Application

Development mode:
```bash
npm run start:dev
```

Production mode:
```bash
npm run build
npm run start:prod
```

## Step 6: Access the API

The DAO endpoints will be available at:
```
http://localhost:3000/api/dao
```

Swagger documentation:
```
http://localhost:3000/api
```

## Available Endpoints

### Proposals
- `GET /api/dao/proposals` - List proposals
- `GET /api/dao/proposals/:id` - Get proposal details
- `POST /api/dao/proposals` - Create proposal (requires auth)
- `POST /api/dao/proposals/sync/:id` - Sync from blockchain (requires auth)
- `GET /api/dao/proposals/:id/votes` - Get proposal votes

### Voting
- `GET /api/dao/votes/:walletAddress` - Get vote history
- `POST /api/dao/votes` - Record vote (requires auth)
- `GET /api/dao/votes/:walletAddress/history` - Voting history

### Staking
- `GET /api/dao/staking/:walletAddress` - Get stakes
- `GET /api/dao/staking/power/:walletAddress` - Get voting power
- `GET /api/dao/staking/:walletAddress/summary` - Staking summary

### Treasury
- `GET /api/dao/treasury` - Treasury overview
- `GET /api/dao/treasury/assets` - All assets
- `GET /api/dao/treasury/assets/:assetType` - Assets by type

### Stats
- `GET /api/dao/stats` - Overall statistics
- `GET /api/dao/stats/:walletAddress` - User statistics
- `GET /api/dao/activity/:walletAddress` - User activity feed

## Testing the API

### Example: Get Proposals
```bash
curl http://localhost:3000/api/dao/proposals?status=ACTIVE&limit=5
```

### Example: Get Voting Power
```bash
curl http://localhost:3000/api/dao/staking/power/0x1234567890123456789012345678901234567890
```

### Example: Get Treasury Overview
```bash
curl http://localhost:3000/api/dao/treasury
```

## Module Architecture

```
src/
├── modules/
│   ├── dao/                    # DAO Module
│   │   ├── dto/               # Data Transfer Objects
│   │   ├── entities/          # Entity definitions
│   │   ├── dao.controller.ts  # REST API endpoints
│   │   ├── dao.module.ts      # Module definition
│   │   ├── proposals.service.ts
│   │   ├── voting.service.ts
│   │   ├── staking.service.ts
│   │   ├── treasury.service.ts
│   │   └── governance-stats.service.ts
│   └── web3/                   # Web3 Module
│       ├── web3.module.ts
│       ├── web3.provider.ts   # Viem client setup
│       └── contracts.service.ts # Smart contract helpers
└── app.module.ts              # Updated with DAO module

prisma/
└── schema.prisma              # Includes DAO models
```

## Features Implemented

### 1. Proposals Service
- Create and manage proposals
- Query with filters (status, proposer, search)
- Pagination support
- Sync from blockchain
- Vote tracking
- Status management (pending, active, executed, etc.)

### 2. Voting Service
- Record votes
- Query vote history
- Prevent duplicate votes
- Calculate vote statistics
- Track participation

### 3. Staking Service
- Track user stakes
- Calculate voting power with multipliers
- Active/inactive stake management
- Integration with on-chain voting power
- Withdrawal tracking

### 4. Treasury Service
- Track multiple asset types (Native ETH, ERC20, ERC721, ERC1155)
- Balance management
- Asset metadata
- Treasury overview

### 5. Governance Stats Service
- User statistics (proposals created, votes cast, etc.)
- Overall DAO statistics
- Leaderboards (top proposers, voters, stakers)
- Activity feed
- Participation rate calculation
- Voting success rate

### 6. Web3 Integration
- Viem-based blockchain interactions
- Read proposal data from Governor contract
- Get voting power from token contract
- Get stake info from staking contract
- Transaction and block queries

## Authentication

Most endpoints are public for easy access. These require JWT authentication:
- `POST /api/dao/proposals`
- `POST /api/dao/proposals/sync/:id`
- `POST /api/dao/votes`

Use the existing auth system:
```bash
# 1. Login to get JWT token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x...", "signature": "..."}'

# 2. Use token in requests
curl -X POST http://localhost:3000/api/dao/proposals \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Data Flow

### Creating a Proposal
1. Frontend creates proposal transaction on blockchain
2. Transaction is mined
3. Backend receives proposal data via API
4. Proposal is saved to database
5. Governance activity is recorded
6. User stats are updated

### Casting a Vote
1. Frontend submits vote transaction
2. Transaction is mined
3. Backend receives vote data via API
4. Vote is recorded (checks for duplicates)
5. Proposal vote counts are updated
6. Governance activity is recorded
7. User stats are updated

### Syncing from Blockchain
1. Admin triggers sync for a proposal
2. Backend queries Governor contract
3. Retrieves current state and vote counts
4. Updates database records
5. Returns updated proposal data

## Troubleshooting

### "Database connection failed"
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify network connectivity

### "RPC URL not responding"
- Check RPC_URL in .env
- Try alternative RPC providers
- Verify CHAIN_ID matches network

### "Contract call failed"
- Verify contract addresses are correct
- Ensure contracts are deployed on the chain
- Check RPC provider supports contract calls

### "Prisma Client not found"
- Run `npx prisma generate`
- Restart development server

## Production Deployment

### 1. Build the application
```bash
npm run build
```

### 2. Set production environment variables
```bash
DATABASE_URL_PROD=postgresql://...
CHAIN_ID=1
RPC_URL=https://...
```

### 3. Run migrations
```bash
npx prisma migrate deploy
```

### 4. Start production server
```bash
npm run start:prod
```

## Monitoring

Key metrics to monitor:
- API response times
- Database query performance
- RPC call success rate
- Vote recording accuracy
- Proposal sync status

## Next Steps

1. **Install viem**: `npm install viem`
2. **Configure environment**: Update `.env` file
3. **Run migrations**: `npx prisma migrate dev`
4. **Start server**: `npm run start:dev`
5. **Test endpoints**: Use Swagger UI at `/api`
6. **Integrate frontend**: Connect to the API endpoints

## Support

For issues or questions:
1. Check the README.md in `src/modules/dao/`
2. Review the Swagger documentation at `/api`
3. Verify environment configuration
4. Check application logs

## License

Same as the main project.
