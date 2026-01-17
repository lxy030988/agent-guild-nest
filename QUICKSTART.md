# DAO Module Quick Start Guide

Get the DAO governance backend running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running
- Basic familiarity with NestJS

## Quick Start

### 1. Install Dependencies (1 minute)

```bash
npm install viem
```

### 2. Configure Environment (2 minutes)

Add to your `.env` file (or copy from `.env.dao.example`):

```env
# Blockchain
CHAIN_ID=1
RPC_URL=https://eth.llamarpc.com

# Contracts (update with your addresses)
GOVERNOR_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STAKING_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

**Don't have contract addresses yet?** Use the placeholder values above for testing.

### 3. Run Database Migrations (1 minute)

```bash
npx prisma generate
npx prisma migrate dev --name add_dao_tables
```

### 4. Start the Server (1 minute)

```bash
npm run start:dev
```

### 5. Test the API (30 seconds)

Open your browser to:
- **Swagger UI**: http://localhost:3000/api
- **Test Endpoint**: http://localhost:3000/api/dao/stats

You should see the Swagger documentation and empty stats (no data yet).

## Automated Installation

Or run the automated script:

```bash
./install-dao-module.sh
```

## What's Available Now?

### API Endpoints (30+ endpoints ready to use)

**Proposals**: List, create, sync, query votes
```bash
GET  /api/dao/proposals
GET  /api/dao/proposals/:id
POST /api/dao/proposals
```

**Voting**: Record votes, get history
```bash
GET  /api/dao/votes/:walletAddress
POST /api/dao/votes
```

**Staking**: Track stakes, calculate voting power
```bash
GET /api/dao/staking/:walletAddress
GET /api/dao/staking/power/:walletAddress
```

**Treasury**: Monitor assets
```bash
GET /api/dao/treasury
GET /api/dao/treasury/assets
```

**Stats**: User and overall statistics
```bash
GET /api/dao/stats
GET /api/dao/stats/:walletAddress
```

**Activity**: User and global feeds
```bash
GET /api/dao/activity/:walletAddress
GET /api/dao/activity
```

## Test with Sample Data

### 1. Create a Test Proposal

```bash
curl -X POST http://localhost:3000/api/dao/proposals \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "1",
    "title": "Test Proposal",
    "description": "This is a test proposal",
    "proposer": "0x1234567890123456789012345678901234567890",
    "transactionHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
    "blockNumber": "18000000",
    "startBlock": "18000100",
    "endBlock": "18020100"
  }'
```

### 2. Query Proposals

```bash
curl http://localhost:3000/api/dao/proposals
```

### 3. Get Statistics

```bash
curl http://localhost:3000/api/dao/stats
```

## Common Use Cases

### Frontend Integration

```typescript
// Fetch proposals
const response = await fetch('http://localhost:3000/api/dao/proposals?status=ACTIVE');
const { data, meta } = await response.json();

// Get user voting power
const power = await fetch('http://localhost:3000/api/dao/staking/power/0x...');
const votingPower = await power.json();

// Record a vote (requires auth)
await fetch('http://localhost:3000/api/dao/votes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    proposalId: 'uuid',
    voter: '0x...',
    support: 'FOR',
    votingPower: '1000000000000000000000',
    transactionHash: '0x...',
    blockNumber: '18000500'
  })
});
```

### Blockchain Event Listener

```typescript
// Example: Listen for proposal creation events
import { createPublicClient, http } from 'viem';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

// Watch for ProposalCreated events
client.watchContractEvent({
  address: governorAddress,
  abi: governorAbi,
  eventName: 'ProposalCreated',
  onLogs: async (logs) => {
    for (const log of logs) {
      // Save to backend
      await fetch('http://localhost:3000/api/dao/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: log.args.proposalId.toString(),
          title: log.args.description,
          // ... other fields
        }),
      });
    }
  },
});
```

## Next Steps

1. **Update Contract Addresses**: Edit `.env` with your actual contract addresses
2. **Explore API**: Use Swagger UI at `/api` to test all endpoints
3. **Frontend Integration**: Connect your React/Next.js app to the API
4. **Add Event Listeners**: Set up blockchain event indexing
5. **Customize**: Modify services to match your governance logic

## Documentation

- **Setup Guide**: [DAO_SETUP.md](./DAO_SETUP.md) - Detailed setup instructions
- **API Docs**: [src/modules/dao/README.md](./src/modules/dao/README.md) - Complete API reference
- **Summary**: [DAO_MODULE_SUMMARY.md](./DAO_MODULE_SUMMARY.md) - Implementation overview

## Troubleshooting

### "Database connection failed"
```bash
# Check your DATABASE_URL in .env
echo $DATABASE_URL
# Ensure PostgreSQL is running
```

### "Module not found: viem"
```bash
# Install viem
npm install viem
```

### "Prisma Client not initialized"
```bash
# Regenerate Prisma Client
npx prisma generate
```

### "Contract call failed"
```bash
# Verify your contract addresses in .env
# Ensure RPC_URL is accessible
curl https://eth.llamarpc.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Support

For issues:
1. Check [DAO_SETUP.md](./DAO_SETUP.md) for detailed troubleshooting
2. Review Swagger docs at http://localhost:3000/api
3. Check application logs in the console

## Production Checklist

Before deploying to production:

- [ ] Update all contract addresses in `.env`
- [ ] Use a reliable RPC provider (Alchemy, Infura)
- [ ] Set up proper authentication
- [ ] Configure rate limiting
- [ ] Set up monitoring and logging
- [ ] Run database migrations on production DB
- [ ] Test all critical endpoints
- [ ] Set up backup strategy
- [ ] Configure CORS properly
- [ ] Use HTTPS in production

## What's Included

- ✅ 30+ REST API endpoints
- ✅ Complete Swagger documentation
- ✅ Viem blockchain integration
- ✅ PostgreSQL with Prisma ORM
- ✅ JWT authentication
- ✅ Input validation
- ✅ Error handling
- ✅ Activity tracking
- ✅ Statistics & analytics
- ✅ Pagination support

## Architecture

```
Frontend (React/Next.js)
    ↓
REST API (NestJS)
    ↓
Services (Business Logic)
    ↓
    ├→ Database (PostgreSQL/Prisma)
    └→ Blockchain (Viem/RPC)
```

## Performance

- Optimized database queries with indexes
- Pagination for large datasets
- Efficient blockchain queries
- Caching-ready architecture

---

**You're ready to go!** Start building your DAO governance frontend now.
