# Event Listener Quick Reference

Quick commands and configurations for the blockchain event listener service.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.dao.example .env
# Edit .env with your contract addresses and RPC URL

# 3. Start application
npm run start:dev
```

## Environment Variables (Required)

```bash
CHAIN_ID=1
RPC_URL=https://eth.llamarpc.com
BLOCKCHAIN_RPC_URL=https://eth.llamarpc.com
GOVERNOR_CONTRACT_ADDRESS=0x...
TOKEN_CONTRACT_ADDRESS=0x...
STAKING_CONTRACT_ADDRESS=0x...
TREASURY_ADDRESS=0x...
GOVERNANCE_TOKEN_ADDRESS=0x...
START_BLOCK=18500000
```

## API Endpoints

### Check Status
```bash
curl http://localhost:3000/dao/listener/status
```

### Start Listener
```bash
curl -X POST http://localhost:3000/dao/listener/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Stop Listener
```bash
curl -X POST http://localhost:3000/dao/listener/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Re-index Events
```bash
curl -X POST "http://localhost:3000/dao/indexer/reindex?fromBlock=19000000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Proposals
```bash
curl http://localhost:3000/dao/proposals
```

### Get Votes
```bash
curl http://localhost:3000/dao/votes/0xYourWalletAddress
```

### Get Staking Info
```bash
curl http://localhost:3000/dao/staking/0xYourWalletAddress
```

## Configuration Tuning

### Fast Indexing (Dedicated RPC)
```typescript
// indexer.service.ts
private readonly BATCH_SIZE = 50000;
private readonly RETRY_DELAY = 1000;
await this.delay(200); // Line ~182
```

### Slow RPC / Rate Limited
```typescript
// indexer.service.ts
private readonly BATCH_SIZE = 5000;
private readonly MAX_RETRIES = 5;
private readonly RETRY_DELAY = 3000;
await this.delay(1000); // Line ~182
```

### Production Settings
```typescript
// indexer.service.ts
private readonly BATCH_SIZE = 10000;
private readonly MAX_RETRIES = 3;
private readonly RETRY_DELAY = 2000;
await this.delay(500); // Line ~182
```

## Monitored Events

| Event | Contract | Description |
|-------|----------|-------------|
| ProposalCreated | Governor | New proposal created |
| VoteCast | Governor | Vote cast on proposal |
| ProposalExecuted | Governor | Proposal executed |
| ProposalCanceled | Governor | Proposal canceled |
| Staked | Staking | Tokens staked |
| Unstaked | Staking | Tokens unstaked |

## Common Commands

### Check Logs
```bash
# All logs
tail -f logs/app.log

# Event listener only
grep "EventListenerService" logs/app.log

# Indexer only
grep "IndexerService" logs/app.log

# Errors only
grep "ERROR" logs/app.log
```

### Database Operations
```bash
# Connect to database
psql -U postgres -d agent_guild_db

# Check proposal count
SELECT COUNT(*) FROM "Proposal";

# Check vote count
SELECT COUNT(*) FROM "Vote";

# Check stake count
SELECT COUNT(*) FROM "Stake";

# Check latest block
SELECT MAX("blockNumber") FROM "Proposal";
```

### Process Management (PM2)
```bash
# Start
pm2 start dist/main.js --name agent-guild-api

# Stop
pm2 stop agent-guild-api

# Restart
pm2 restart agent-guild-api

# View logs
pm2 logs agent-guild-api

# Monitor
pm2 monit
```

## Troubleshooting Quick Fixes

### Indexing Stuck
```bash
# 1. Check RPC endpoint
curl $RPC_URL

# 2. Check database connection
psql -U postgres -d agent_guild_db -c "SELECT 1;"

# 3. Restart service
pm2 restart agent-guild-api
```

### High Memory Usage
```bash
# 1. Reduce batch size in indexer.service.ts
private readonly BATCH_SIZE = 5000;

# 2. Restart application
pm2 restart agent-guild-api
```

### Missing Events
```bash
# Re-index from deployment block
curl -X POST "http://localhost:3000/dao/indexer/reindex?fromBlock=18500000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Rate Limiting
```bash
# 1. Increase delay between batches
# Edit indexer.service.ts, line ~182
await this.delay(1000);

# 2. Use dedicated RPC endpoint
# Update .env
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

## Performance Benchmarks

### Typical Indexing Speed

| RPC Provider | Batch Size | Blocks/Second | 100k Blocks |
|--------------|------------|---------------|-------------|
| Public RPC | 5,000 | ~500 | 3.3 minutes |
| Alchemy Free | 10,000 | ~1,000 | 1.7 minutes |
| Alchemy Growth | 50,000 | ~5,000 | 20 seconds |
| Infura | 10,000 | ~800 | 2 minutes |

### Memory Usage

| Operation | Memory Usage |
|-----------|--------------|
| Idle | ~100 MB |
| Indexing (10k batch) | ~200-300 MB |
| Real-time listening | ~150 MB |
| Peak (initial sync) | ~400 MB |

## Health Checks

### Automated Health Check Script
```bash
#!/bin/bash
# health-check.sh

STATUS=$(curl -s http://localhost:3000/dao/listener/status | jq -r '.isListening')

if [ "$STATUS" != "true" ]; then
  echo "Event listener is down!"
  # Send alert (email, Slack, etc.)
  curl -X POST http://localhost:3000/dao/listener/start \
    -H "Authorization: Bearer YOUR_TOKEN"
fi
```

### Cron Job Setup
```bash
# Add to crontab
*/5 * * * * /path/to/health-check.sh
```

## Metrics to Monitor

1. **Indexing Progress**: Current block vs latest block
2. **Event Count**: Proposals, votes, stakes per hour
3. **Error Rate**: Failed RPC calls per minute
4. **Response Time**: API endpoint latency
5. **Database Size**: Growth rate per day
6. **RPC Quota**: Requests per day

## File Structure

```
src/modules/dao/
├── event-listener.service.ts   # Real-time event monitoring
├── indexer.service.ts          # Historical event indexing
├── dao.module.ts               # Module configuration
├── dao.controller.ts           # API endpoints
├── proposals.service.ts        # Proposal operations
├── voting.service.ts           # Vote operations
├── staking.service.ts          # Staking operations
├── EVENT_LISTENER.md           # Technical documentation
├── SETUP_EVENT_LISTENER.md     # Setup guide
└── QUICK_REFERENCE.md          # This file
```

## Important Notes

- Event listener starts automatically on application launch
- Historical indexing runs before real-time listening
- Duplicate events are automatically skipped
- All operations are logged for debugging
- Admin endpoints require authentication

## Support Resources

- [Viem Documentation](https://viem.sh)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [OpenZeppelin Governor](https://docs.openzeppelin.com/contracts/governance)
